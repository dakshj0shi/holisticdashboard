"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logEvent } from "@/lib/events";

function requireAdmin(user: { role: string } | null) {
  if (!user || user.role !== "admin") throw new Error("Not authorized.");
}

export async function createBatch(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  const name = String(formData.get("name") ?? "").trim();
  const program = String(formData.get("program") ?? "founders-mentality");
  const sessionCount = parseInt(String(formData.get("sessionCount") ?? "0"), 10);

  if (!name) return { ok: false, error: "Enter a batch name." };
  if (!sessionCount || sessionCount < 1 || sessionCount > 30)
    return { ok: false, error: "Session count must be between 1 and 30." };

  const existing = await db.batch.findUnique({ where: { program_name: { program, name } } });
  if (existing) return { ok: false, error: "A batch with this name already exists in this program." };

  const batch = await db.batch.create({
    data: {
      name,
      program,
      sessionCount,
      slots: { create: Array.from({ length: sessionCount }, (_, i) => ({ index: i + 1 })) },
    },
  });

  await logEvent(user.id, "batch_create", `${batch.name} (${batch.program}, ${sessionCount} sessions)`);
  revalidatePath("/admin/batches");
  return { ok: true };
}

export async function updateBatch(
  batchId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  requireAdmin(user);

  const name = String(formData.get("name") ?? "").trim();
  const sessionCount = parseInt(String(formData.get("sessionCount") ?? "0"), 10);
  const facilitatorIdRaw = formData.get("facilitatorId");
  const facilitatorId = facilitatorIdRaw === null ? undefined : String(facilitatorIdRaw) || null;
  if (!name) return { ok: false, error: "Enter a batch name." };

  if (facilitatorId) {
    const facilitator = await db.user.findUnique({ where: { id: facilitatorId } });
    if (!facilitator || facilitator.role !== "admin") return { ok: false, error: "Choose a valid facilitator." };
  }

  const batch = await db.batch.findUnique({ where: { id: batchId }, include: { slots: true } });
  if (!batch) return { ok: false, error: "Batch not found." };

  if (sessionCount && sessionCount !== batch.sessionCount) {
    if (sessionCount > batch.sessionCount) {
      const toAdd = Array.from({ length: sessionCount - batch.sessionCount }, (_, i) => ({
        batchId,
        index: batch.sessionCount + i + 1,
      }));
      await db.batchSessionSlot.createMany({ data: toAdd });
    } else {
      // Only ever drop trailing slots that are still untouched — never destroy scheduled/completed history.
      const trailing = batch.slots
        .filter((s) => s.index > sessionCount)
        .filter((s) => s.status === "unscheduled");
      if (trailing.length < batch.slots.filter((s) => s.index > sessionCount).length) {
        return { ok: false, error: "Can't shrink below a session that's already scheduled or completed." };
      }
      await db.batchSessionSlot.deleteMany({ where: { id: { in: trailing.map((s) => s.id) } } });
    }
  }

  await db.batch.update({
    where: { id: batchId },
    data: { name, sessionCount: sessionCount || batch.sessionCount, facilitatorId },
  });
  await logEvent(user!.id, "batch_update", `${name}`);
  revalidatePath("/admin/batches");
  revalidatePath(`/admin/batches/${batchId}`);
  return { ok: true };
}

export async function updateBatchDescription(
  batchId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  const description = String(formData.get("description") ?? "").trim() || null;

  const batch = await db.batch.update({ where: { id: batchId }, data: { description } });
  await logEvent(user.id, "batch_update", `${batch.name} — description updated`);
  revalidatePath(`/admin/batches/${batchId}`);
  return { ok: true };
}

// Hard delete — schema.prisma cascades remove this batch's session slots and worksheet
// assignments (and their submissions/answers) automatically; trainees in the batch are
// NOT deleted, only unassigned (User.batchId is set to null). Irreversible for the
// schedule/assignment history, so the UI gates this behind a confirmation.
export async function deleteBatch(batchId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  const batch = await db.batch.findUnique({ where: { id: batchId } });
  if (!batch) return { ok: false, error: "Batch not found." };

  await db.batch.delete({ where: { id: batchId } });
  await logEvent(user.id, "batch_update", `${batch.name} — deleted permanently`);
  revalidatePath("/admin/batches");
  revalidatePath("/admin/trainees");
  redirect("/admin/batches");
}

export async function loadBatches() {
  return db.batch.findMany({
    orderBy: [{ program: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { trainees: true } },
      slots: { orderBy: { index: "asc" } },
      facilitator: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function loadBatch(batchId: string) {
  return db.batch.findUnique({
    where: { id: batchId },
    include: {
      trainees: { orderBy: { name: "asc" }, include: { sessionRecords: true } },
      slots: { orderBy: { index: "asc" } },
      facilitator: { select: { id: true, name: true, email: true } },
    },
  });
}

// Distinct program names already in use, so the batch form can offer them
// as suggestions while still accepting a brand-new one (program is a plain
// String column — no migration needed to add a program).
export async function loadPrograms() {
  const rows = await db.batch.findMany({ select: { program: true }, distinct: ["program"] });
  return rows.map((r) => r.program).sort();
}

// Admins who can be assigned as a batch facilitator.
export async function loadFacilitatorOptions() {
  return db.user.findMany({
    where: { role: "admin", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}

// New facilitators are just admins — they log in with their real mailbox password like
// any other admin (see auth.ts), so no password is set here. batchId is only used to
// revalidate the page this was submitted from.
export async function createFacilitator(
  batchId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  requireAdmin(user);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name || !email) return { ok: false, error: "Enter a name and email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Not a valid email." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A user with this email already exists." };

  await db.user.create({ data: { name, email, role: "admin", active: true } });
  await logEvent(user!.id, "facilitator_create", `${name} (${email})`);
  revalidatePath(`/admin/batches/${batchId}`);
  return { ok: true };
}
