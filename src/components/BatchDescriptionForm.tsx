"use client";

import { useActionState } from "react";
import { updateBatchDescription } from "@/app/actions";

const initial: { ok: boolean; error?: string } = { ok: false };

export function BatchDescriptionForm({ batchId, description }: { batchId: string; description: string | null }) {
  const action = async (_prev: typeof initial, formData: FormData) => updateBatchDescription(batchId, _prev, formData);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="description"
        defaultValue={description ?? ""}
        rows={8}
        placeholder="What is this batch about — goals, audience, anything worth noting for whoever opens it next…"
        className="w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save description"}
        </button>
        {state.error && <span className="text-sm text-rose">{state.error}</span>}
      </div>
    </form>
  );
}
