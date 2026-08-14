"use client";

import { useActionState, useRef } from "react";
import { createFacilitator } from "@/app/actions";

const initial: { ok: boolean; error?: string } = { ok: false };

export function AddFacilitatorForm({ batchId }: { batchId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = async (_prev: typeof initial, formData: FormData) => {
    const result = await createFacilitator(batchId, _prev, formData);
    if (result.ok) formRef.current?.reset();
    return result;
  };
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Name</label>
        <input
          name="name"
          required
          placeholder="Full name"
          className="w-40 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="name@jaipurrugs.com"
          className="w-56 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper-2 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add facilitator"}
      </button>
      {state.error && <span className="text-sm text-rose">{state.error}</span>}
      {state.ok && <span className="text-sm text-teal">Added — now selectable above.</span>}
    </form>
  );
}
