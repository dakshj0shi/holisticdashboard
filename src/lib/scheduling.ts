import "server-only";
import { db } from "./db";
import { sendMailAsAdmin } from "./mailer";
import { DEFAULTS, renderTemplate, type Template, type TemplateKind } from "./emailTemplates";

// The admin-edited wording for a send, falling back to the built-in default when this
// template has never been touched.
async function loadTemplate(kind: TemplateKind): Promise<Template> {
  const row = await db.emailTemplate.findUnique({ where: { key: kind } });
  return row ?? DEFAULTS[kind];
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

async function notifyBatch(opts: {
  slot: { id: string; index: number; batchId: string };
  batchName: string;
  date: Date;
  kind: "session_scheduled" | "session_rescheduled";
  adminUserId: string;
  adminEmail: string;
  adminPassword: string;
}) {
  const { slot, batchName, date, kind, adminUserId, adminEmail, adminPassword } = opts;
  const trainees = await db.user.findMany({ where: { batchId: slot.batchId, role: "trainee", active: true } });

  const tpl = await loadTemplate(kind);

  for (const t of trainees) {
    const { subject, html, text } = renderTemplate(tpl, {
      name: t.name,
      batch: batchName,
      session: String(slot.index),
      date: formatDate(date),
    });

    await sendMailAsAdmin({
      adminEmail,
      adminPassword,
      sentByUserId: adminUserId,
      toUserId: t.id,
      kind,
      batchId: slot.batchId,
      slotId: slot.id,
      mail: { to: t.email ?? "", subject, html, text },
    });
  }

  await db.batchSessionSlot.update({
    where: { id: slot.id },
    data: { notifiedAt: new Date(), notifiedForDate: date },
  });
}

// Any other slot (any batch, including this one) already scheduled/rescheduled for the
// same calendar day blocks the booking — this is the hard backstop behind the "suggested
// date" nudge, which only steers new bookings away from conflicts but doesn't enforce it.
async function findSchedulingConflict(date: Date, excludeSlotId: string) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const conflict = await db.batchSessionSlot.findFirst({
    where: {
      id: { not: excludeSlotId },
      status: { in: ["scheduled", "rescheduled"] },
      scheduledDate: { gte: dayStart, lt: dayEnd },
    },
    include: { batch: true },
  });

  return conflict ? `${conflict.batch.name} already has Session ${conflict.index} on this date — pick another.` : null;
}

export type ScheduleResult = { ok: true } | { ok: false; needsConfirm: true } | { ok: false; error: string };

export async function scheduleSlot(
  slotId: string,
  date: Date,
  admin: { id: string; email: string; password: string },
  force = false,
): Promise<ScheduleResult> {
  const slot = await db.batchSessionSlot.findUnique({ where: { id: slotId }, include: { batch: true } });
  if (!slot) return { ok: false, error: "Session not found." };

  const conflict = await findSchedulingConflict(date, slotId);
  if (conflict) return { ok: false, error: conflict };

  if (!force && slot.notifiedAt && slot.notifiedForDate?.getTime() === date.getTime()) {
    return { ok: false, needsConfirm: true };
  }

  await db.batchSessionSlot.update({
    where: { id: slotId },
    data: { scheduledDate: date, status: "scheduled" },
  });

  await notifyBatch({
    slot,
    batchName: slot.batch.name,
    date,
    kind: "session_scheduled",
    adminUserId: admin.id,
    adminEmail: admin.email,
    adminPassword: admin.password,
  });

  return { ok: true };
}

export async function rescheduleSlot(
  slotId: string,
  newDate: Date,
  admin: { id: string; email: string; password: string },
): Promise<ScheduleResult> {
  const slot = await db.batchSessionSlot.findUnique({ where: { id: slotId }, include: { batch: true } });
  if (!slot) return { ok: false, error: "Session not found." };

  const conflict = await findSchedulingConflict(newDate, slotId);
  if (conflict) return { ok: false, error: conflict };

  await db.batchSessionSlot.update({
    where: { id: slotId },
    data: { scheduledDate: newDate, status: "rescheduled", rescheduledFrom: slot.scheduledDate },
  });

  await notifyBatch({
    slot,
    batchName: slot.batch.name,
    date: newDate,
    kind: "session_rescheduled",
    adminUserId: admin.id,
    adminEmail: admin.email,
    adminPassword: admin.password,
  });

  return { ok: true };
}

export type SendSummaryResult = { ok: true } | { ok: false; error: string };

// Sends the admin's written recap to every trainee in the batch and marks the
// session completed — this is the only place a slot's status becomes "completed".
export async function sendSlotSummary(
  slotId: string,
  summary: string,
  admin: { id: string; email: string; password: string },
): Promise<SendSummaryResult> {
  const slot = await db.batchSessionSlot.findUnique({ where: { id: slotId }, include: { batch: true } });
  if (!slot) return { ok: false, error: "Session not found." };
  if (slot.status === "unscheduled") return { ok: false, error: "Schedule this session before sending a summary." };

  const trainees = await db.user.findMany({ where: { batchId: slot.batchId, role: "trainee", active: true } });
  const tpl = await loadTemplate("session_summary");

  for (const t of trainees) {
    const { subject, html, text } = renderTemplate(tpl, {
      name: t.name,
      batch: slot.batch.name,
      session: String(slot.index),
      summary,
    });

    await sendMailAsAdmin({
      adminEmail: admin.email,
      adminPassword: admin.password,
      sentByUserId: admin.id,
      toUserId: t.id,
      kind: "session_summary",
      batchId: slot.batchId,
      slotId: slot.id,
      mail: { to: t.email ?? "", subject, html, text },
    });
  }

  // Snapshot who was facilitating the batch at the moment this session completed —
  // preserved even if the batch's facilitator changes later, so past sessions still
  // credit whoever actually taught them. Never overwrites an existing snapshot (e.g.
  // on a resend), so a manually-corrected value here is never clobbered.
  await db.batchSessionSlot.update({
    where: { id: slotId },
    data: { summary, status: "completed", facilitatorId: slot.facilitatorId ?? slot.batch.facilitatorId },
  });
  return { ok: true };
}

// Suggested date for a batch's next unscheduled session: 7 days after its own
// last-scheduled session, nudged forward a day at a time if that date collides
// with another batch's session.
// `alsoBusy` lets a caller reserve days that aren't in the database yet — the planning
// table uses it so three idle batches don't all get proposed the same free date.
export function suggestNextSessionDate(
  batches: { id: string; slots: { status: string; scheduledDate: Date | null }[] }[],
  targetBatchId: string,
  alsoBusy: string[] = [],
): Date | null {
  const target = batches.find((b) => b.id === targetBatchId);
  if (!target) return null;
  if (!target.slots.some((s) => s.status === "unscheduled")) return null;

  // Base the suggestion on the batch's latest session OR today, whichever is later —
  // otherwise a batch that fell behind gets suggested a date in the past.
  const ownDates = target.slots.map((s) => s.scheduledDate).filter((d): d is Date => d != null);
  const latestOwn = ownDates.length ? Math.max(...ownDates.map((d) => d.getTime())) : 0;
  const base = new Date(Math.max(latestOwn, Date.now()));

  const busyDays = new Set([
    ...batches
      .flatMap((b) => b.slots)
      .map((s) => s.scheduledDate)
      .filter((d): d is Date => d != null)
      .map((d) => d.toDateString()),
    ...alsoBusy,
  ]);

  const candidate = new Date(base);
  candidate.setDate(candidate.getDate() + 7);
  for (let i = 0; i < 30 && busyDays.has(candidate.toDateString()); i++) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}
