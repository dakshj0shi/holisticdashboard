"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createWorksheet } from "@/app/actions";

const initial: { ok: boolean; error?: string; id?: string } = { ok: false };

export function WorksheetForm() {
  const [state, action, pending] = useActionState(createWorksheet, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.id) router.push(`/admin/worksheets/${state.id}`);
  }, [state, router]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Title</label>
        <input
          name="title"
          required
          placeholder="The Mirror"
          className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted">Description (optional)</label>
        <input
          name="description"
          className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
        />
      </div>
      {state.error && <p className="col-span-full text-sm text-rose">{state.error}</p>}
      <div className="col-span-full">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create worksheet"}
        </button>
      </div>
    </form>
  );
}
