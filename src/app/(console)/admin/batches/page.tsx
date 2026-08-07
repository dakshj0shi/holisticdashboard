import Link from "next/link";
import { loadBatches } from "@/app/actions";
import { BatchForm } from "@/components/BatchForm";
import { Panel } from "@/components/Charts";
import { suggestNextSessionDate } from "@/lib/scheduling";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function BatchesPage() {
  const [batches, user] = await Promise.all([loadBatches(), getCurrentUser()]);
  const isSuperAdmin = user ? (await db.user.findUnique({ where: { id: user.id } }))?.isSuperAdmin ?? false : false;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-ink">Batches & scheduling</h1>
        <a
          href="/api/export/facilitators"
          className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-paper-2"
        >
          {isSuperAdmin ? "Export all facilitators (Excel)" : "Export my sessions (Excel)"}
        </a>
      </div>
      <p className="mt-1 mb-6 text-muted">Create batches, then open one to schedule sessions and track completion.</p>

      <div className="mb-6">
        <Panel title="New batch">
          <BatchForm />
        </Panel>
      </div>

      <Panel title={`Batches (${batches.length})`}>
        {batches.length === 0 ? (
          <p className="text-sm text-muted">No batches yet — create one above or import your Excel roster.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Program</th>
                  <th className="py-2 pr-4">Facilitator</th>
                  <th className="py-2 pr-4">Trainees</th>
                  <th className="py-2 pr-4">Sessions</th>
                  <th className="py-2 pr-4">Scheduled</th>
                  <th className="py-2 pr-4">Next session</th>
                  <th className="py-2 pr-4">Suggested</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const scheduled = b.slots.filter((s) => s.status !== "unscheduled").length;
                  const upcoming = b.slots
                    .filter((s) => s.scheduledDate && s.status !== "completed")
                    .sort((a, c) => a.scheduledDate!.getTime() - c.scheduledDate!.getTime())[0];
                  const suggested = suggestNextSessionDate(batches, b.id);
                  return (
                    <tr key={b.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-4">
                        <Link href={`/admin/batches/${b.id}`} className="font-medium text-indigo hover:underline">
                          {b.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-muted">{b.program}</td>
                      <td className="py-2.5 pr-4 text-muted">
                        {b.facilitator ? b.facilitator.name : <span className="text-faint">unassigned</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-muted">{b._count.trainees}</td>
                      <td className="py-2.5 pr-4 text-muted">{b.sessionCount}</td>
                      <td className="py-2.5 pr-4 text-muted">
                        {scheduled}/{b.sessionCount}
                      </td>
                      <td className="py-2.5 pr-4 text-muted">
                        {upcoming ? `S${upcoming.index} · ${formatDate(upcoming.scheduledDate!)}` : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-muted">{suggested ? formatDate(suggested) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
