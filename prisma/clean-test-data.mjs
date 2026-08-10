// One-time cleanup: strips testing/demo artifacts created while building this app,
// without touching the real roster imported from SESSION LIST.xlsx.
//
//   node prisma/clean-test-data.mjs --yes
//
// Removes:
//   - All EmailLog rows (100% test sends from development — scheduling/reschedule/
//     summary emails triggered while verifying features, never real programme mail)
//   - The 3 "The Mirror" assignments on BATCH A created for demoing scoring (pre/post/
//     standalone), and their submissions/answers — including 12 fabricated Mirror
//     scores attributed to 6 real trainees who never actually answered them
//   - BATCH A's facilitator assignment and description (set during feature testing,
//     not a real decision)
//   - BATCH A session slots S1, S3, S4: revert fake "completed" status, fake summary
//     text (e.g. "zscdsfnghm"), fake facilitator snapshot, and stale notify markers —
//     their REAL scheduled dates (from the Excel import) are left untouched
//   - BATCH A session slots S5, S6, S7: revert entirely to unscheduled — these dates
//     were never in the source spreadsheet, purely testing
//
// Leaves untouched: all 34 real trainees, all 6 real batches, the Mirror worksheet
// definition, all 4 real admin accounts, the "BATCH 1 / pre" Mirror assignment (no
// fake submissions attached to it, so there's nothing to distinguish it from a real
// assignment), and every Event/audit-log row (harmless history, not user-facing data).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

if (!process.argv.includes("--yes")) {
  console.error("Refusing to run without --yes.\n\n  node prisma/clean-test-data.mjs --yes\n");
  process.exit(1);
}

const batchA = await db.batch.findFirst({ where: { name: "BATCH A" } });
if (!batchA) {
  console.error('BATCH A not found — nothing to clean.');
  process.exit(1);
}

// 1. Email logs — every row is a test send.
const emailCount = await db.emailLog.count();
await db.emailLog.deleteMany();
console.log(`Deleted ${emailCount} EmailLog row(s).`);

// 2. Demo worksheet assignments on BATCH A (and cascade their submissions/answers).
const demoAssignments = await db.worksheetAssignment.findMany({
  where: { batchId: batchA.id, timing: { in: ["pre", "post", "standalone"] } },
});
for (const a of demoAssignments) {
  const subs = await db.worksheetSubmission.findMany({ where: { assignmentId: a.id }, select: { id: true } });
  await db.worksheetAnswer.deleteMany({ where: { submissionId: { in: subs.map((s) => s.id) } } });
  await db.worksheetSubmission.deleteMany({ where: { assignmentId: a.id } });
}
const { count: assignmentCount } = await db.worksheetAssignment.deleteMany({
  where: { id: { in: demoAssignments.map((a) => a.id) } },
});
console.log(`Deleted ${assignmentCount} demo worksheet assignment(s) on BATCH A (with their submissions/answers).`);

// 3. Batch-level demo facilitator + description.
await db.batch.update({ where: { id: batchA.id }, data: { facilitatorId: null, description: null } });
console.log("Cleared BATCH A's demo facilitator assignment and description.");

// 4. Session slots — revert fake completions/schedules, keep real Excel-sourced dates.
const REAL_DATED = [1, 3, 4]; // real scheduledDate from the Excel import — keep the date, strip the fake completion
const FAKE_SCHEDULED = [5, 6, 7]; // no source in the Excel — these dates only exist from testing

for (const index of REAL_DATED) {
  await db.batchSessionSlot.updateMany({
    where: { batchId: batchA.id, index },
    data: {
      status: "scheduled",
      summary: null,
      facilitatorId: null,
      notifiedAt: null,
      notifiedForDate: null,
      rescheduledFrom: null,
    },
  });
}
console.log(`Reverted fake completions on real-dated sessions S${REAL_DATED.join(", S")} — kept their real dates.`);

for (const index of FAKE_SCHEDULED) {
  await db.batchSessionSlot.updateMany({
    where: { batchId: batchA.id, index },
    data: {
      status: "unscheduled",
      scheduledDate: null,
      summary: null,
      facilitatorId: null,
      notifiedAt: null,
      notifiedForDate: null,
      rescheduledFrom: null,
    },
  });
}
console.log(`Reverted S${FAKE_SCHEDULED.join(", S")} to fully unscheduled — no real date existed for these.`);

// 5. Empty worksheets (0 items, 0 assignments) — a real worksheet always has content;
// anything with neither is a stray from testing the builder form.
const junkWorksheets = await db.worksheet.findMany({
  where: { items: { none: {} }, assignments: { none: {} } },
});
for (const w of junkWorksheets) await db.worksheet.delete({ where: { id: w.id } });
if (junkWorksheets.length) {
  console.log(`Deleted ${junkWorksheets.length} empty test worksheet(s): ${junkWorksheets.map((w) => w.title).join(", ")}`);
}

console.log("\nDone. Real roster, batches, admins, and the Mirror worksheet definition were not touched.");
await db.$disconnect();
