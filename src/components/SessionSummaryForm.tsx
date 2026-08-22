"use client";

import { useActionState } from "react";
import { sendSessionSummary } from "@/app/actions";

const initial: { ok: boolean; error?: string; mailUnavailable?: boolean } = { ok: false };

export function SessionSummaryForm({ slotId, initialSummary }: { slotId: string; initialSummary: string | null }) {
  const action = async (_prev: typeof initial, formData: FormData) => sendSessionSummary(slotId, _prev, formData);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-2">
      <textarea
        name="summary"
        defaultValue={initialSummary ?? ""}
        rows={2}
        placeholder="What happened in this session? This gets emailed to every trainee in the batch."
        className="w-full rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
        >
          {pending ? "Sending…" : initialSummary ? "Resend summary" : "Send summary"}
        </button>
        {state.error && <span className="text-sm text-rose">{state.error}</span>}
        {!state.error && state.ok && (
          // The recap is saved and the session is marked completed either way; only the
          // email depends on the mail server being reachable.
          <span className={`text-sm ${state.mailUnavailable ? "text-amber" : "text-teal"}`}>
            {state.mailUnavailable
              ? "Recap saved and session completed — no email sent, the mail server is unavailable."
              : "Sent — trainees notified."}
          </span>
        )}
      </div>
    </form>
  );
}
