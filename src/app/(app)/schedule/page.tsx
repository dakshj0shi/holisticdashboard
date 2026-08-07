import { getCurrentUser } from "@/lib/auth";
import { loadTraineeProgram } from "@/lib/trainee";
import { Panel } from "@/components/Charts";

const STATUS_DOT: Record<string, string> = {
  unscheduled: "bg-line-strong",
  scheduled: "bg-indigo",
  rescheduled: "bg-amber",
  completed: "bg-teal",
};

export default async function SchedulePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const program = await loadTraineeProgram(user.id);
  if (!program) return null;

  const { batch, slots, records, isDone } = program;

  if (!batch) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink">Schedule</h1>
        <p className="mt-1 text-muted">You&apos;re not assigned to a batch yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Schedule</h1>
      <p className="mt-1 mb-6 text-muted">
        All {batch.sessionCount} sessions for {batch.name}. Updates as your facilitator schedules or reschedules.
      </p>

      <Panel title="Your sessions" hint="newest changes appear automatically">
        <ol className="space-y-0">
          {slots.map((s, i) => {
            const done = isDone(s.id);
            const status = done ? "completed" : s.status;
            const label = done ? "Completed" : s.status === "rescheduled" ? "Rescheduled" : s.status;
            const observation = records.find((r) => r.slotId === s.id)?.observation;
            return (
              <li key={s.id} className="group flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-paper-2">
                <div className="flex flex-col items-center">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ring-4 ring-paper transition-transform group-hover:scale-125 ${
                      STATUS_DOT[status] ?? "bg-line-strong"
                    }`}
                  />
                  {i < slots.length - 1 && <span className="mt-0.5 w-px flex-1 bg-line" />}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-sm font-medium text-ink">Session {s.index}</span>
                    <span className="text-xs capitalize text-muted">{label}</span>
                  </div>
                  <div className="text-xs text-faint">
                    {s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString() : "Not yet scheduled"}
                    {s.rescheduledFrom && (
                      <span className="ml-2 text-amber">
                        moved from {new Date(s.rescheduledFrom).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {s.summary && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-xs text-indigo hover:underline">Session summary</summary>
                      <p className="mt-1.5 whitespace-pre-line rounded-lg bg-paper-2 p-3 text-sm text-muted">
                        {s.summary}
                      </p>
                    </details>
                  )}
                  {observation && (
                    <p className="mt-1 text-xs text-faint">
                      <span className="font-medium">Facilitator note:</span> {observation}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
}
