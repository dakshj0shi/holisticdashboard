import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadTraineeWorksheets } from "@/lib/trainee";
import { Panel } from "@/components/Charts";
import { Clipboard } from "@/components/Icons";

const TIMING_STYLE: Record<string, string> = {
  pre: "bg-amber/10 text-amber",
  post: "bg-teal/10 text-teal",
  standalone: "bg-indigo/10 text-indigo",
};

export default async function WorksheetsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const me = await db.user.findUnique({ where: { id: user.id }, select: { batchId: true } });
  const { pending, done } = await loadTraineeWorksheets(user.id, me?.batchId ?? null);

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Worksheets</h1>
      <p className="mt-1 mb-6 text-muted">Reflections assigned to your batch. Each one can be submitted once.</p>

      <div className="space-y-6">
        <Panel title="To complete" hint={pending.length ? `${pending.length} waiting` : "all caught up"}>
          {pending.length === 0 ? (
            <p className="text-sm text-muted">Nothing waiting on you right now.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pending.map((a) => (
                <Link
                  key={a.id}
                  href={`/worksheets/${a.id}`}
                  className="group flex items-start gap-3 rounded-lg border border-line px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo/40 hover:shadow-[var(--shadow-card-hover)]"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo/10 text-indigo transition-colors group-hover:bg-indigo group-hover:text-paper">
                    <Clipboard size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{a.worksheet.title}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                          TIMING_STYLE[a.timing] ?? "bg-paper-2 text-muted"
                        }`}
                      >
                        {a.timing}
                      </span>
                      {a.dueDate && (
                        <span className="text-[11px] text-faint">due {new Date(a.dueDate).toLocaleDateString()}</span>
                      )}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Submitted" hint={`${done.length} complete`}>
          {done.length === 0 ? (
            <p className="text-sm text-muted">Nothing submitted yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {done.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="text-sm text-ink">{a.worksheet.title}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                        TIMING_STYLE[a.timing] ?? "bg-paper-2 text-muted"
                      }`}
                    >
                      {a.timing}
                    </span>
                    <span className="text-[11px] text-teal">
                      submitted {new Date(a.submissions[0].submittedAt).toLocaleDateString()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
