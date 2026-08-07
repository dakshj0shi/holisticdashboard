"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logEvent } from "@/lib/events";

export async function createTrainee(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const department = String(formData.get("department") ?? "").trim() || null;
  const batchId = String(formData.get("batchId") ?? "") || null;
  const password = String(formData.get("password") ?? "").trim();

  if (!name) return { ok: false, error: "Enter a name." };
  if (email) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return { ok: false, error: "A user with this email already exists." };
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  const trainee = await db.user.create({
    data: { name, email, department, batchId, passwordHash, role: "trainee" },
  });

  await logEvent(user.id, "trainee_create", trainee.name);
  revalidatePath("/admin/trainees");
  if (batchId) revalidatePath(`/admin/batches/${batchId}`);
  return { ok: true };
}

export async function updateTrainee(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const department = String(formData.get("department") ?? "").trim() || null;
  const batchId = String(formData.get("batchId") ?? "") || null;
  const newPassword = String(formData.get("password") ?? "").trim();
  const active = formData.get("active") === "on";

  if (!name) return { ok: false, error: "Enter a name." };
  if (email) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.id !== id) return { ok: false, error: "A user with this email already exists." };
  }

  const data: Record<string, unknown> = { name, email, department, batchId, active };
  if (newPassword) data.passwordHash = await bcrypt.hash(newPassword, 10);

  const trainee = await db.user.update({ where: { id }, data });

  await logEvent(user.id, "trainee_update", trainee.name);
  revalidatePath("/admin/trainees");
  if (batchId) revalidatePath(`/admin/batches/${batchId}`);
  return { ok: true };
}

export async function deactivateTrainee(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return;

  const trainee = await db.user.update({ where: { id }, data: { active: false } });
  await logEvent(user.id, "trainee_update", `${trainee.name} — deactivated`);
  revalidatePath("/admin/trainees");
  revalidatePath(`/admin/trainees/${id}`);
  redirect("/admin/trainees");
}

// Hard delete — removes the trainee and, via cascade in schema.prisma, every session
// record, worksheet submission/answer, email log, and login session tied to them.
// Irreversible, unlike deactivateTrainee above; the UI gates this behind a confirmation.
export async function deleteTrainee(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return;

  const trainee = await db.user.findUnique({ where: { id } });
  if (!trainee || trainee.role !== "trainee") return;

  await db.user.delete({ where: { id } });
  await logEvent(user.id, "trainee_update", `${trainee.name} — deleted permanently`);
  revalidatePath("/admin/trainees");
  if (trainee.batchId) revalidatePath(`/admin/batches/${trainee.batchId}`);
  redirect("/admin/trainees");
}
