"use server";

import { getCurrentUser } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { db } from "@/lib/db";
import type { ImportSummary } from "@/lib/xlsxImport";
import { runImport as runImportCore } from "../../../prisma/xlsxImportCore.mjs";
import { revalidatePath } from "next/cache";

export async function runImportAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; summary?: ImportSummary }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an .xlsx file to import." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const summary: ImportSummary = await runImportCore(db, buffer);

  await logEvent(
    user.id,
    "import_run",
    `${file.name}: ${summary.batchesImported} batches, ${summary.traineesImported} new trainees`,
  );

  revalidatePath("/admin/batches");
  revalidatePath("/admin/trainees");
  revalidatePath("/admin");
  return { ok: true, summary };
}
