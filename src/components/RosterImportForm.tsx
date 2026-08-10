"use client";

import { useActionState } from "react";
import { importBatchRoster } from "@/app/actions";
import type { RosterImportSummary } from "@/app/actions/import";

const initial: { ok: boolean; error?: string; summary?: RosterImportSummary } = { ok: false };

export function RosterImportForm({ batchId }: { batchId: string }) {
  const action = async (_prev: typeof initial, formData: FormData) => importBatchRoster(batchId, _prev, formData);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
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
          className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-2 disabled:opacity-60"
        >
          {pending ? "Importing…" : "Import roster"}
        </button>
      </form>

      {state.error && <p className="text-sm text-rose">{state.error}</p>}

      {state.summary && (
        <div className="rounded-lg border border-line bg-paper-2 p-4 text-sm">
          <p className="font-medium text-ink">
            {state.summary.updated} updated, {state.summary.created} created.
          </p>
          {state.summary.warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-faint">
              {state.summary.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
