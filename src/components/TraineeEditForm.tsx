"use client";

import { useActionState } from "react";
import { updateTrainee, deactivateTrainee, deleteTrainee } from "@/app/actions";

type Trainee = {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  batchId: string | null;
  active: boolean;
};

const initial: { ok: boolean; error?: string } = { ok: false };

export function TraineeEditForm({
  trainee,
  batches,
}: {
  trainee: Trainee;
  batches: { id: string; name: string; program: string }[];
}) {
  const updateWithId = updateTrainee.bind(null, trainee.id);
  const [state, action, pending] = useActionState(updateWithId, initial);

  return (
    <div className="space-y-6">
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">Name</label>
          <input
            name="name"
            defaultValue={trainee.name}
            required
            className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={trainee.email ?? ""}
            className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">Department</label>
          <input
            name="department"
            defaultValue={trainee.department ?? ""}
            className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">Batch</label>
          <select
            name="batchId"
            defaultValue={trainee.batchId ?? ""}
            className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
          >
            <option value="">— none —</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.program})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">Reset password (optional)</label>
          <input
            name="password"
            placeholder="leave blank to keep current"
            className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 self-end text-sm text-muted">
          <input type="checkbox" name="active" defaultChecked={trainee.active} /> Active
        </label>

        {state.error && <p className="col-span-full text-sm text-rose">{state.error}</p>}

        <div className="col-span-full">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="space-y-3 rounded-lg border border-rose/25 bg-rose/5 p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-rose">Danger zone</div>

        {trainee.active && (
          <form
            action={deactivateTrainee.bind(null, trainee.id)}
            onSubmit={(e) => {
              if (!confirm(`Deactivate ${trainee.name}? They won't be able to log in, but their records are kept.`)) {
                e.preventDefault();
              }
            }}
          >
            <button type="submit" className="text-sm text-rose underline-offset-2 hover:underline">
              Deactivate trainee
            </button>
          </form>
        )}

        <form
          action={deleteTrainee.bind(null, trainee.id)}
          onSubmit={(e) => {
            if (
              !confirm(
                `Permanently delete ${trainee.name}?\n\nThis removes their login, worksheet answers, and session history. This cannot be undone.`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <button type="submit" className="text-sm font-medium text-rose underline-offset-2 hover:underline">
            Delete permanently
          </button>
        </form>
      </div>
    </div>
  );
}
