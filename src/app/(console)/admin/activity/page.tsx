import { loadActivity } from "@/lib/events";
import { Panel } from "@/components/Charts";

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const sp = await searchParams;
  const page = typeof sp.page === "string" ? parseInt(sp.page, 10) : 1;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const { rows, total, pages } = await loadActivity({ page, q });

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Activity log</h1>
      <p className="mt-1 mb-6 text-muted">Every logged action across the portal, newest first ({total} total).</p>

      <Panel title={`Events (page ${page} of ${pages})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Who</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 text-muted">{r.at}</td>
                    <td className="py-2 pr-4 text-ink">
                      {r.name} <span className="text-faint">({r.role})</span>
                    </td>
                    <td className="py-2 pr-4 text-ink">{r.label}</td>
                    <td className="py-2 pr-4 text-muted">{r.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
