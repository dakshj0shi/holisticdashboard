// Sends ONE real email as a given mailbox, then files a copy in its Sent folder.
//
//   node scripts/send-test-mail.mjs <from-mailbox> <password> <to-address>
//
// scripts/check-mail.mjs stops at "the port is open and these credentials work". This
// goes the rest of the way: actual SMTP delivery, plus the IMAP append that makes the
// message appear in Outlook. That append is the historically fragile half (see
// HANDOFF §11), so "delivered but no Sent copy" is reported as its own outcome.
//
// Run it from a machine that can already reach the mail server. A failure THERE means
// the application; a failure only on the server means the network. Don't use it to
// test reachability — `</dev/tcp/host/465` answers that with no app code at all.
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

const [from, password, to] = process.argv.slice(2);
if (!from || !password || !to) {
  console.error("Usage: node scripts/send-test-mail.mjs <from-mailbox> <password> <to-address>");
  process.exit(1);
}

const host = process.env.MAIL_HOST || "mail.jaipurrugs.com";
const port = Number(process.env.MAIL_SMTP_PORT ?? 465);
const imapPort = Number(process.env.MAIL_IMAP_PORT ?? 993);
const stamp = new Date().toISOString();

// Mirrors smtpTransport() in src/lib/mailer.ts — same port-derived TLS mode and the
// same 10s timeouts, so this fails the way the app fails rather than hanging.
const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port !== 465,
  auth: { user: from, pass: password },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

console.log(`Sending as ${from} -> ${to} via ${host}:${port} ...`);

let raw;
try {
  const info = await transport.sendMail({
    from,
    to,
    subject: `Portal mail path test ${stamp}`,
    text: `Sent by scripts/send-test-mail.mjs at ${stamp}.\n\nIf you received this, SMTP delivery works from this machine.`,
  });
  raw = info.message;
  console.log(`  OK    SMTP accepted it. messageId=${info.messageId}`);
} catch (e) {
  const code = e?.code ?? "unknown";
  console.log(`  FAIL  SMTP: ${code} - ${String(e).slice(0, 200)}`);
  console.log(
    code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ESOCKET"
      ? "\nCould not reach the mail server. This is the network, not the mailbox."
      : "\nThe server answered and refused. Check the address and password.",
  );
  process.exit(1);
}

// Separate outcome on purpose: the mail is already delivered by this point.
const client = new ImapFlow({
  host,
  port: imapPort,
  secure: true,
  auth: { user: from, pass: password },
  logger: false,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});
try {
  await client.connect();
  const list = await client.list();
  const sent =
    list.find((m) => m.specialUse === "\Sent") ??
    list.find((m) => ["Sent", "Sent Items", "INBOX.Sent", "INBOX/Sent"].includes(m.path));
  if (!sent) {
    console.log(`  WARN  no Sent folder found. Folders: ${list.map((m) => m.path).join(", ")}`);
  } else if (raw) {
    await client.append(sent.path, Buffer.from(raw), ["\Seen"]);
    console.log(`  OK    filed a copy in "${sent.path}"`);
  }
} catch (e) {
  console.log(`  WARN  IMAP append failed: ${e?.code ?? ""} ${String(e).slice(0, 160)}`);
  console.log("        The email was still delivered - only the Sent copy is missing.");
} finally {
  await client.logout().catch(() => {});
}

console.log("\nDone. Check the recipient's inbox and the sender's Sent folder.");
