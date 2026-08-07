import Link from "next/link";
import { loadPlanning, TARGET_GAP_DAYS } from "@/lib/planning";
import { Panel, StatTile } from "@/components/Charts";
import { Calendar, Pulse, Users } from "@/components/Icons";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-rose/12 text-rose" },
  unscheduled: { label: "Not started", cls: "bg-slate/12 text-slate" },
  "due-soon": { label: "Due soon", cls: "bg-amber/12 text-amber" },
  "on-track": { label: "On track", cls: "bg-teal/12 text-teal" },
  complete: { label: "All booked", cls: "bg-paper-2 text-faint" },
};

const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

function Ago({ days }: { days: number }) {
  if (days === 0) return <span className="text-ink">today</span>;
  if (days === 1) return <span>yesterday</span>;
  return <span>{days} days ago</span>;
}

function Away({ days }: { days: number }) {
  if (days < 0) return <span className="font-medium text-rose">{Math.abs(days)} days overdue</span>;
  if (days === 0) return <span className="font-medium text-ink">today</span>;
  if (days === 1) return <span className="font-medium text-ink">tomorrow</span>;
  return <span>in {days} days</span>;
}

export default async function PlanningPage() {
  const { plans, totals } = await loadPlanning();

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Planning</h1>
      <p className="mt-1 mb-6 text-muted">
        When each batch last met, how long it&apos;s been, and the next free date — so sessions get booked on time
        without two batches landing on the same day.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Needs booking" value={totals.needsBooking} icon={<Pulse />} />
        <StatTile label="Due soon" value={totals.dueSoon} icon={<Calendar />} />
        <StatTile label="Date clashes" value={totals.withClashes} />
        <StatTile label="Fully booked" value={totals.complete} icon={<Users />} />
      </div>

      {totals.withClashes > 0 && (
        <div className="mb-6 rounded-lg border border-rose/30 bg-rose/8 px-4 py-3 text-sm text-ink">
          {totals.withClashes} batch(es) are scheduled on the same day as another batch. Scheduling now blocks new
          same-day bookings, but these existing ones need moving — open the batch and reschedule.
        </div>
      )}

      <Panel
        title={`Batch schedule overview (${plans.length})`}
        hint={`target gap ${TARGET_GAP_DAYS} days between sessions`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
                <th className="py-2 pr-4">Batch</th>
                <th className="py-2 pr-4">Booked</th>
                <th className="py-2 pr-4">Last session</th>
                <th className="py-2 pr-4">Gap</th>
                <th className="py-2 pr-4">Next session</th>
                <th className="py-2 pr-4">Can schedule next</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const s = STATUS_STYLE[p.status];
                return (
                  <tr key={p.id} className="border-b border-line last:border-0 align-top">
                    <td className="py-3 pr-4">
                      <Link href={`/admin/batches/${p.id}`} className="font-medium text-indigo hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-[11px] text-faint">
                        {p.program} · {p.traineeCount} trainees
                      </div>
                    </td>

                    <td className="py-3 pr-4 text-muted">
                      {p.scheduledCount}/{p.sessionCount}
                    </td>

                    <td className="py-3 pr-4">
                      {p.last ? (
                        <>
                          <div className="text-ink">Session {p.last.index}</div>
                          <div className="text-[11px] text-faint">{fmt(p.last.date)}</div>
                        </>
                      ) : (
                        <span className="text-faint">none yet</span>
                      )}
                    </td>

                    <td className="py-3 pr-4 text-muted">
                      {p.last ? (
                        <span className={p.last.daysAgo > 14 ? "font-medium text-rose" : undefined}>
                          <Ago days={p.last.daysAgo} />
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="py-3 pr-4">
                      {p.next ? (
                        <>
                          <div className="text-ink">
                            Session {p.next.index} · <Away days={p.next.daysAway} />
                          </div>
                          <div className="text-[11px] text-faint">{fmt(p.next.date)}</div>
                          {p.clashes.length > 0 && (
                            <div className="mt-1 inline-block rounded bg-rose/12 px-1.5 py-0.5 text-[11px] text-rose">
                              clashes with {p.clashes.join(", ")}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-faint">nothing upcoming</span>
                      )}
                    </td>

                    <td className="py-3 pr-4">
                      {p.suggested ? (
                        <>
                          <div className="text-ink">
                            Session {p.suggested.index} · {fmt(p.suggested.date)}
                          </div>
                          <div className="text-[11px] text-faint">
                            <Away days={p.suggested.daysAway} /> · no clash
                          </div>
                          <Link
                            href={`/admin/batches/${p.id}`}
                            className="mt-1 inline-block text-[11px] font-medium text-indigo hover:underline"
                          >
                            Schedule it →
                          </Link>
                        </>
                      ) : (
                        <span className="text-faint">all sessions booked</span>
                      )}
                    </td>

                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
