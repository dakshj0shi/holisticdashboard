"use client";

import { useActionState } from "react";
import { createBatch } from "@/app/actions";

const initial: { ok: boolean; error?: string } = { ok: false };

export function BatchForm({ programs }: { programs: string[] }) {
  const [state, action, pending] = useActionState(createBatch, initial);
  const options = Array.from(new Set(["founders-mentality", "facilitator-workshop", ...programs])).sort();

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Batch name</label>
        <input
          name="name"
          required
          placeholder="BATCH E"
          className="w-40 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Program</label>
        <input
          name="program"
          list="program-options"
          required
          defaultValue="founders-mentality"
          placeholder="Type to add a new program"
          className="w-52 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
        />
        <datalist id="program-options">
          {options.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Sessions</label>
        <input
          name="sessionCount"
          type="number"
          min={1}
          max={30}
          defaultValue={8}
          required
          className="w-24 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create batch"}
      </button>
      {state.error && <p className="w-full text-sm text-rose">{state.error}</p>}
    </form>
  );
}
