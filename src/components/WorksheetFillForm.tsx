"use client";

import { useActionState } from "react";
import { submitWorksheet } from "@/app/actions";

type Item = {
  id: string;
  order: number;
  prompt: string;
  type: string;
  minLabel: string | null;
  maxLabel: string | null;
  optionsJson: string | null;
  required: boolean;
};

const initial: { ok: boolean; error?: string } = { ok: false };

export function WorksheetFillForm({ assignmentId, items }: { assignmentId: string; items: Item[] }) {
  const submit = submitWorksheet.bind(null, assignmentId);
  const [state, action, pending] = useActionState(submit, initial);

  return (
    <form action={action} className="space-y-6">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-line bg-paper p-4">
          <p className="mb-3 text-sm font-medium text-ink">
            {item.order}. {item.prompt}
          </p>

          {item.type === "likert5" && (
            <div className="flex items-center justify-between gap-2">
              <span className="w-28 shrink-0 text-xs text-faint">{item.minLabel}</span>
              <div className="flex flex-1 justify-center gap-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="flex flex-col items-center gap-1 text-xs text-muted">
                    <input type="radio" name={`item_${item.id}`} value={n} required={item.required} className="h-4 w-4 accent-indigo" />
                    {n}
                  </label>
                ))}
              </div>
              <span className="w-28 shrink-0 text-right text-xs text-faint">{item.maxLabel}</span>
            </div>
          )}

          {item.type === "text" && (
            <textarea
              name={`item_${item.id}`}
              required={item.required}
              rows={3}
              className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none"
            />
          )}

          {item.type === "mcq" && item.optionsJson && (
            <div className="space-y-2">
              {(JSON.parse(item.optionsJson) as string[]).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-ink">
                  <input type="radio" name={`item_${item.id}`} value={opt} required={item.required} className="h-4 w-4 accent-indigo" />
                  {opt}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      {state.error && <p className="text-sm text-rose">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo px-5 py-2.5 font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
