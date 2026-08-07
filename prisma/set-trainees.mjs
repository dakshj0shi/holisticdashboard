// Bulk-set trainee emails and login passwords from a CSV.
//
//   node prisma/set-trainees.mjs people.csv
//   node prisma/set-trainees.mjs people.csv --dry-run
//
// CSV columns (header row required, order doesn't matter, extra columns ignored):
//   name,email,password,batch
//
//   - name     : matched case-insensitively against trainees already imported from
//                the Excel roster. Required.
//   - email    : the address scheduling/summary mail goes to. Required.
//   - password : initial login password. Optional — omit to leave an existing
//                password untouched (or to create the row with no login yet).
//   - batch    : only used when the trainee doesn't exist yet, to place them.
//
// Idempotent: re-running with the same file changes nothing new. Use --dry-run first.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const [file, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");

if (!file) {
  console.error("Usage: node prisma/set-trainees.mjs <people.csv> [--dry-run]");
  process.exit(1);
}

// Minimal CSV reader: handles quoted fields and embedded commas, which is all a
// hand-maintained roster file needs. Not a general-purpose CSV parser.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const rows = parseCsv(readFileSync(file, "utf8"));
if (rows.length < 2) {
  console.error("CSV needs a header row plus at least one data row.");
  process.exit(1);
}

const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name);
const iName = col("name");
const iEmail = col("email");
const iPassword = col("password");
const iBatch = col("batch");

if (iName === -1 || iEmail === -1) {
  console.error(`CSV must have "name" and "email" columns. Found: ${header.join(", ")}`);
  process.exit(1);
}

const trainees = await db.user.findMany({ where: { role: "trainee" } });
const byName = new Map(trainees.map((t) => [t.name.trim().toLowerCase(), t]));
const batches = await db.batch.findMany();

const summary = { updated: 0, created: 0, passwordsSet: 0, skipped: [] };

for (const row of rows.slice(1)) {
  const name = (row[iName] ?? "").trim();
  const email = (row[iEmail] ?? "").trim().toLowerCase();
  const password = iPassword === -1 ? "" : (row[iPassword] ?? "").trim();
  const batchName = iBatch === -1 ? "" : (row[iBatch] ?? "").trim();

  if (!name || !email) {
    summary.skipped.push(`${name || "(no name)"}: missing name or email`);
    continue;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    summary.skipped.push(`${name}: "${email}" is not a valid email`);
    continue;
  }

  // Guard against handing one address to two people — email is the login identity.
  const emailOwner = await db.user.findUnique({ where: { email } });
  const existing = byName.get(name.toLowerCase());
  if (emailOwner && (!existing || emailOwner.id !== existing.id)) {
    summary.skipped.push(`${name}: ${email} is already used by "${emailOwner.name}"`);
    continue;
  }

  const data = { email };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    if (!dryRun) await db.user.update({ where: { id: existing.id }, data });
    summary.updated++;
    if (password) summary.passwordsSet++;
    console.log(`  update  ${name} → ${email}${password ? " (password set)" : ""}`);
  } else {
    const batch = batchName
      ? batches.find((b) => b.name.trim().toLowerCase() === batchName.toLowerCase())
      : null;
    if (batchName && !batch) {
      summary.skipped.push(`${name}: batch "${batchName}" not found`);
      continue;
    }
    if (!dryRun) {
      await db.user.create({ data: { ...data, name, role: "trainee", batchId: batch?.id ?? null } });
    }
    summary.created++;
    if (password) summary.passwordsSet++;
    console.log(`  create  ${name} → ${email}${batch ? ` [${batch.name}]` : " (no batch)"}`);
  }
}

console.log(
  `\n${dryRun ? "[dry run] " : ""}${summary.updated} updated, ${summary.created} created, ${summary.passwordsSet} passwords set.`,
);
if (summary.skipped.length) {
  console.log(`\n${summary.skipped.length} skipped:`);
  for (const s of summary.skipped) console.log(`  - ${s}`);
}
if (dryRun) console.log("\nNothing was written. Re-run without --dry-run to apply.");

await db.$disconnect();
