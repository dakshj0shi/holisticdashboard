"use client";

import { useActionState, useState } from "react";
import { addWorksheetItem, deleteWorksheetItem } from "@/app/actions";

type Item = {
  id: string;
  order: number;
  prompt: string;
  type: string;
  minLabel: string | null;
  maxLabel: string | null;
  optionsJson: string | null;
};

const initial: { ok: boolean; error?: string } = { ok: false };

export function WorksheetBuilder({ worksheetId, items }: { worksheetId: string; items: Item[] }) {
  const addItem = addWorksheetItem.bind(null, worksheetId);
  const [state, action, pending] = useActionState(addItem, initial);
  const [type, setType] = useState("likert5");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted">No questions yet — add the first one below.</p>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-paper-2 px-3 py-2">
              <div>
                <span className="text-[11px] uppercase tracking-wide text-faint">
                  {it.order}. {it.type}
                </span>
                <p className="text-sm text-ink">{it.prompt}</p>
                {it.type === "mcq" && it.optionsJson && (
                  <p className="text-xs text-faint">Options: {JSON.parse(it.optionsJson).join(", ")}</p>
                )}
              </div>
              <form action={deleteWorksheetItem.bind(null, it.id, worksheetId)}>
                <button type="submit" className="text-xs text-rose hover:underline">
                  Remove
                </button>
              </form>
            </div>
          ))
        )}
      </div>

      <form action={action} className="space-y-3 rounded-lg border border-line bg-paper p-4">
        <p className="text-sm font-medium text-ink">Add a question</p>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">Prompt</label>
          <textarea
            name="prompt"
            required
            rows={2}
            className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted">Type</label>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
            >
              <option value="likert5">Likert scale (1–5)</option>
              <option value="text">Free text</option>
              <option value="mcq">Multiple choice</option>
            </select>
          </div>
          {type === "mcq" && (
            <div className="min-w-[220px] flex-1 space-y-1">
              <label className="block text-xs font-medium text-muted">Options (one per line)</label>
              <textarea
                name="options"
                rows={2}
                className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add question"}
          </button>
        </div>
        {state.error && <p className="text-sm text-rose">{state.error}</p>}
      </form>
    </div>
  );
}
