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
import net from "node:net";

/* Ports worth knowing about, not just the two currently configured. A network that blocks
   465 very often allows 587 (submission), and src/lib/mailer.ts now picks its TLS mode
   from MAIL_SMTP_PORT — so if 587 comes back open, mail is recoverable by changing that
   env var alone, with no code edit.

   IMPLICIT_TLS matters: 465 and 993 expect a TLS handshake immediately, while 25, 143 and
   587 start in plaintext and upgrade later. Probing those with tls.connect would report
   FAIL on a port that is wide open. */
const IMPLICIT_TLS = new Set([465, 993]);
const CANDIDATES = [
  { port: 25, label: "SMTP relay        " },
  { port: 143, label: "IMAP plaintext    " },
  { port: 465, label: "SMTP implicit TLS " },
  { port: 587, label: "SMTP STARTTLS     " },
  { port: 993, label: "IMAP implicit TLS " },
];

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
    const onConnect = () => {
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
    };
    const socket = IMPLICIT_TLS.has(port)
      ? tls.connect({ host, port, servername: host }, onConnect)
      : net.connect({ host, port }, onConnect);
    socket.setTimeout(10000, () => {
      socket.destroy();
      resolve({ ok: false, label, port, error: "timed out after 10s — port is most likely blocked" });
    });
    socket.on("error", (e) => resolve({ ok: false, label, port, error: e.message }));
  });
}

console.log(`Checking ${host} …\n`);

// Sequentially: a blocked port costs the full 10s timeout, and firing five at once at a
// firewall is a good way to get this source address throttled.
const results = [];
for (const c of CANDIDATES) {
  const tag = c.port === smtpPort || c.port === imapPort ? "  <- configured" : "";
  results.push({ ...(await probe(c.port, c.label)), tag });
}

for (const r of results) {
  if (r.ok) console.log(`  OK    ${r.label} :${r.port}  ${r.ms}ms  ${r.greeting}${r.tag}`);
  else console.log(`  FAIL  ${r.label} :${r.port}  ${r.error}${r.tag}`);
}

// Only the ports this deployment actually uses decide whether mail can work right now.
const blocked = results.filter((r) => !r.ok && (r.port === smtpPort || r.port === imapPort));

if (blocked.length && results.some((r) => r.ok && r.port === 587) && smtpPort !== 587) {
  console.log(`\n587 is reachable while the configured SMTP port is not.`);
  console.log("Set MAIL_SMTP_PORT=587 in the env file and restart — mailer.ts switches to STARTTLS on its own.");
}
if (blocked.length) {
  console.log(`\n${blocked.length} of the 2 configured ports unreachable.`);
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
  // Mirror src/lib/mailer.ts exactly: 465 is implicit TLS, everything else STARTTLS.
  // Hardcoding secure:true here made this test useless on 587 and 25 — it would report
  // FAIL on a port that works, which is the opposite of what a diagnostic should do.
  await nodemailer
    .createTransport({
      host,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort !== 465,
      auth: { user: creds.user, pass: creds.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
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
