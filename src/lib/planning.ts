import "server-only";
import { db } from "./db";
import { suggestNextSessionDate } from "./scheduling";

const DAY = 86400000;
const startOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

export type BatchPlan = {
  id: string;
  name: string;
  program: string;
  sessionCount: number;
  traineeCount: number;
  scheduledCount: number;
  /** Most recent session on or before today. */
  last: { index: number; date: Date; daysAgo: number } | null;
  /** Soonest session still in the future. */
  next: { index: number; date: Date; daysAway: number } | null;
  /** Conflict-free date for the first unscheduled slot, or null if none remain. */
  suggested: { index: number; date: Date; daysAway: number } | null;
  /** Other batches meeting on the same day as this batch's next session. */
  clashes: string[];
  /** What the facilitator should do about this batch, most urgent first. */
  status: "overdue" | "due-soon" | "on-track" | "unscheduled" | "complete";
};

// Gap the programme aims for between sessions. Past this, a batch reads as overdue.
export const TARGET_GAP_DAYS = 7;
const OVERDUE_AFTER_DAYS = 14;

export async function loadPlanning() {
  const batches = await db.batch.findMany({
    orderBy: [{ program: "asc" }, { name: "asc" }],
    include: {
      slots: { orderBy: { index: "asc" } },
      _count: { select: { trainees: true } },
    },
  });

  const today = startOfDay(new Date());

  // Which batches meet on which day — used to name clashes rather than just flag them.
  const dayOwners = new Map<string, string[]>();
  for (const b of batches) {
    for (const s of b.slots) {
      if (!s.scheduledDate || s.status === "completed") continue;
      const key = startOfDay(s.scheduledDate).toDateString();
      dayOwners.set(key, [...(dayOwners.get(key) ?? []), `${b.name} S${s.index}`]);
    }
  }

  // Days claimed by suggestions we've already handed out this pass, so each batch gets
  // a distinct proposal instead of all of them pointing at the same free day.
  const proposed: string[] = [];

  const plans: BatchPlan[] = batches.map((b) => {
    const dated = b.slots
      .filter((s) => s.scheduledDate)
      .map((s) => ({ index: s.index, date: startOfDay(s.scheduledDate!), status: s.status }))
      .sort((x, y) => x.date.getTime() - y.date.getTime());

    const past = dated.filter((s) => s.date <= today);
    const future = dated.filter((s) => s.date > today);

    const lastRow = past[past.length - 1] ?? null;
    const last = lastRow
      ? { index: lastRow.index, date: lastRow.date, daysAgo: Math.round((today.getTime() - lastRow.date.getTime()) / DAY) }
      : null;

    const nextRow = future[0] ?? null;
    const next = nextRow
      ? { index: nextRow.index, date: nextRow.date, daysAway: Math.round((nextRow.date.getTime() - today.getTime()) / DAY) }
      : null;

    const firstUnscheduled = b.slots.find((s) => s.status === "unscheduled");
    const suggestedDate = suggestNextSessionDate(batches, b.id, proposed);
    if (suggestedDate) proposed.push(startOfDay(suggestedDate).toDateString());
    const suggested =
      firstUnscheduled && suggestedDate
        ? {
            index: firstUnscheduled.index,
            date: startOfDay(suggestedDate),
            daysAway: Math.round((startOfDay(suggestedDate).getTime() - today.getTime()) / DAY),
          }
        : null;

    const clashes = next
      ? (dayOwners.get(next.date.toDateString()) ?? []).filter((label) => !label.startsWith(`${b.name} `))
      : [];

    const scheduledCount = b.slots.filter((s) => s.status !== "unscheduled").length;

    let status: BatchPlan["status"];
    if (!firstUnscheduled && !next) status = "complete";
    else if (next) status = next.daysAway <= 3 ? "due-soon" : "on-track";
    else if (last && last.daysAgo > OVERDUE_AFTER_DAYS) status = "overdue";
    else if (!last) status = "unscheduled";
    else status = "overdue";

    return {
      id: b.id,
      name: b.name,
      program: b.program,
      sessionCount: b.sessionCount,
      traineeCount: b._count.trainees,
      scheduledCount,
      last,
      next,
      suggested,
      clashes,
      status,
    };
  });

  // Most urgent first so the facilitator's eye lands on what needs booking.
  const rank: Record<BatchPlan["status"], number> = {
    overdue: 0,
    unscheduled: 1,
    "due-soon": 2,
    "on-track": 3,
    complete: 4,
  };
  plans.sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));

  return {
    plans,
    totals: {
      needsBooking: plans.filter((p) => p.status === "overdue" || p.status === "unscheduled").length,
      dueSoon: plans.filter((p) => p.status === "due-soon").length,
      withClashes: plans.filter((p) => p.clashes.length > 0).length,
      complete: plans.filter((p) => p.status === "complete").length,
    },
  };
}
