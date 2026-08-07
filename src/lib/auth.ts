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

export async function verifyAdminCredentials(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.role !== "admin" || !user.active || !user.email) return null;

  if (skipMailVerify()) {
    // Dev-only escape hatch so local work doesn't require real mail credentials.
    if (!user.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  const ok = await verifyMailCredentials(user.email, password);
  return ok ? user : null;
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
    const ok = await verifyAdminCredentials(user.email!, password);
    if (!ok) return null;
    // Only hold the mailbox password when it was actually verified against the mail
    // server — in dev-skip mode it isn't a real mailbox credential, so we don't keep it.
    return { user, mailPassword: skipMailVerify() ? undefined : password };
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
    secure: process.env.NODE_ENV === "production",
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
