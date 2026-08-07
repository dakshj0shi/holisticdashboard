import Link from "next/link";
import { loadTrainees, loadTraineeCounts } from "@/lib/admin";
import { loadBatches } from "@/app/actions";
import { Panel, StatTile } from "@/components/Charts";
import { TabNav } from "@/components/TabNav";
import { TraineeForm } from "@/components/TraineeForm";
import { Users, Mail, Calendar } from "@/components/Icons";

const TABS = ["all", "add"] as const;

export default async function TraineesPage({ searchParams }: PageProps<"/admin/trainees">) {
  const sp = await searchParams;
  const raw = typeof sp.tab === "string" ? sp.tab : "all";
  const tab = (TABS as readonly string[]).includes(raw) ? raw : "all";
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const [{ rows }, batches, counts] = await Promise.all([
    loadTrainees({ q }),
    loadBatches(),
    loadTraineeCounts(),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Trainees</h1>
      <p className="mt-1 mb-6 text-muted">Everyone tracked across all batches.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Total" value={counts.total} icon={<Users />} />
        <StatTile label="Missing email" value={counts.missingEmail} icon={<Mail />} />
        <StatTile label="Batches" value={batches.length} icon={<Calendar />} />
      </div>

      <TabNav
        active={tab}
        tabs={[
          { key: "all", href: "/admin/trainees", label: "All trainees", badge: counts.total },
          { key: "add", href: "/admin/trainees?tab=add", label: "Add trainee" },
        ]}
      />

      {tab === "add" ? (
        <Panel title="Add trainee">
          <TraineeForm batches={batches.map((b) => ({ id: b.id, name: b.name, program: b.program }))} />
        </Panel>
      ) : (
        <Panel title={`Trainees (${rows.length}${q ? " filtered" : ""})`}>
          <form className="mb-4 flex flex-wrap items-center gap-3" method="get">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name, email, department…"
              className="w-64 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
            />
            <button type="submit" className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-paper-2">
              Search
            </button>
            {q && (
              <Link href="/admin/trainees" className="text-sm text-indigo hover:underline">
                Clear
              </Link>
            )}
          </form>

          {rows.length === 0 ? (
            <p className="text-sm text-muted">No trainees match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Department</th>
                    <th className="py-2 pr-4">Batch</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="py-2 pr-4">
                        <Link href={`/admin/trainees/${r.id}`} className="font-medium text-indigo hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        {r.email ? (
                          <span className="text-muted">{r.email}</span>
                        ) : (
                          <span className="rounded-full bg-rose/10 px-2 py-0.5 text-xs text-rose">missing email</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted">{r.department ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted">{r.batchName ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted">{r.active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
