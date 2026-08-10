"use server";

import * as XLSX from "xlsx";
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

export type RosterImportSummary = { updated: number; created: number; warnings: string[] };

// Round-trips with GET /api/export/roster?batchId=... — same column shape (Name, Email,
// Department, S1..Sn, "1:1 Note"), scoped to ONE batch (no batch-label rows to parse,
// unlike the full tracker importer above). A blank Sn cell leaves that session's
// existing record untouched rather than resetting it to incomplete.
export async function importBatchRoster(
  batchId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; summary?: RosterImportSummary }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an .xlsx file to import." };

  const batch = await db.batch.findUnique({ where: { id: batchId }, include: { slots: true, trainees: true } });
  if (!batch) return { ok: false, error: "Batch not found." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { ok: false, error: "The file has no sheets." };
  const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const summary: RosterImportSummary = { updated: 0, created: 0, warnings: [] };

  for (const [i, row] of sheetRows.entries()) {
    const name = String(row["Name"] ?? "").trim();
    if (!name) {
      summary.warnings.push(`Row ${i + 2}: no name — skipped.`);
      continue;
    }
    const email = String(row["Email"] ?? "").trim().toLowerCase() || null;
    const department = String(row["Department"] ?? "").trim() || null;
    const oneOnOneNote = String(row["1:1 Note"] ?? "").trim() || null;

    let trainee = batch.trainees.find((t) => t.name.toLowerCase() === name.toLowerCase());

    // Guard against handing one address to two people — email is the login identity.
    const emailOwner = email ? await db.user.findUnique({ where: { email } }) : null;
    const emailConflict = emailOwner !== null && emailOwner.id !== trainee?.id;
    if (emailConflict) {
      summary.warnings.push(`Row ${i + 2} (${name}): ${email} is already used by "${emailOwner!.name}" — email not set.`);
    }

    if (trainee) {
      await db.user.update({
        where: { id: trainee.id },
        data: {
          email: emailConflict ? undefined : email ?? undefined,
          department: department ?? undefined,
          oneOnOneNote: oneOnOneNote ?? undefined,
        },
      });
      summary.updated++;
    } else {
      trainee = await db.user.create({
        data: {
          name,
          role: "trainee",
          batchId: batch.id,
          email: emailConflict ? null : email,
          department,
          oneOnOneNote,
        },
      });
      summary.created++;
    }

    for (const slot of batch.slots) {
      const cell = row[`S${slot.index}`];
      if (cell === undefined || String(cell).trim() === "") continue; // blank = leave unchanged
      const isTick = /^(✅|y|yes|true|1)$/i.test(String(cell).trim());
      await db.traineeSessionRecord.upsert({
        where: { userId_slotId: { userId: trainee.id, slotId: slot.id } },
        update: { completed: true, observation: isTick ? undefined : String(cell).trim() },
        create: { userId: trainee.id, slotId: slot.id, completed: true, observation: isTick ? null : String(cell).trim() },
      });
    }
  }

  await logEvent(
    user.id,
    "import_run",
    `${batch.name} roster: ${file.name}: ${summary.updated} updated, ${summary.created} created`,
  );
  revalidatePath(`/admin/batches/${batchId}`);
  revalidatePath("/admin/trainees");
  return { ok: true, summary };
}
