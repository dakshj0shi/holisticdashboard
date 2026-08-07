"use client";

import { useActionState } from "react";
import { assignWorksheetToBatch } from "@/app/actions";

const initial: { ok: boolean; error?: string } = { ok: false };

export function WorksheetAssignForm({
  worksheetId,
  batches,
}: {
  worksheetId: string;
  batches: { id: string; name: string; program: string }[];
}) {
  const assign = assignWorksheetToBatch.bind(null, worksheetId);
  const [state, action, pending] = useActionState(assign, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Batch</label>
        <select
          name="batchId"
          required
          className="w-56 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.program})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Timing</label>
        <select
          name="timing"
          className="w-40 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
        >
          <option value="pre">Pre</option>
          <option value="post">Post</option>
          <option value="standalone">Standalone</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Due date (optional)</label>
        <input
          name="dueDate"
          type="date"
          className="rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
      >
        {pending ? "Assigning…" : "Assign"}
      </button>
      {state.error && <p className="w-full text-sm text-rose">{state.error}</p>}
    </form>
  );
}
