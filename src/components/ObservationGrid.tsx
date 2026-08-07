"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markSessionComplete, saveObservation, saveOneOnOneNote } from "@/app/actions";

type Slot = { id: string; index: number };
type Record_ = { slotId: string; completed: boolean; observation: string | null };
type Trainee = { id: string; name: string; oneOnOneNote: string | null; records: Record_[] };

function CompleteBox({ userId, slotId, initial }: { userId: string; slotId: string; initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked;
        setChecked(next);
        startTransition(() => {
          markSessionComplete(userId, slotId, next);
        });
      }}
      className="h-4 w-4 accent-indigo"
    />
  );
}

function ObservationField({
  userId,
  slotId,
  initial,
  label,
}: {
  userId: string;
  slotId: string;
  initial: string;
  label: string;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted">{label}</label>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={() => startTransition(async () => {
          await saveObservation(userId, slotId, value);
          setSaved(true);
        })}
        rows={2}
        className="w-full rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 text-sm text-ink focus:border-indigo focus:outline-none"
      />
      {pending && <span className="text-[11px] text-faint">Saving…</span>}
      {!pending && saved && <span className="text-[11px] text-teal">Saved</span>}
    </div>
  );
}

function OneOnOneField({ userId, initial }: { userId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [, startTransition] = useTransition();
  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() =>
        startTransition(() => {
          saveOneOnOneNote(userId, value);
        })
      }
      rows={2}
      placeholder="1:1 notes…"
      className="w-full rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
    />
  );
}

export function ObservationGrid({ trainees, slots }: { trainees: Trainee[]; slots: Slot[] }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
              <th className="py-2 pr-4">Trainee</th>
              {slots.map((s) => (
                <th key={s.id} className="px-2 py-2 text-center">
                  S{s.index}
                </th>
              ))}
              <th className="py-2 pl-4" />
            </tr>
          </thead>
          <tbody>
            {trainees.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0">
                <td className="py-2.5 pr-4">
                  <Link href={`/admin/trainees/${t.id}`} className="font-medium text-indigo hover:underline">
                    {t.name}
                  </Link>
                </td>
                {slots.map((s) => {
                  const rec = t.records.find((r) => r.slotId === s.id);
                  return (
                    <td key={s.id} className="px-2 py-2.5 text-center">
                      <CompleteBox userId={t.id} slotId={s.id} initial={rec?.completed ?? false} />
                    </td>
                  );
                })}
                <td className="py-2.5 pl-4">
                  <details>
                    <summary className="cursor-pointer text-xs text-indigo hover:underline">Notes</summary>
                    <div className="mt-2 w-80 space-y-2 rounded-lg border border-line bg-paper-2 p-3">
                      <OneOnOneField userId={t.id} initial={t.oneOnOneNote ?? ""} />
                      {slots.map((s) => {
                        const rec = t.records.find((r) => r.slotId === s.id);
                        return (
                          <ObservationField
                            key={s.id}
                            userId={t.id}
                            slotId={s.id}
                            initial={rec?.observation ?? ""}
                            label={`Session ${s.index} observation`}
                          />
                        );
                      })}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
