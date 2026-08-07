import "server-only";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { ImapFlow } from "imapflow";
import { db } from "./db";

const SENT_FOLDER_CANDIDATES = ["Sent", "Sent Items", "INBOX.Sent", "INBOX/Sent"];

function mailConfigured() {
  return Boolean(process.env.MAIL_HOST);
}

function smtpTransport(email: string, password: string) {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_SMTP_PORT ?? 465),
    secure: true, // SSL/TLS, matches the org's Outlook settings (port 465)
    auth: { user: email, pass: password },
  });
}

// Used by auth.ts at admin login — a successful connection IS the credential check.
export async function verifyMailCredentials(email: string, password: string): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const transport = smtpTransport(email, password);
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}

async function appendToSent(email: string, password: string, raw: Buffer): Promise<boolean> {
  const client = new ImapFlow({
    host: process.env.MAIL_HOST!,
    port: Number(process.env.MAIL_IMAP_PORT ?? 993),
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
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
  status: "sent" | "sent_no_sentfolder" | "simulated" | "failed" | "skipped_no_email";
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
