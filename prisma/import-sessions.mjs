// CLI importer for the real SESSION LIST.xlsx tracker.
//
// Usage:
//   node prisma/import-sessions.mjs "C:\Users\daksh.j\Downloads\SESSION LIST.xlsx"
//
// Idempotent — re-running against an updated copy of the same file upserts rather
// than duplicating batches/trainees/records.
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { runImport } from "./xlsxImportCore.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node prisma/import-sessions.mjs <path-to-SESSION-LIST.xlsx>");
  process.exit(1);
}

const db = new PrismaClient();

try {
  const buffer = readFileSync(path);
  const summary = await runImport(db, buffer);

  console.log(`Batches touched: ${summary.batchesImported}`);
  console.log(`New trainees created: ${summary.traineesImported}`);
  console.log(`Trainees missing email: ${summary.traineesMissingEmail}`);
  if (summary.warnings.length) {
    console.log("\nWarnings:");
    for (const w of summary.warnings) console.log(`  - ${w}`);
  }
} finally {
  await db.$disconnect();
}
