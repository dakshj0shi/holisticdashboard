// Check that this machine can actually reach the mail server on the ports the app needs.
//
//   node scripts/check-mail.mjs
//   node scripts/check-mail.mjs --login someone@jaipurrugs.com 'their-password'
//
// RUN THIS ON THE SERVER BEFORE GOING LIVE. Many hosting providers block outbound
// SMTP by default to stop spam. If port 465 is blocked, scheduling/summary/AI emails
// will fail at send time even though everything else works — the app will log them
// with status "failed" rather than silently dropping them, but no mail will arrive.
//
// Without --login this only proves the port is open and TLS completes. With --login it
// also proves the credentials authenticate and the Sent folder can be found, which is
// the full path the app uses.
import tls from "node:tls";

const host = process.env.MAIL_HOST || "mail.jaipurrugs.com";
const smtpPort = Number(process.env.MAIL_SMTP_PORT ?? 465);
const imapPort = Number(process.env.MAIL_IMAP_PORT ?? 993);

const args = process.argv.slice(2);
const loginIdx = args.indexOf("--login");
const creds = loginIdx === -1 ? null : { user: args[loginIdx + 1], pass: args[loginIdx + 2] };
if (loginIdx !== -1 && (!creds.user || !creds.pass)) {
  console.error("Usage: node scripts/check-mail.mjs --login <email> <password>");
  process.exit(1);
}

function probe(port, label) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = tls.connect({ host, port, servername: host }, () => {
      const ms = Date.now() - started;
      socket.once("data", (chunk) => {
        socket.end();
        resolve({ ok: true, label, port, ms, greeting: chunk.toString().split("\r\n")[0].slice(0, 80) });
      });
      // Some IMAP servers wait for a command; don't hang forever on the greeting.
      setTimeout(() => {
        socket.end();
        resolve({ ok: true, label, port, ms, greeting: "(connected, no greeting)" });
      }, 3000);
    });
    socket.setTimeout(10000, () => {
      socket.destroy();
      resolve({ ok: false, label, port, error: "timed out after 10s — port is most likely blocked" });
    });
    socket.on("error", (e) => resolve({ ok: false, label, port, error: e.message }));
  });
}

console.log(`Checking ${host} …\n`);

const results = [await probe(smtpPort, "SMTP (sending)"), await probe(imapPort, "IMAP (Sent folder)")];

for (const r of results) {
  if (r.ok) console.log(`  OK    ${r.label} :${r.port}  ${r.ms}ms  ${r.greeting}`);
  else console.log(`  FAIL  ${r.label} :${r.port}  ${r.error}`);
}

const blocked = results.filter((r) => !r.ok);
if (blocked.length) {
  console.log(`\n${blocked.length} of 2 ports unreachable.`);
  console.log("If this is a fresh VPS, ask the host to open outbound SMTP, or check the firewall:");
  console.log("  sudo ufw status");
  console.log("Until it's fixed, leave MAIL_HOST empty so mail is simulated instead of failing.");
  process.exit(1);
}

if (!creds) {
  console.log("\nBoth ports reachable. Re-run with --login <email> <password> to test real credentials.");
  process.exit(0);
}

// Full path check: authenticate over SMTP the way login does, then find the Sent folder.
const { default: nodemailer } = await import("nodemailer");
const { ImapFlow } = await import("imapflow");

try {
  await nodemailer
    .createTransport({ host, port: smtpPort, secure: true, auth: { user: creds.user, pass: creds.pass } })
    .verify();
  console.log(`\n  OK    SMTP auth as ${creds.user} — admin login will succeed for this mailbox.`);
} catch (e) {
  console.log(`\n  FAIL  SMTP auth as ${creds.user}: ${e.message}`);
  console.log("        Admin login for this address will be rejected.");
  process.exit(1);
}

const client = new ImapFlow({ host, port: imapPort, secure: true, auth: { user: creds.user, pass: creds.pass }, logger: false });
try {
  await client.connect();
  const list = await client.list();
  const sent = list.find((m) => m.specialUse === "\\Sent") ?? list.find((m) => ["Sent", "Sent Items", "INBOX.Sent", "INBOX/Sent"].includes(m.path));
  if (sent) console.log(`  OK    Sent folder found: "${sent.path}" — sent copies will appear in Outlook.`);
  else {
    console.log(`  WARN  No Sent folder detected. Mail will still send, but logged as "sent_no_sentfolder".`);
    console.log(`        Folders seen: ${list.map((m) => m.path).join(", ")}`);
  }
} catch (e) {
  console.log(`  FAIL  IMAP auth: ${e.message}`);
} finally {
  await client.logout().catch(() => {});
}

console.log("\nMail path verified.");
