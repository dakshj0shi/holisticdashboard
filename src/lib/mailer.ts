import "server-only";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { ImapFlow } from "imapflow";
import { db } from "./db";
import { classifyMailError, mailErrorCode, type MailVerdict } from "./mailErrors";

const SENT_FOLDER_CANDIDATES = ["Sent", "Sent Items", "INBOX.Sent", "INBOX/Sent"];

function mailConfigured() {
  return Boolean(process.env.MAIL_HOST);
}

function smtpTransport(email: string, password: string) {
  const port = Number(process.env.MAIL_SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS, so `secure`
    // must track the port — leaving it true on 587 hangs until connectionTimeout.
    // requireTLS keeps that upgrade mandatory, so a server without STARTTLS fails
    // rather than sending the mailbox password in the clear.
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: email, pass: password },
    // Admin login runs through this transport, so without explicit timeouts nodemailer
    // waits out its own defaults (30s greeting, 2min connect, 10min socket) and the
    // sign-in form just spins for two minutes before reporting "wrong password". A
    // firewall that DROPs rather than rejects looks exactly like this. 10s matches the
    // port probe in scripts/check-mail.mjs.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

// Used by auth.ts at admin login — a successful connection IS the credential check.
//
// Returns which kind of failure it was, because auth.ts acts on them differently: a
// refused password rejects the login outright, while a server we could not reach may
// fall back to the stored admin password (see ADMIN_AUTH in auth.ts). Not being able to
// tell those apart is what turned a firewall change into a long hunt. With no MAIL_HOST
// there is nothing to ask, which counts as unreachable.
export async function verifyMailCredentials(email: string, password: string): Promise<MailVerdict> {
  if (!mailConfigured()) return "unreachable";
  try {
    const transport = smtpTransport(email, password);
    await transport.verify();
    return "ok";
  } catch (e) {
    // Never log the password.
    console.warn(`[mail] verify failed for ${email}: ${mailErrorCode(e)} - ${String(e).slice(0, 200)}`);
    return classifyMailError(e);
  }
}

/* One IMAP connection at a time, with a gap between them.
   Every send opens its own connection to file a copy in the Sent folder, so a batch of
   rescheduling emails fires them all simultaneously and the server starts refusing
   partway through: the mail goes out but the Sent copy silently doesn't. The merchant
   email tool hit this on the same server and fixed it the same way.
   ponytail: a single in-process promise chain, not a real queue. Fine while one Next
   process does the sending; needs a shared lock if this ever runs multi-instance. */
const IMAP_GAP_MS = 500;
let imapChain: Promise<unknown> = Promise.resolve();

function queueImap<T>(task: () => Promise<T>): Promise<T> {
  const gap = () => new Promise((r) => setTimeout(r, IMAP_GAP_MS));
  const run = imapChain.then(task, task);
  // Chain on both outcomes: one rejection would otherwise wedge every later append
  // behind a permanently failed promise.
  imapChain = run.then(gap, gap);
  return run;
}

async function appendToSent(email: string, password: string, raw: Buffer): Promise<boolean> {
  return queueImap(() => appendToSentNow(email, password, raw));
}

async function appendToSentNow(email: string, password: string, raw: Buffer): Promise<boolean> {
  const client = new ImapFlow({
    host: process.env.MAIL_HOST!,
    port: Number(process.env.MAIL_IMAP_PORT ?? 993),
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  try {
    await client.connect();

    // Prefer the server-declared \Sent special-use folder; fall back to common names.
    let sentPath: string | null = null;
    const list = await client.list();
    const special = list.find((m) => m.specialUse === "\\Sent");
    if (special) sentPath = special.path;
    else {
      const byName = list.find((m) => SENT_FOLDER_CANDIDATES.includes(m.path));
      if (byName) sentPath = byName.path;
    }
    if (!sentPath) return false;

    await client.append(sentPath, raw, ["\\Seen"]);
    return true;
  } finally {
    await client.logout().catch(() => {});
  }
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendMailAsAdminResult = {
  status:
    | "sent"
    | "sent_no_sentfolder"
    | "simulated"
    | "failed"
    | "skipped_no_email"
    | "skipped_no_mail";
  error?: string;
};

// Sends mail as a specific admin (using their own mailbox credentials), appends the
// same message to their Sent folder, and logs one EmailLog row for every attempt.
export async function sendMailAsAdmin(opts: {
  adminEmail: string;
  adminPassword: string;
  sentByUserId: string;
  toUserId: string;
  kind: "session_scheduled" | "session_rescheduled" | "session_summary" | "custom_ai";
  batchId?: string;
  slotId?: string;
  mail: SendMailInput;
}): Promise<SendMailAsAdminResult> {
  const { adminEmail, adminPassword, sentByUserId, toUserId, kind, batchId, slotId, mail } = opts;

  const log = (status: SendMailAsAdminResult["status"], error?: string) =>
    db.emailLog.create({
      data: {
        toUserId,
        toEmail: mail.to,
        sentByUserId,
        kind,
        batchId,
        slotId,
        subject: mail.subject,
        body: mail.html,
        status,
        error,
      },
    });

  if (!mail.to) {
    await log("skipped_no_email");
    return { status: "skipped_no_email" };
  }

  if (!mailConfigured()) {
    console.log(`[dev-mail:simulated] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    await log("simulated");
    return { status: "simulated" };
  }

  // No mailbox credential on this session: the admin signed in with their stored password
  // because the mail server could not be reached (ADMIN_AUTH in auth.ts). Skip instead of
  // attempting a send — without this every recipient burns the full 10s SMTP timeout, so
  // one batch spins for minutes and then logs a failure per trainee anyway.
  if (!adminPassword) {
    await log("skipped_no_mail");
    return { status: "skipped_no_mail" };
  }

  try {
    const transport = smtpTransport(adminEmail, adminPassword);
    const composer = new MailComposer({
      from: adminEmail,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    const raw: Buffer = await new Promise((resolve, reject) => {
      composer.compile().build((err, message) => (err ? reject(err) : resolve(message)));
    });

    await transport.sendMail({ envelope: { from: adminEmail, to: mail.to }, raw });

    let status: SendMailAsAdminResult["status"] = "sent";
    try {
      const appended = await appendToSent(adminEmail, adminPassword, raw);
      if (!appended) status = "sent_no_sentfolder";
    } catch {
      status = "sent_no_sentfolder";
    }

    await log(status);
    return { status };
  } catch (e) {
    const error = String(e);
    await log("failed", error);
    return { status: "failed", error };
  }
}
