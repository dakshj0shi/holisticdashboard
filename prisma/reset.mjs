// Wipe ALL data and rebuild a clean, production-ready database.
//
//   node prisma/reset.mjs --yes
//
// Leaves behind: the "The Mirror" worksheet (real programme content) and nothing else.
// No users, no batches, no schedules, no email logs. Add real people with
// prisma/add-admin.mjs and prisma/set-trainees.mjs, and the roster with
// prisma/import-sessions.mjs.
//
// Destructive on purpose — refuses to run without --yes.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MIRROR_STATEMENTS = [
  "The organization is losing clarity on our unique mission, and people no longer find this motivating",
  "We are losing our differentiation and in danger of becoming just another company",
  "We are not embracing turbulence and no longer experimenting and building new business models ahead of competition",
  'Employees at the front line of our business no longer feel fully empowered to do "whatever it takes" to help our most important customers',
  'We are no longer a true meritocracy that fully celebrates the "doers" and rewards "results"',
  'We are not "outward-focused" on innovation—this is now more of a staff function and no longer closely linked to what our customers need',
  'We have too many "bureaucrats," who expect to retain all of last year\'s resources without clarity on how these investments support growth',
  "We are unable to make and act upon key decisions faster than our competitors; speed is not a source of competitive advantage for us",
  'We are in danger of becoming a company of "energy vampires" (i.e., people who block progress on action or decision making and refuse to take personal accountability for results)',
  "Our biggest barriers to growth and future success are much more internal than external; our fate is in our hands",
  "Our main competitor in five years will be a different competitor than it is today",
];

if (!process.argv.includes("--yes")) {
  console.error("Refusing to wipe the database without --yes.\n\n  node prisma/reset.mjs --yes\n");
  process.exit(1);
}

// Deletion order matters: children before parents (SQLite won't cascade for us here).
const before = {
  users: await db.user.count(),
  batches: await db.batch.count(),
  worksheets: await db.worksheet.count(),
  emailLogs: await db.emailLog.count(),
};

await db.worksheetAnswer.deleteMany();
await db.worksheetSubmission.deleteMany();
await db.worksheetAssignment.deleteMany();
await db.worksheetItem.deleteMany();
await db.worksheet.deleteMany();
await db.emailLog.deleteMany();
await db.traineeSessionRecord.deleteMany();
await db.batchSessionSlot.deleteMany();
await db.event.deleteMany();
await db.session.deleteMany();
await db.user.deleteMany();
await db.batch.deleteMany();

console.log(
  `Wiped: ${before.users} users, ${before.batches} batches, ${before.worksheets} worksheets, ${before.emailLogs} email logs.`,
);

const mirror = await db.worksheet.create({
  data: {
    title: "The Mirror",
    description:
      "Culture is not what is written on the walls, it is what we repeatedly choose in our daily work. This reflection helps us understand those choices through your lived experience.",
    items: {
      create: MIRROR_STATEMENTS.map((prompt, i) => ({
        order: i + 1,
        prompt,
        type: "likert5",
        minLabel: "Strongly Disagree",
        maxLabel: "Strongly Agree",
      })),
    },
  },
});

console.log(`Recreated "The Mirror" (${MIRROR_STATEMENTS.length} statements, id ${mirror.id}).`);
console.log("\nClean database ready. Next steps:");
console.log("  1. node prisma/add-admin.mjs <email> <Full Name>       # one per facilitator");
console.log('  2. node prisma/import-sessions.mjs "path/to/SESSION LIST.xlsx"   # roster');
console.log("  3. node prisma/set-trainees.mjs people.csv             # emails + passwords");

await db.$disconnect();
