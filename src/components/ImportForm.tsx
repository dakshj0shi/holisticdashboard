"use client";

import { useActionState } from "react";
import { runImportAction } from "@/app/actions";
import type { ImportSummary } from "@/lib/xlsxImport";

const initial: { ok: boolean; error?: string; summary?: ImportSummary } = { ok: false };

export function ImportForm() {
  const [state, action, pending] = useActionState(runImportAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input
          name="file"
          type="file"
          accept=".xlsx"
          required
          className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-indigo file:px-3 file:py-2 file:text-sm file:font-medium file:text-paper hover:file:bg-indigo-deep"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </form>

      {state.error && <p className="text-sm text-rose">{state.error}</p>}

      {state.summary && (
        <div className="rounded-lg border border-line bg-paper-2 p-4 text-sm">
          <p className="font-medium text-ink">Import complete</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>Batches touched: {state.summary.batchesImported}</li>
            <li>New trainees created: {state.summary.traineesImported}</li>
            <li>Trainees missing email: {state.summary.traineesMissingEmail}</li>
          </ul>
          {state.summary.warnings.length > 0 && (
            <div className="mt-3">
              <p className="font-medium text-ink">Warnings</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-faint">
                {state.summary.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
