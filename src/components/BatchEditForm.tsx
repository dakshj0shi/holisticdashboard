"use client";

import { useActionState } from "react";
import { updateBatch, deleteBatch } from "@/app/actions";

type Batch = {
  id: string;
  name: string;
  sessionCount: number;
  traineeCount: number;
  facilitatorId: string | null;
};
type Facilitator = { id: string; name: string; email: string | null };

const initial: { ok: boolean; error?: string } = { ok: false };

export function BatchEditForm({ batch, facilitators }: { batch: Batch; facilitators: Facilitator[] }) {
  const action = async (_prev: typeof initial, formData: FormData) => updateBatch(batch.id, formData);
  const [state, formAction, pending] = useActionState(action, initial);

  const deleteAction = async () => deleteBatch(batch.id);
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteAction, initial);

  return (
    <div className="space-y-6">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">Batch name</label>
          <input
            name="name"
            defaultValue={batch.name}
            required
            className="w-40 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">Sessions</label>
          <input
            name="sessionCount"
            type="number"
            min={1}
            max={30}
            defaultValue={batch.sessionCount}
            required
            className="w-24 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">Facilitator</label>
          <select
            name="facilitatorId"
            defaultValue={batch.facilitatorId ?? ""}
            className="w-48 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
          >
            <option value="">— unassigned —</option>
            {facilitators.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <span className="text-xs text-faint">Raising sessions adds new unscheduled ones at the end.</span>
        {state.error && <p className="w-full text-sm text-rose">{state.error}</p>}
      </form>

      <div className="space-y-3 rounded-lg border border-rose/25 bg-rose/5 p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-rose">Danger zone</div>
        <form
          action={deleteFormAction}
          onSubmit={(e) => {
            const traineeNote =
              batch.traineeCount > 0
                ? ` Its ${batch.traineeCount} trainee(s) will NOT be deleted — they'll just be unassigned from this batch.`
                : "";
            if (
              !confirm(
                `Permanently delete "${batch.name}"?\n\nThis removes all of its sessions, schedules, and worksheet assignments.${traineeNote} This cannot be undone.`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            disabled={deletePending}
            className="text-sm font-medium text-rose underline-offset-2 hover:underline disabled:opacity-60"
          >
            {deletePending ? "Deleting…" : "Delete batch permanently"}
          </button>
          {deleteState.error && <p className="mt-1 text-sm text-rose">{deleteState.error}</p>}
        </form>
      </div>
    </div>
  );
}
