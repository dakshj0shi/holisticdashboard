import "server-only";
import { db } from "./db";

// Batch + schedule + this trainee's own completion records. Shared by the trainee
// Overview and Schedule tabs, which need the same shape.
export async function loadTraineeProgram(userId: string) {
  const trainee = await db.user.findUnique({
    where: { id: userId },
    include: {
      batch: { include: { slots: { orderBy: { index: "asc" } } } },
      sessionRecords: true,
    },
  });
  if (!trainee) return null;

  const slots = trainee.batch?.slots ?? [];
  const records = trainee.sessionRecords;
  const isDone = (slotId: string) => records.find((r) => r.slotId === slotId)?.completed ?? false;

  return {
    trainee,
    batch: trainee.batch,
    slots,
    records,
    isDone,
    // "Next" = earliest scheduled session this trainee hasn't completed — slot status
    // only tracks scheduling, not per-trainee completion, so records matter here.
    nextSlot: slots.find((s) => s.scheduledDate && !isDone(s.id)) ?? null,
    completedCount: records.filter((r) => r.completed).length,
  };
}

// Worksheet assignments for this trainee's batch, split by whether they've submitted.
export async function loadTraineeWorksheets(userId: string, batchId: string | null) {
  if (!batchId) return { pending: [], done: [] };

  const assignments = await db.worksheetAssignment.findMany({
    where: { batchId },
    include: { worksheet: true, submissions: { where: { userId } } },
    orderBy: { assignedAt: "desc" },
  });

  return {
    pending: assignments.filter((a) => a.submissions.length === 0),
    done: assignments.filter((a) => a.submissions.length > 0),
  };
}
