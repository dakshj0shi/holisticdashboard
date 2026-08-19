import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { encryptSecret, decryptSecret } from "./crypto";
import { verifyMailCredentials } from "./mailer";

const SESSION_COOKIE = "fmp_session";
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

// ---- Trainees: normal bcrypt-hashed password, verified locally ----

export async function verifyTraineeCredentials(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // `active` matters here: deactivating a trainee must actually revoke their login.
  if (!user || user.role !== "trainee" || !user.active || !user.passwordHash) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

// ---- Admins: login IS their real mailbox login on the org mail server ----
//
// We never compare against a locally stored password. A live SMTP connection with
// the entered credentials both proves the login and gives us what we need to send
// mail as this admin later in the same session. See Session.mailPasswordEnc.
// Hard-gated on NODE_ENV: even if DEV_SKIP_MAIL_VERIFY is left set in a production
// environment, admin login still requires a real mailbox check. Without this guard a
// stray env var would downgrade every admin to a local password compare.
const skipMailVerify = () =>
  process.env.DEV_SKIP_MAIL_VERIFY === "true" && process.env.NODE_ENV !== "production";

/* Emergency fallback: let admins sign in with a locally stored password instead of
   their live mailbox.

   Admin auth normally IS a live SMTP connection, so anything that breaks the network
   path to the mail server locks out every admin at once. Not hypothetical — a firewall
   change on 2026-08-13 made the mail server unreachable from this box and no admin
   could sign in until it was fixed, while trainees carried on fine.

   Unlike DEV_SKIP_MAIL_VERIFY this deliberately DOES work in production, which is why
   it is a separate, explicitly named flag rather than a loosening of that guard. Leave
   it unset. Set it only while locked out, and unset it again afterwards.

   Narrow on purpose: only admins who already have a password hash (add-admin.mjs
   --dev-password) can use it, every use is logged, and the entered password is NOT
   kept as a mailbox credential — a session opened this way still cannot send mail. */
const adminPasswordLogin = () => process.env.ADMIN_PASSWORD_LOGIN === "true";

// Reports WHICH path succeeded: only a real mailbox check yields a usable send credential.
export async function verifyAdminCredentials(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.role !== "admin" || !user.active || !user.email) return null;

  if (skipMailVerify()) {
    // Dev-only escape hatch so local work doesn't require real mail credentials.
    if (!user.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? { user, viaMail: false } : null;
  }

  if (adminPasswordLogin() && user.passwordHash) {
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (ok) {
      console.warn(
        `[auth] ADMIN_PASSWORD_LOGIN: ${user.email} signed in with a stored password. ` +
          `The mailbox was not verified, so this session cannot send mail.`,
      );
      return { user, viaMail: false };
    }
    // Fall through rather than reject — with the flag on, the real mailbox password
    // must still work the moment the mail server is reachable again.
  }

  const ok = await verifyMailCredentials(user.email, password);
  return ok ? { user, viaMail: true } : null;
}

// Single entry point for the login form: looks the user up once, dispatches to the
// trainee (bcrypt) or admin (live mail) path, and returns what createSession needs.
export async function authenticate(
  email: string,
  password: string,
): Promise<{ user: { id: string; role: string }; mailPassword?: string } | null> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return null;

  if (user.role === "admin") {
    const result = await verifyAdminCredentials(user.email!, password);
    if (!result) return null;
    // Only hold the mailbox password when it was actually verified against the mail
    // server. A dev-skip or ADMIN_PASSWORD_LOGIN password is not a mailbox credential;
    // keeping it would persist a secret that silently fails at send time.
    return { user, mailPassword: result.viaMail ? password : undefined };
  }

  const ok = await verifyTraineeCredentials(user.email!, password);
  return ok ? { user } : null;
}

export async function createSession(userId: string, mailPassword?: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      token,
      userId,
      expiresAt,
      mailPasswordEnc: mailPassword ? encryptSecret(mailPassword) : null,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // ponytail: server runs on plain HTTP — `secure` cookies are silently dropped by
    // browsers over HTTP, which is what broke every login/import. Flip to
    // `process.env.NODE_ENV === "production"` once the server is behind HTTPS.
    secure: false,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } }); // drops mailPasswordEnc with it
    jar.delete(SESSION_COOKIE);
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  // Checking `active` here (not just at login) means deactivating someone also cuts
  // off the session they already have open — every route goes through this.
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;

  const { id, email, name, role } = session.user;
  return { id, email: email ?? "", name, role };
}

// The decrypted mailbox password for the current admin session — used only at the
// moment of sending mail (scheduling, rescheduling, AI compose). Never persisted
// anywhere beyond the Session row it came from.
export async function getCurrentAdminMailCredential(): Promise<{ email: string; password: string } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.role !== "admin" || !session.mailPasswordEnc || !session.user.email) return null;

  return { email: session.user.email, password: decryptSecret(session.mailPasswordEnc) };
}
