import Link from "next/link";
import { loadWorksheets } from "@/lib/worksheets";
import { Panel } from "@/components/Charts";
import { WorksheetForm } from "@/components/WorksheetForm";

export default async function WorksheetsPage() {
  const worksheets = await loadWorksheets();

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Worksheets</h1>
      <p className="mt-1 mb-6 text-muted">Author questionnaires, assign them to batches, and review results.</p>

      <div className="mb-6">
        <Panel title="New worksheet">
          <WorksheetForm />
        </Panel>
      </div>

      <Panel title={`Worksheets (${worksheets.length})`}>
        {worksheets.length === 0 ? (
          <p className="text-sm text-muted">None yet — create one above.</p>
        ) : (
          <div className="space-y-2">
            {worksheets.map((w) => (
              <Link
                key={w.id}
                href={`/admin/worksheets/${w.id}`}
                className="flex items-center justify-between rounded-lg border border-line px-4 py-3 hover:bg-paper-2"
              >
                <div>
                  <p className="font-medium text-ink">{w.title}</p>
                  {w.description && <p className="text-sm text-muted">{w.description}</p>}
                </div>
                <span className="text-xs text-faint">
                  {w._count.items} questions · {w._count.assignments} assignments
                </span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
