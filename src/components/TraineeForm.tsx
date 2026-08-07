"use client";

import { useActionState } from "react";
import { createTrainee } from "@/app/actions";

const initial: { ok: boolean; error?: string } = { ok: false };

export function TraineeForm({
  batches,
  defaultBatchId,
}: {
  batches: { id: string; name: string; program: string }[];
  defaultBatchId?: string;
}) {
  const [state, action, pending] = useActionState(createTrainee, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Name</label>
        <input
          name="name"
          required
          className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Email (optional for now)</label>
        <input
          name="email"
          type="email"
          className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Department</label>
        <input
          name="department"
          className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Batch</label>
        <select
          name="batchId"
          defaultValue={defaultBatchId ?? ""}
          className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
        >
          <option value="">— none yet —</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.program})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Initial password (optional)</label>
        <input
          name="password"
          placeholder="leave blank to set later"
          className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add trainee"}
        </button>
      </div>
      {state.error && <p className="col-span-full text-sm text-rose">{state.error}</p>}
    </form>
  );
}
