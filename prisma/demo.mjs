// Create (or remove) demo logins so you can click through both panels end-to-end.
//
//   node prisma/demo.mjs              # create demo admin + demo trainee
//   node prisma/demo.mjs --remove     # delete them again
//
// Everything it creates uses the @demo.local domain, so it can always find and remove
// exactly what it made and nothing else. RUN --remove BEFORE GOING LIVE.
//
// The demo admin only works while DEV_SKIP_MAIL_VERIFY=true and NODE_ENV is not
// "production" (see src/lib/auth.ts) — it has no real mailbox, so on a production
// server it cannot log in at all even if you forget to remove it.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DEMO_DOMAIN = "@demo.local";
const ADMIN_EMAIL = `facilitator${DEMO_DOMAIN}`;
const TRAINEE_EMAIL = `trainee${DEMO_DOMAIN}`;
const PASSWORD = "demo1234";

if (process.argv.includes("--remove")) {
  const demoUsers = await db.user.findMany({ where: { email: { endsWith: DEMO_DOMAIN } } });
  const ids = demoUsers.map((u) => u.id);

  // Drop the demo trainee's own submissions, but leave batches/worksheets alone —
  // those are real data the demo only borrowed.
  const subs = await db.worksheetSubmission.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await db.worksheetAnswer.deleteMany({ where: { submissionId: { in: subs.map((s) => s.id) } } });
  await db.worksheetSubmission.deleteMany({ where: { userId: { in: ids } } });
  await db.traineeSessionRecord.deleteMany({ where: { userId: { in: ids } } });
  await db.emailLog.deleteMany({ where: { toUserId: { in: ids } } });
  await db.event.deleteMany({ where: { userId: { in: ids } } });
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });

  console.log(`Removed ${demoUsers.length} demo account(s): ${demoUsers.map((u) => u.email).join(", ") || "none"}`);
  console.log("Real batches, trainees, and worksheets were left untouched.");
  await db.$disconnect();
  process.exit(0);
}

const passwordHash = await bcrypt.hash(PASSWORD, 10);

await db.user.upsert({
  where: { email: ADMIN_EMAIL },
  update: { name: "Demo Facilitator", role: "admin", active: true, passwordHash },
  create: { email: ADMIN_EMAIL, name: "Demo Facilitator", role: "admin", passwordHash },
});

// Put the demo trainee on a real batch so the schedule and worksheet tabs have content.
const batch = await db.batch.findFirst({ orderBy: { name: "asc" } });
if (!batch) {
  console.error('No batches found. Run the roster import first:\n  npm run import -- "SESSION LIST.xlsx"');
  await db.$disconnect();
  process.exit(1);
}

const trainee = await db.user.upsert({
  where: { email: TRAINEE_EMAIL },
  update: { name: "Demo Trainee", role: "trainee", active: true, passwordHash, batchId: batch.id },
  create: {
    email: TRAINEE_EMAIL,
    name: "Demo Trainee",
    role: "trainee",
    department: "DEMO",
    passwordHash,
    batchId: batch.id,
  },
});

// Give the trainee something to actually fill in, if The Mirror isn't already assigned.
const mirror = await db.worksheet.findFirst({ where: { title: "The Mirror" } });
let assigned = false;
if (mirror) {
  const existing = await db.worksheetAssignment.findFirst({
    where: { worksheetId: mirror.id, batchId: batch.id, timing: "pre" },
  });
  if (!existing) {
    await db.worksheetAssignment.create({
      data: { worksheetId: mirror.id, batchId: batch.id, timing: "pre" },
    });
    assigned = true;
  }
}

console.log(`Demo logins ready (password for both: ${PASSWORD})\n`);
console.log(`  ADMIN    ${ADMIN_EMAIL}`);
console.log(`  TRAINEE  ${TRAINEE_EMAIL}   → ${batch.name}, ${trainee.department ?? "—"}`);
console.log(`\nRequires DEV_SKIP_MAIL_VERIFY=true in .env for the admin login.`);
if (assigned) console.log(`Assigned "The Mirror" to ${batch.name} (pre) so the trainee has a worksheet to fill.`);
console.log(`\nWhen you're done:  node prisma/demo.mjs --remove`);

await db.$disconnect();
