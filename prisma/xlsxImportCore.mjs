// Plain-JS core so this can run both as a standalone CLI script (plain Node, no
// Next.js bundler) and be imported from the Next.js admin upload action. Keep this
// file free of "server-only" and any TS-only syntax for that reason.
import * as XLSX from "xlsx";

const SHEET1_LAYOUT = {
  program: "founders-mentality",
  nameCol: 0,
  deptCol: 2,
  sessionCols: [3, 4, 5, 6, 7, 8, 9, 10],
  oneOnOneCol: 12,
  observationCols: [14, 15, 16, 17, 18, 19, 20, 21], // S1..S8
};

const SHEET2_LAYOUT = {
  program: "facilitator-workshop",
  nameCol: 0,
  deptCol: 1,
  sessionCols: [2, 3],
  oneOnOneCol: null,
  observationCols: [],
};

function isBatchLabelRow(cell) {
  return typeof cell === "string" && cell.trim().toUpperCase().startsWith("BATCH");
}

function cellIsFilled(cell) {
  return cell !== null && cell !== undefined && String(cell).trim() !== "";
}

// Handles both real Excel date cells (JS Date, via cellDates:true) and text dates
// like "17/07/27" (DD/MM/YY, as found in manually-typed cells in the real file).
function parseDateCell(cell) {
  if (cell instanceof Date) return cell;
  if (typeof cell === "string") {
    const m = cell.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const [, dd, mm, yy] = m;
      const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
      const d = new Date(year, Number(mm) - 1, Number(dd));
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

// db must be a PrismaClient (or any object with the same .batch/.batchSessionSlot/.user/
// .traineeSessionRecord APIs) — passed in so this file has no opinion on which client
// instance (CLI's own vs the Next.js app's shared singleton) is used.
export async function runImport(db, fileBuffer) {
  const wb = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const warnings = [];
  let batchesImported = 0;
  let traineesImported = 0;

  const sheets = [
    { sheetName: wb.SheetNames[0], layout: SHEET1_LAYOUT },
    { sheetName: wb.SheetNames[1], layout: SHEET2_LAYOUT },
  ].filter((s) => s.sheetName);

  for (const { sheetName, layout } of sheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    const sessionCount = layout.sessionCols.length;
    let currentBatchId = null;
    let currentBatchName = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nameCell = row[layout.nameCol];

      if (isBatchLabelRow(nameCell)) {
        const name = String(nameCell).trim().replace(/\s+/g, " ");
        const batch = await db.batch.upsert({
          where: { program_name: { program: layout.program, name } },
          update: {},
          create: { program: layout.program, name, sessionCount },
        });
        currentBatchId = batch.id;
        currentBatchName = name;
        batchesImported++;

        const batchDates = [];
        for (let s = 0; s < sessionCount; s++) {
          const date = parseDateCell(row[layout.sessionCols[s]]);
          if (date) batchDates.push({ index: s + 1, date, raw: String(row[layout.sessionCols[s]]).trim() });
          await db.batchSessionSlot.upsert({
            where: { batchId_index: { batchId: batch.id, index: s + 1 } },
            update: date ? { scheduledDate: date, status: "scheduled" } : {},
            create: {
              batchId: batch.id,
              index: s + 1,
              scheduledDate: date,
              status: date ? "scheduled" : "unscheduled",
            },
          });
        }

        // Sessions should run in order. Out-of-order dates almost always mean a typo'd
        // year in the spreadsheet (e.g. "17/07/27" where "17/07/26" was meant), so
        // surface it instead of importing a schedule that reads as nonsense.
        for (let i = 1; i < batchDates.length; i++) {
          const prev = batchDates[i - 1];
          const cur = batchDates[i];
          if (cur.date < prev.date) {
            warnings.push(
              `${name}: Session ${cur.index} (${cur.raw}) is dated before Session ${prev.index} (${prev.raw}) — check the year in the spreadsheet.`,
            );
          }
        }
        continue;
      }

      if (!cellIsFilled(nameCell)) continue; // blank separator row

      if (!currentBatchId) {
        warnings.push(`${sheetName} row ${i + 1}: trainee row found before any batch row — skipped.`);
        continue;
      }

      const name = String(nameCell).trim().replace(/\s+/g, " ");
      const department = layout.deptCol !== null ? row[layout.deptCol]?.toString().trim() || null : null;
      const oneOnOneNote =
        layout.oneOnOneCol !== null ? row[layout.oneOnOneCol]?.toString().trim() || null : null;

      let user = await db.user.findFirst({ where: { name, batchId: currentBatchId } });
      if (!user) {
        user = await db.user.create({
          data: { name, department, batchId: currentBatchId, role: "trainee", email: null, passwordHash: null, oneOnOneNote },
        });
        traineesImported++;
      } else {
        await db.user.update({
          where: { id: user.id },
          data: { department, oneOnOneNote: oneOnOneNote ?? user.oneOnOneNote },
        });
      }

      const slots = await db.batchSessionSlot.findMany({ where: { batchId: currentBatchId } });
      for (let s = 0; s < sessionCount; s++) {
        const completed = cellIsFilled(row[layout.sessionCols[s]]);
        const observation =
          layout.observationCols[s] !== undefined ? row[layout.observationCols[s]]?.toString().trim() || null : null;
        const slot = slots.find((sl) => sl.index === s + 1);
        if (!slot) continue;

        await db.traineeSessionRecord.upsert({
          where: { userId_slotId: { userId: user.id, slotId: slot.id } },
          update: { completed, observation, completedAt: completed ? new Date() : null },
          create: { userId: user.id, slotId: slot.id, completed, observation, completedAt: completed ? new Date() : null },
        });
      }
    }

    if (!currentBatchName) warnings.push(`${sheetName}: no "BATCH ..." rows found — nothing imported from this sheet.`);
  }

  const traineesMissingEmail = await db.user.count({ where: { role: "trainee", email: null } });
  if (traineesImported > 0) {
    warnings.push(
      `${traineesMissingEmail} trainee(s) have no email on file (the source spreadsheet has none) — add emails in Trainees before scheduling sends mail.`,
    );
  }

  return { batchesImported, traineesImported, traineesMissingEmail, warnings };
}
