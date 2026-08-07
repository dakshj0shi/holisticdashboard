// Correct session dates that were typed with the wrong year in the tracker
// spreadsheet ("17/07/27" where "17/07/26" was meant).
//
//   node prisma/fix-session-years.mjs --dry-run
//   node prisma/fix-session-years.mjs
//
// Only shifts a date when doing so keeps the batch's sessions in ascending order.
// A later-dated session that is genuinely booked far ahead is left alone and
// reported, because moving it would put session 2 before session 1.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const FROM_YEAR = 2027;
const TO_YEAR = 2026;

const fmt = (d) => d.toLocaleDateString("en-GB");

const batches = await db.batch.findMany({
  include: { slots: { orderBy: { index: "asc" } } },
  orderBy: { name: "asc" },
});

const changed = [];
const skipped = [];

const shiftYear = (d) => {
  const c = new Date(d);
  c.setFullYear(TO_YEAR);
  return c;
};

for (const batch of batches) {
  const dated = batch.slots.filter((s) => s.scheduledDate);

  // Evaluate every candidate together: a slot's ordering must be judged against the
  // other slots' *corrected* dates, not their originals — otherwise a later session
  // looks out of order purely because an earlier typo hasn't been applied yet.
  const proposed = new Map(
    dated.map((s) => [s.id, s.scheduledDate.getFullYear() === FROM_YEAR ? shiftYear(s.scheduledDate) : s.scheduledDate]),
  );

  for (const slot of dated) {
    if (slot.scheduledDate.getFullYear() !== FROM_YEAR) continue;

    const shifted = proposed.get(slot.id);
    const brokenBy = dated
      .filter((s) => s.id !== slot.id)
      .map((s) => ({ index: s.index, date: proposed.get(s.id), original: s.scheduledDate }))
      .find((o) => (o.index < slot.index && o.date > shifted) || (o.index > slot.index && o.date < shifted));

    if (brokenBy) {
      // Keep this one as-is, and stop proposing a shift for it so later slots in the
      // same batch are judged against the date that will actually be stored.
      proposed.set(slot.id, slot.scheduledDate);
      skipped.push({
        batch: batch.name,
        index: slot.index,
        date: slot.scheduledDate,
        would: shifted,
        clashIndex: brokenBy.index,
        clashDate: brokenBy.date,
      });
      continue;
    }

    changed.push({ batch: batch.name, index: slot.index, from: slot.scheduledDate, to: shifted, id: slot.id });
  }
}

if (!changed.length && !skipped.length) {
  console.log(`No sessions dated ${FROM_YEAR} found — nothing to do.`);
  await db.$disconnect();
  process.exit(0);
}

for (const c of changed) {
  console.log(`  ${c.batch.padEnd(8)} S${c.index}   ${fmt(c.from)}  ->  ${fmt(c.to)}`);
  if (!dryRun) await db.batchSessionSlot.update({ where: { id: c.id }, data: { scheduledDate: c.to } });
}

console.log(`\n${dryRun ? "[dry run] " : ""}${changed.length} session date(s) corrected to ${TO_YEAR}.`);

if (skipped.length) {
  console.log(`\nLeft unchanged (${skipped.length}) — shifting these would put sessions out of order:`);
  for (const s of skipped) {
    console.log(`  ${s.batch} S${s.index} is ${fmt(s.date)}. Moving it to ${fmt(s.would)} would place it`);
    console.log(`    ${s.would < s.clashDate ? "before" : "after"} S${s.clashIndex} (${fmt(s.clashDate)}). Looks like a real forward booking, not a typo.`);
  }
}

if (dryRun) console.log("\nNothing written. Re-run without --dry-run to apply.");

await db.$disconnect();
