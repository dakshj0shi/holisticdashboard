// Grant admin (facilitator) access to a real mailbox on the org mail server.
//
//   node prisma/add-admin.mjs priya@jaipurrugs.com "Priya Sharma"
//   node prisma/add-admin.mjs --list
//   node prisma/add-admin.mjs --revoke priya@jaipurrugs.com
//
// No password is stored. Admins log in with their real mailbox password, which is
// verified live against MAIL_HOST at sign-in — so this script is purely an allowlist:
// only the addresses added here can reach the admin console at all.
//
// --dev-password <pw> additionally stores a bcrypt hash for LOCAL testing only. It is
// ignored unless DEV_SKIP_MAIL_VERIFY=true AND NODE_ENV is not "production" (see
// src/lib/auth.ts), so it can never be used to bypass mail verification on the server.
//
// --super marks this admin as a super admin: they can export EVERY facilitator's
// session report, not just their own (see src/app/api/export/facilitators/route.ts).
// Only ever promotes when passed explicitly — re-running this script on an existing
// super admin without --super does NOT demote them. Use --revoke-super to demote.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const args = process.argv.slice(2);

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

if (args[0] === "--list") {
  const admins = await db.user.findMany({ where: { role: "admin" }, orderBy: { email: "asc" } });
  if (!admins.length) console.log("No admins yet.");
  for (const a of admins) {
    const flags = [a.active ? "active " : "REVOKED", a.isSuperAdmin ? "super" : "     "].join("  ");
    console.log(`${flags}  ${a.email}  ${a.name}`);
  }
  await db.$disconnect();
  process.exit(0);
}

if (args[0] === "--revoke-super") {
  const email = args[1]?.trim().toLowerCase();
  if (!email) fail("Usage: node prisma/add-admin.mjs --revoke-super <email>");
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing || existing.role !== "admin") fail(`No admin with email ${email}.`);
  await db.user.update({ where: { email }, data: { isSuperAdmin: false } });
  console.log(`${email} is no longer a super admin — they can now only export their own facilitator report.`);
  await db.$disconnect();
  process.exit(0);
}

if (args[0] === "--revoke") {
  const email = args[1]?.trim().toLowerCase();
  if (!email) fail("Usage: node prisma/add-admin.mjs --revoke <email>");
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing || existing.role !== "admin") fail(`No admin with email ${email}.`);
  // Deactivate rather than delete, so their EmailLog/Event history stays intact.
  // auth.ts checks `active` at login and on every request, so this cuts access now.
  await db.user.update({ where: { email }, data: { active: false } });
  await db.session.deleteMany({ where: { userId: existing.id } });
  console.log(`Revoked admin access for ${email} and ended their sessions.`);
  await db.$disconnect();
  process.exit(0);
}

const pwIndex = args.indexOf("--dev-password");
const devPassword = pwIndex === -1 ? null : args[pwIndex + 1];
if (pwIndex !== -1 && !devPassword) fail("--dev-password needs a value.");

const superIndex = args.indexOf("--super");
const makeSuper = superIndex !== -1;

const skipIndexes = new Set(
  [pwIndex, pwIndex === -1 ? -1 : pwIndex + 1, superIndex].filter((i) => i !== -1),
);
const positional = args.filter((_, i) => !skipIndexes.has(i));
const [emailRaw, ...nameParts] = positional;
const email = emailRaw?.trim().toLowerCase();
const name = nameParts.join(" ").trim();

if (!email || !name) fail('Usage: node prisma/add-admin.mjs <email> "Full Name" [--dev-password <pw>] [--super]');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`"${email}" doesn't look like an email address.`);

const data = { name, role: "admin", active: true, batchId: null };
if (devPassword) data.passwordHash = await bcrypt.hash(devPassword, 10);
if (makeSuper) data.isSuperAdmin = true; // never demotes automatically — see header comment

const existing = await db.user.findUnique({ where: { email } });

if (existing) {
  const promoting = existing.role !== "admin";
  // Promotion also detaches them from any batch (batchId above) and drops the trainee
  // bcrypt hash — admins authenticate against the mail server, so a leftover local
  // password is a credential nobody is managing. --dev-password still wins if passed.
  await db.user.update({
    where: { email },
    data: promoting ? { ...data, passwordHash: data.passwordHash ?? null } : data,
  });
  // Their old trainee session carries no mailbox credential and so cannot send mail as
  // an admin — end it and make them sign in again. Session records and events stay.
  if (promoting) await db.session.deleteMany({ where: { userId: existing.id } });
  console.log(
    existing.role === "admin"
      ? `Updated existing admin ${email}.`
      : `Promoted ${email} from ${existing.role} to admin.`,
  );
} else {
  await db.user.create({ data: { ...data, email } });
  console.log(`Added admin ${email} (${name}).`);
}

console.log("They sign in at /login with this email and their normal mailbox password.");
if (devPassword) {
  console.log(`Local-only dev password set — works only while DEV_SKIP_MAIL_VERIFY=true and NODE_ENV != production.`);
}
if (makeSuper) {
  console.log(`Marked as super admin — can export every facilitator's session report, not just their own.`);
}
await db.$disconnect();
