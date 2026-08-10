// Excel export of facilitator/session activity — "who's overseeing which sessions"
// and "how many sessions has each facilitator conducted."
//
// Access is scoped by role, not by a request parameter: a regular admin always gets
// ONLY their own rows, no matter what; a super admin (User.isSuperAdmin) gets every
// facilitator's rows. There's no way to ask for someone else's data as a non-super
// admin — the scope is decided server-side from the session, never from the query.
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser || sessionUser.role !== "admin") {
    return new Response("Not authorized.", { status: 403 });
  }

  const me = await db.user.findUnique({ where: { id: sessionUser.id } });
  if (!me) return new Response("Not authorized.", { status: 403 });

  // Optional per-batch scope — narrows WHICH sessions are considered, but never who's
  // allowed to see them. A regular admin asking for a batch they don't facilitate still
  // gets an empty report, same as the unscoped export.
  const batchId = new URL(request.url).searchParams.get("batchId");
  const scopedBatch = batchId ? await db.batch.findUnique({ where: { id: batchId }, select: { name: true } }) : null;
  if (batchId && !scopedBatch) return new Response("Batch not found.", { status: 404 });

  // `active: true` deliberately omitted — a revoked facilitator's past sessions should
  // still show their name in the export, unlike the "assign facilitator" dropdown.
  const [batches, admins] = await Promise.all([
    db.batch.findMany({
      where: batchId ? { id: batchId } : undefined,
      include: { slots: { orderBy: { index: "asc" } } },
    }),
    db.user.findMany({ where: { role: "admin" }, select: { id: true, name: true, email: true } }),
  ]);
  const adminById = new Map(admins.map((a) => [a.id, a]));

  type Row = {
    facilitatorId: string;
    facilitatorName: string;
    facilitatorEmail: string;
    batch: string;
    program: string;
    sessionIndex: number;
    status: string;
    date: string;
    conducted: boolean;
  };

  const rows: Row[] = [];
  for (const batch of batches) {
    for (const slot of batch.slots) {
      // Snapshot on the slot (who actually taught it) wins; otherwise fall back to the
      // batch's current facilitator (who's slated to teach it / oversees it now).
      const facilitatorId = slot.facilitatorId ?? batch.facilitatorId;
      if (!facilitatorId) continue;
      const facilitator = adminById.get(facilitatorId);
      if (!facilitator) continue; // facilitator row was hard-deleted; nothing to attribute to

      rows.push({
        facilitatorId,
        facilitatorName: facilitator.name,
        facilitatorEmail: facilitator.email ?? "",
        batch: batch.name,
        program: batch.program,
        sessionIndex: slot.index,
        status: slot.status,
        date: slot.scheduledDate ? slot.scheduledDate.toISOString().slice(0, 10) : "",
        conducted: slot.status === "completed",
      });
    }
  }

  const scopedRows = me.isSuperAdmin ? rows : rows.filter((r) => r.facilitatorId === me.id);

  const summaryMap = new Map<
    string,
    { name: string; email: string; batches: Set<string>; conducted: number; upcoming: number }
  >();
  for (const r of scopedRows) {
    if (!summaryMap.has(r.facilitatorId)) {
      summaryMap.set(r.facilitatorId, { name: r.facilitatorName, email: r.facilitatorEmail, batches: new Set(), conducted: 0, upcoming: 0 });
    }
    const s = summaryMap.get(r.facilitatorId)!;
    s.batches.add(r.batch);
    if (r.conducted) s.conducted++;
    else if (r.status === "scheduled" || r.status === "rescheduled") s.upcoming++;
  }

  const summarySheet = [...summaryMap.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({
      Facilitator: s.name,
      Email: s.email,
      "Batches Overseen": s.batches.size,
      "Sessions Conducted": s.conducted,
      "Sessions Scheduled (Upcoming)": s.upcoming,
    }));

  const detailSheet = scopedRows
    .sort(
      (a, b) =>
        a.facilitatorName.localeCompare(b.facilitatorName) ||
        a.batch.localeCompare(b.batch) ||
        a.sessionIndex - b.sessionIndex,
    )
    .map((r) => ({
      Facilitator: r.facilitatorName,
      Batch: r.batch,
      Program: r.program,
      Session: r.sessionIndex,
      Status: r.status,
      Date: r.date || "Not scheduled",
      Conducted: r.conducted ? "Yes" : "No",
    }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summarySheet), "Facilitator Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailSheet), "Session Detail");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const who = me.isSuperAdmin ? "all-facilitators" : me.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const scope = scopedBatch ? `-${scopedBatch.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  const filename = `facilitator-report-${who}${scope}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
