"use client";

import { useState, useTransition } from "react";
import { scheduleSessionSlot, rescheduleSessionSlot, correctSessionDate } from "@/app/actions";

type Slot = {
  id: string;
  index: number;
  status: string;
  scheduledDate: string | null; // yyyy-mm-dd, or null
};

export function ScheduleSlotForm({ slot, suggestedDate }: { slot: Slot; suggestedDate?: string }) {
  const [date, setDate] = useState(slot.scheduledDate ?? suggestedDate ?? "");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Nothing emailed — the date still saved, so this is a warning, not an error.
  const [doneSilent, setDoneSilent] = useState(false);
  const [pending, startTransition] = useTransition();

  const isFirstSchedule = slot.status === "unscheduled";

  function submit(force = false) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = isFirstSchedule
        ? await scheduleSessionSlot(slot.id, date, force)
        : await rescheduleSessionSlot(slot.id, date);

      if (!result.ok && "needsConfirm" in result && result.needsConfirm) {
        setNeedsConfirm(true);
        return;
      }
      setNeedsConfirm(false);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      // Don't claim trainees were notified when the mail server was never reachable.
      setDoneSilent(Boolean(result.mailUnavailable));
      if (result.mailUnavailable) {
        setDone(
          isFirstSchedule
            ? "Scheduled — no email sent, the mail server is unavailable."
            : "Rescheduled — no email sent, the mail server is unavailable.",
        );
      } else {
        setDone(isFirstSchedule ? "Scheduled — trainees notified." : "Rescheduled — trainees notified of the new date.");
      }
    });
  }

  function fixDate() {
    setError(null);
    setDone(null);
    setNeedsConfirm(false);
    startTransition(async () => {
      const result = await correctSessionDate(slot.id, date);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setDone("Date changed — no email sent.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          setNeedsConfirm(false);
          setDone(null);
          setDoneSilent(false);
        }}
        className="rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 text-sm text-ink focus:border-indigo focus:outline-none"
      />
      <button
        type="button"
        disabled={pending || !date}
        onClick={() => submit(false)}
        className="rounded-lg bg-indigo px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
      >
        {pending ? "Sending…" : isFirstSchedule ? "Schedule" : "Reschedule"}
      </button>

      <button
        type="button"
        disabled={pending || !date}
        onClick={fixDate}
        title="Overwrite the date without emailing anyone — for fixing a wrong date on a past session"
        className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-muted transition-colors hover:bg-paper-2 disabled:opacity-60"
      >
        Change date (no email)
      </button>

      {isFirstSchedule && suggestedDate && date === suggestedDate && (
        <span className="text-xs text-faint">Suggested — 7 days out, no other batch conflict</span>
      )}
      {needsConfirm && (
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(true)}
          className="rounded-lg border border-amber px-3 py-1.5 text-sm text-amber hover:bg-amber/10"
        >
          Already notified for this date — send again?
        </button>
      )}
      {error && <span className="text-sm text-rose">{error}</span>}
      {done && <span className={`text-sm ${doneSilent ? "text-amber" : "text-teal"}`}>{done}</span>}
    </div>
  );
}
