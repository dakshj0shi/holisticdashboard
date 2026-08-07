import "server-only";
import { db } from "./db";

const dayKey = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

export async function loadOverview() {
  const [batches, trainees, slotRows, worksheets, submissions, emailsSent] = await Promise.all([
    db.batch.findMany(),
    db.user.count({ where: { role: "trainee" } }),
    db.batchSessionSlot.groupBy({ by: ["batchId", "status"], _count: { _all: true } }),
    db.worksheet.count(),
    db.worksheetSubmission.count(),
    db.emailLog.count({ where: { status: { in: ["sent", "sent_no_sentfolder", "simulated"] } } }),
  ]);

  const missingEmail = await db.user.count({ where: { role: "trainee", email: null } });

  const statusBuckets = ["unscheduled", "scheduled", "rescheduled", "completed"].map((label) => ({
    label,
    count: slotRows.filter((r) => r.status === label).reduce((sum, r) => sum + r._count._all, 0),
  }));

  // Completion % per batch = completed slots / sessionCount — slot-level, not per-trainee.
  const perBatch = batches.map((b) => {
    const completed = slotRows.find((r) => r.batchId === b.id && r.status === "completed")?._count._all ?? 0;
    return { title: `${b.name} (${b.program})`, pct: b.sessionCount ? Math.round((completed / b.sessionCount) * 100) : 0 };
  });

  // Activity — last 14 days
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 13);
  const recent = await db.event.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
  const dayMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * 86400000);
    dayMap.set(dayKey(d), 0);
  }
  for (const e of recent) {
    const k = dayKey(e.createdAt);
    if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
  }
  const activity = [...dayMap.entries()].map(([date, count]) => ({ date, count }));

  return {
    totals: { batches: batches.length, trainees, worksheets, submissions, emailsSent, missingEmail },
    statusBuckets,
    perBatch,
    activity,
  };
}

// ---------- Trainees table ----------

export type TraineeRow = {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  batchName: string | null;
  active: boolean;
};

// Headline counts for the Trainees page — always unfiltered, so the stat tiles stay
// stable no matter which tab/filter the table itself is showing.
export async function loadTraineeCounts() {
  const [total, missingEmail] = await Promise.all([
    db.user.count({ where: { role: "trainee" } }),
    db.user.count({ where: { role: "trainee", email: null } }),
  ]);
  return { total, missingEmail };
}

export async function loadTrainees(opts: { q?: string; missingEmailOnly?: boolean }) {
  const where: Record<string, unknown> = { role: "trainee" };
  if (opts.missingEmailOnly) where.email = null;
  if (opts.q) {
    where.OR = [{ name: { contains: opts.q } }, { email: { contains: opts.q } }, { department: { contains: opts.q } }];
  }

  const users = await db.user.findMany({
    where,
    orderBy: { name: "asc" },
    include: { batch: { select: { name: true } } },
  });

  const rows: TraineeRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    department: u.department,
    batchName: u.batch?.name ?? null,
    active: u.active,
  }));

  return { rows, total: rows.length };
}
