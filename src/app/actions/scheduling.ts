"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, getCurrentAdminMailCredential } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { scheduleSlot, rescheduleSlot, sendSlotSummary } from "@/lib/scheduling";

async function requireAdminMailContext() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  const cred = await getCurrentAdminMailCredential();
  // In DEV_SKIP_MAIL_VERIFY mode there's no real mailbox credential on the session —
  // mailer.ts falls back to its simulated/console path whenever MAIL_HOST is unset,
  // so an empty password is harmless there and never used when a real host is configured.
  return { id: user.id, email: cred?.email ?? user.email, password: cred?.password ?? "" };
}

export async function scheduleSessionSlot(
  slotId: string,
  dateStr: string,
  force?: boolean,
): Promise<{ ok: boolean; needsConfirm?: boolean; error?: string }> {
  const admin = await requireAdminMailContext();
  if (!admin) return { ok: false, error: "Not authorized." };

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return { ok: false, error: "Enter a valid date." };

  const result = await scheduleSlot(slotId, date, admin, force);
  if (!result.ok) {
    if ("needsConfirm" in result) return { ok: false, needsConfirm: true };
    return { ok: false, error: result.error };
  }

  const slot = await db.batchSessionSlot.findUnique({ where: { id: slotId } });
  await logEvent(admin.id, "session_schedule", `Session ${slot?.index} → ${date.toDateString()}`);
  if (slot) revalidatePath(`/admin/batches/${slot.batchId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function rescheduleSessionSlot(
  slotId: string,
  dateStr: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdminMailContext();
  if (!admin) return { ok: false, error: "Not authorized." };

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return { ok: false, error: "Enter a valid date." };

  const result = await rescheduleSlot(slotId, date, admin);
  if (!result.ok) return { ok: false, error: "error" in result ? result.error : "Could not reschedule." };

  const slot = await db.batchSessionSlot.findUnique({ where: { id: slotId } });
  await logEvent(admin.id, "session_reschedule", `Session ${slot?.index} → ${date.toDateString()}`);
  if (slot) revalidatePath(`/admin/batches/${slot.batchId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function sendSessionSummary(
  slotId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdminMailContext();
  if (!admin) return { ok: false, error: "Not authorized." };

  const summary = String(formData.get("summary") ?? "").trim();
  if (!summary) return { ok: false, error: "Write a summary before sending." };

  const result = await sendSlotSummary(slotId, summary, admin);
  if (!result.ok) return { ok: false, error: result.error };

  const slot = await db.batchSessionSlot.findUnique({ where: { id: slotId } });
  await logEvent(admin.id, "session_complete", `Session ${slot?.index} summary sent`);
  if (slot) revalidatePath(`/admin/batches/${slot.batchId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markSessionComplete(userId: string, slotId: string, completed: boolean) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  await db.traineeSessionRecord.upsert({
    where: { userId_slotId: { userId, slotId } },
    update: { completed, completedAt: completed ? new Date() : null },
    create: { userId, slotId, completed, completedAt: completed ? new Date() : null },
  });

  await logEvent(user.id, "session_complete", `${completed ? "Marked complete" : "Marked incomplete"}`);
  const slot = await db.batchSessionSlot.findUnique({ where: { id: slotId } });
  if (slot) revalidatePath(`/admin/batches/${slot.batchId}`);
  return { ok: true };
}

export async function saveObservation(userId: string, slotId: string, observation: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  await db.traineeSessionRecord.upsert({
    where: { userId_slotId: { userId, slotId } },
    update: { observation },
    create: { userId, slotId, observation, completed: false },
  });

  await logEvent(user.id, "observation_save", "Saved session observation");
  const slot = await db.batchSessionSlot.findUnique({ where: { id: slotId } });
  if (slot) revalidatePath(`/admin/batches/${slot.batchId}`);
  return { ok: true };
}

export async function saveOneOnOneNote(userId: string, note: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  const trainee = await db.user.update({ where: { id: userId }, data: { oneOnOneNote: note } });
  await logEvent(user.id, "observation_save", `Saved 1:1 note for ${trainee.name}`);
  if (trainee.batchId) revalidatePath(`/admin/batches/${trainee.batchId}`);
  return { ok: true };
}
