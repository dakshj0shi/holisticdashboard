// Shared result type for the Excel importer (prisma/xlsxImportCore.mjs), used by both
// the admin upload action and its form component. The import logic itself lives in
// that plain-JS core so it can also run from the standalone CLI script — see its header.
export type ImportSummary = {
  batchesImported: number;
  traineesImported: number;
  traineesMissingEmail: number;
  warnings: string[];
};
