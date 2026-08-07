"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logEvent } from "@/lib/events";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "admin" ? user : null;
}

export async function createWorksheet(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Not authorized." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) return { ok: false, error: "Enter a title." };

  const worksheet = await db.worksheet.create({ data: { title, description } });
  await logEvent(user.id, "worksheet_create", worksheet.title);
  revalidatePath("/admin/worksheets");
  return { ok: true, id: worksheet.id };
}

export async function addWorksheetItem(
  worksheetId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Not authorized." };

  const prompt = String(formData.get("prompt") ?? "").trim();
  const type = String(formData.get("type") ?? "likert5");
  if (!prompt) return { ok: false, error: "Enter a question/statement." };

  const count = await db.worksheetItem.count({ where: { worksheetId } });
  const optionsRaw = String(formData.get("options") ?? "").trim();
  const optionsJson =
    type === "mcq" && optionsRaw
      ? JSON.stringify(
          optionsRaw
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : null;

  await db.worksheetItem.create({
    data: {
      worksheetId,
      order: count + 1,
      prompt,
      type,
      minLabel: type === "likert5" ? "Strongly Disagree" : null,
      maxLabel: type === "likert5" ? "Strongly Agree" : null,
      optionsJson,
    },
  });

  revalidatePath(`/admin/worksheets/${worksheetId}`);
  return { ok: true };
}

export async function deleteWorksheetItem(itemId: string, worksheetId: string): Promise<void> {
  const user = await requireAdmin();
  if (!user) return;
  await db.worksheetItem.delete({ where: { id: itemId } });
  revalidatePath(`/admin/worksheets/${worksheetId}`);
}

export async function assignWorksheetToBatch(
  worksheetId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Not authorized." };

  const batchId = String(formData.get("batchId") ?? "");
  const timing = String(formData.get("timing") ?? "standalone");
  const dueDateStr = String(formData.get("dueDate") ?? "");
  if (!batchId) return { ok: false, error: "Choose a batch." };

  if (timing === "pre" || timing === "post") {
    const existing = await db.worksheetAssignment.findFirst({ where: { worksheetId, batchId, timing } });
    if (existing) return { ok: false, error: `This batch already has a "${timing}" assignment for this worksheet.` };
  }

  await db.worksheetAssignment.create({
    data: {
      worksheetId,
      batchId,
      timing,
      dueDate: dueDateStr ? new Date(dueDateStr) : null,
    },
  });

  await logEvent(user.id, "worksheet_assign", `${timing} → batch ${batchId}`);
  revalidatePath(`/admin/worksheets/${worksheetId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function submitWorksheet(
  assignmentId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "trainee") return { ok: false, error: "Not authorized." };

  const assignment = await db.worksheetAssignment.findUnique({
    where: { id: assignmentId },
    include: { worksheet: { include: { items: true } } },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  const existing = await db.worksheetSubmission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId: user.id } },
  });
  if (existing) return { ok: false, error: "You've already submitted this worksheet." };

  for (const item of assignment.worksheet.items) {
    if (item.required && !formData.get(`item_${item.id}`)) {
      return { ok: false, error: "Please answer every question before submitting." };
    }
  }

  try {
    await db.$transaction(async (tx) => {
      const submission = await tx.worksheetSubmission.create({ data: { assignmentId, userId: user.id } });
      for (const item of assignment.worksheet.items) {
        const raw = formData.get(`item_${item.id}`);
        if (raw === null) continue;
        await tx.worksheetAnswer.create({
          data: {
            submissionId: submission.id,
            itemId: item.id,
            valueInt: item.type === "likert5" ? parseInt(String(raw), 10) : null,
            valueText: item.type !== "likert5" ? String(raw) : null,
          },
        });
      }
    });
  } catch {
    return { ok: false, error: "You've already submitted this worksheet." };
  }

  await logEvent(user.id, "worksheet_submit", assignment.worksheet.title);
  revalidatePath("/dashboard");
  revalidatePath("/results");
  redirect("/dashboard");
}
