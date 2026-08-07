import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { loadTraineeProgram, loadTraineeWorksheets } from "@/lib/trainee";
import { Panel, StatTile, ProgressRing } from "@/components/Charts";
import { Calendar, Clipboard, Pulse, Users } from "@/components/Icons";

function daysUntil(date: Date) {
  const ms = new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const program = await loadTraineeProgram(user.id);
  if (!program) return null;

  const { trainee, batch, nextSlot, completedCount } = program;
  const { pending } = await loadTraineeWorksheets(user.id, batch?.id ?? null);
  const pct = batch?.sessionCount ? Math.round((completedCount / batch.sessionCount) * 100) : 0;

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Welcome, {trainee.name}</h1>
      <p className="mt-1 mb-6 text-muted">
        {batch ? `${batch.name} · ${batch.program}` : "You haven't been assigned to a batch yet."}
      </p>

      {batch && (
        <>
          <div
            className="animate-in mb-6 flex flex-col items-center gap-6 rounded-[14px] border border-line bg-paper p-6 sm:flex-row sm:justify-between"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center gap-5">
              <ProgressRing pct={pct} />
              <div>
                <div className="text-[12px] uppercase tracking-wide text-faint">Program progress</div>
                <div className="mt-0.5 font-display text-lg text-ink">
                  {completedCount} of {batch.sessionCount} sessions complete
                </div>
                <div className="mt-1 text-sm text-muted">
                  {nextSlot?.scheduledDate ? (
                    <>
                      Next up: Session {nextSlot.index} on{" "}
                      <span className="font-medium text-ink">
                        {new Date(nextSlot.scheduledDate).toLocaleDateString()}
                      </span>
                      {(() => {
                        const d = daysUntil(nextSlot.scheduledDate);
                        if (d < 0) return null;
                        return (
                          <span className="ml-2 rounded-full bg-indigo/10 px-2 py-0.5 text-xs font-medium text-indigo">
                            {d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}
                          </span>
                        );
                      })()}
                    </>
                  ) : (
                    "Your next session hasn't been scheduled yet."
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Sessions completed" value={`${completedCount}/${batch.sessionCount}`} icon={<Pulse />} />
            <StatTile
              label="Next session"
              value={nextSlot?.scheduledDate ? new Date(nextSlot.scheduledDate).toLocaleDateString() : "Not scheduled"}
              icon={<Calendar />}
            />
            <StatTile label="Worksheets due" value={pending.length} icon={<Clipboard />} />
            <StatTile label="Department" value={trainee.department ?? "—"} icon={<Users />} />
          </div>

          {pending.length > 0 && (
            <Panel title="Needs your attention" hint={`${pending.length} worksheet(s) to complete`}>
              <p className="mb-3 text-sm text-muted">
                You have {pending.length} worksheet{pending.length === 1 ? "" : "s"} waiting.
              </p>
              <Link
                href="/worksheets"
                className="inline-block rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep"
              >
                Go to worksheets
              </Link>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
