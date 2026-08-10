// Excel export of the trainee roster + attendance — mirrors the shape of the original
// SESSION LIST.xlsx tracker (name/dept/session ticks/notes) so it stays familiar and,
// for a single batch, round-trips with POST /api/import/roster.
//
// Unlike the facilitator report, roster data isn't scoped to who's asking — any admin
// can already see any batch's trainees in the UI, so this just mirrors that.
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function sessionCell(record: { completed: boolean; observation: string | null } | undefined) {
  if (!record) return "";
  if (record.observation && record.observation.trim()) return record.observation.trim();
  return record.completed ? "✅" : "";
}

export async function GET(request: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser || sessionUser.role !== "admin") {
    return new Response("Not authorized.", { status: 403 });
  }

  const batchId = new URL(request.url).searchParams.get("batchId");

  const batches = await db.batch.findMany({
    where: batchId ? { id: batchId } : undefined,
    orderBy: [{ program: "asc" }, { name: "asc" }],
    include: {
      slots: { orderBy: { index: "asc" } },
      trainees: {
        where: { role: "trainee" },
        orderBy: { name: "asc" },
        include: { sessionRecords: true },
      },
    },
  });
  if (batchId && batches.length === 0) return new Response("Batch not found.", { status: 404 });

  const workbook = XLSX.utils.book_new();

  if (batchId) {
    // Single batch: one sheet, no Batch/Program columns needed since they're implicit.
    const batch = batches[0];
    const maxIndex = batch.sessionCount;
    const rows = batch.trainees.map((t) => {
      const row: Record<string, string> = { Name: t.name, Email: t.email ?? "", Department: t.department ?? "" };
      for (let i = 1; i <= maxIndex; i++) {
        const rec = t.sessionRecords.find((r) => batch.slots.find((s) => s.id === r.slotId)?.index === i);
        row[`S${i}`] = sessionCell(rec);
      }
      row["1:1 Note"] = t.oneOnOneNote ?? "";
      return row;
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), batch.name.slice(0, 31));
  } else {
    // Whole roster: one sheet per program (mirrors the source workbook's Sheet1/Sheet2
    // split), since programs have different session counts and can't share columns.
    const programs = [...new Set(batches.map((b) => b.program))];
    for (const program of programs) {
      const programBatches = batches.filter((b) => b.program === program);
      const maxIndex = Math.max(...programBatches.map((b) => b.sessionCount));
      const rows = programBatches.flatMap((batch) =>
        batch.trainees.map((t) => {
          const row: Record<string, string> = {
            Batch: batch.name,
            Name: t.name,
            Email: t.email ?? "",
            Department: t.department ?? "",
          };
          for (let i = 1; i <= maxIndex; i++) {
            const rec = t.sessionRecords.find((r) => batch.slots.find((s) => s.id === r.slotId)?.index === i);
            row[`S${i}`] = i <= batch.sessionCount ? sessionCell(rec) : "";
          }
          row["1:1 Note"] = t.oneOnOneNote ?? "";
          return row;
        }),
      );
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), program.slice(0, 31));
    }
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const scope = batchId ? batches[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "all-batches";
  const filename = `trainee-roster-${scope}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
