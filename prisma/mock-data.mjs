// Populate BATCH A with realistic-looking worksheet responses so the results,
// banding, and pre/post comparison views have something meaningful to show.
//
//   node prisma/mock-data.mjs            # create
//   node prisma/mock-data.mjs --remove   # delete just the submissions it made
//
// Only touches WorksheetSubmission/WorksheetAnswer rows and the pre/post assignments
// for BATCH A. Never modifies users, batches, or the worksheet itself.
//
// The numbers are shaped, not random. These are negatively-framed statements, so
// agreement means the problem is felt: pre-programme answers sit high, post answers
// come down substantially. Everyone improves, by slightly different amounts, so the
// cohort reads as a clear success without looking synthetic.
// Deterministic — re-running gives the same picture.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BATCH = "BATCH A";
const WORKSHEET = "The Mirror";

// One row per respondent: 11 pre answers, then 11 post answers.
// Statement order matches The Mirror's seeded order.
const RESPONSES = [
  {
    name: "Dhanistha J",
    email: "dhanistha.trainee@jaipurrugs.com",
    pre:  [4, 5, 4, 4, 4, 5, 5, 4, 4, 4, 4], // 4.27 high
    post: [2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2], // 2.09 low
  },
  {
    name: "SHREYA CHAUDHARY",
    pre:  [4, 4, 5, 4, 4, 4, 4, 5, 4, 5, 4], // 4.27 high
    post: [2, 2, 3, 2, 2, 2, 3, 2, 2, 3, 2], // 2.27 low
  },
  {
    name: "LESHIKA VERMA",
    pre:  [4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4], // 3.91 high
    post: [2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2], // 1.91 low
  },
  {
    name: "LAVEEN ASWANI",
    // Improves solidly but lands mid-range — keeps the cohort from looking uniform.
    pre:  [5, 5, 4, 4, 4, 5, 5, 4, 4, 5, 4], // 4.45 high
    post: [3, 3, 2, 2, 2, 3, 3, 2, 3, 3, 3], // 2.64 medium
  },
  {
    name: "ADITI TUNGRIA",
    pre:  [4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4], // 3.91 high
    post: [2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 1.91 low
  },
  {
    name: "SHREYA NEHRA",
    pre:  [4, 4, 4, 4, 4, 4, 5, 4, 4, 5, 4], // 4.18 high
    post: [2, 2, 2, 2, 2, 2, 3, 2, 2, 3, 2], // 2.18 low
  },
];

const batch = await db.batch.findFirst({ where: { name: BATCH } });
const worksheet = await db.worksheet.findFirst({
  where: { title: WORKSHEET },
  include: { items: { orderBy: { order: "asc" } } },
});

if (!batch || !worksheet) {
  console.error(`Need both "${BATCH}" and the "${WORKSHEET}" worksheet to exist. Run the import first.`);
  await db.$disconnect();
  process.exit(1);
}

const likert = worksheet.items.filter((i) => i.type === "likert5");

async function assignmentFor(timing, daysAgo) {
  const existing = await db.worksheetAssignment.findFirst({
    where: { worksheetId: worksheet.id, batchId: batch.id, timing },
  });
  if (existing) return existing;
  const assignedAt = new Date();
  assignedAt.setDate(assignedAt.getDate() - daysAgo);
  return db.worksheetAssignment.create({
    data: { worksheetId: worksheet.id, batchId: batch.id, timing, assignedAt },
  });
}

if (process.argv.includes("--remove")) {
  const assignments = await db.worksheetAssignment.findMany({
    where: { worksheetId: worksheet.id, batchId: batch.id, timing: { in: ["pre", "post"] } },
    select: { id: true },
  });
  const ids = assignments.map((a) => a.id);
  const subs = await db.worksheetSubmission.findMany({ where: { assignmentId: { in: ids } }, select: { id: true } });
  await db.worksheetAnswer.deleteMany({ where: { submissionId: { in: subs.map((s) => s.id) } } });
  const { count } = await db.worksheetSubmission.deleteMany({ where: { assignmentId: { in: ids } } });
  console.log(`Removed ${count} mock submission(s) from ${BATCH}. Assignments and users left in place.`);
  await db.$disconnect();
  process.exit(0);
}

const pre = await assignmentFor("pre", 45);
const post = await assignmentFor("post", 5);

let created = 0;
let skippedMissing = [];

for (const r of RESPONSES) {
  // Match by email when given (the demo trainee), otherwise by roster name.
  const user = r.email
    ? await db.user.findUnique({ where: { email: r.email } })
    : await db.user.findFirst({ where: { name: r.name, batchId: batch.id, role: "trainee" } });

  if (!user) {
    skippedMissing.push(r.name);
    continue;
  }

  for (const [assignment, values, daysAgo] of [
    [pre, r.pre, 44],
    [post, r.post, 4],
  ]) {
    const already = await db.worksheetSubmission.findUnique({
      where: { assignmentId_userId: { assignmentId: assignment.id, userId: user.id } },
    });
    if (already) continue;

    const submittedAt = new Date();
    submittedAt.setDate(submittedAt.getDate() - daysAgo);

    await db.worksheetSubmission.create({
      data: {
        assignmentId: assignment.id,
        userId: user.id,
        submittedAt,
        answers: {
          create: likert.map((item, i) => ({ itemId: item.id, valueInt: values[i] ?? 3 })),
        },
      },
    });
    created++;
  }

  const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
  const band = (v) => (v < 2.5 ? "low" : v < 3.5 ? "medium" : "high");
  console.log(`  ${r.name.padEnd(18)} pre ${avg(r.pre)} (${band(+avg(r.pre))})  →  post ${avg(r.post)} (${band(+avg(r.post))})`);
}

console.log(`\nCreated ${created} submission(s) across pre and post for ${BATCH}.`);
if (skippedMissing.length) console.log(`Not found on the roster, skipped: ${skippedMissing.join(", ")}`);

const all = RESPONSES.flatMap((r) => [...r.pre, ...r.post]);
const preAll = RESPONSES.flatMap((r) => r.pre);
const postAll = RESPONSES.flatMap((r) => r.post);
const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`\nGroup pre  ${m(preAll).toFixed(2)}  →  group post ${m(postAll).toFixed(2)}   (${(m(postAll) - m(preAll)).toFixed(2)} change)`);
console.log(`Overall mean across all ${all.length} answers: ${m(all).toFixed(2)}`);

await db.$disconnect();
