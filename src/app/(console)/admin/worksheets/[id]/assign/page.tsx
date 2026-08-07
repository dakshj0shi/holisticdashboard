import { notFound } from "next/navigation";
import { loadWorksheet } from "@/lib/worksheets";
import { loadBatches } from "@/app/actions";
import { db } from "@/lib/db";
import { Panel } from "@/components/Charts";
import { WorksheetAssignForm } from "@/components/WorksheetAssignForm";

export default async function AssignWorksheetPage({ params }: PageProps<"/admin/worksheets/[id]/assign">) {
  const { id } = await params;
  const [worksheet, batches, assignments] = await Promise.all([
    loadWorksheet(id),
    loadBatches(),
    db.worksheetAssignment.findMany({ where: { worksheetId: id }, include: { batch: true } }),
  ]);
  if (!worksheet) notFound();

  return (
    <div className="space-y-6">
      <Panel
        title="New assignment"
        hint="appears on every trainee's dashboard immediately"
      >
        <WorksheetAssignForm
          worksheetId={id}
          batches={batches.map((b) => ({ id: b.id, name: b.name, program: b.program }))}
        />
      </Panel>

      <Panel title={`Existing assignments (${assignments.length})`}>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted">Not assigned to any batch yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Timing</th>
                  <th className="py-2 pr-4">Due</th>
                  <th className="py-2 pr-4">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 font-medium text-ink">{a.batch.name}</td>
                    <td className="py-2 pr-4 capitalize text-muted">{a.timing}</td>
                    <td className="py-2 pr-4 text-muted">
                      {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-4 text-muted">{new Date(a.assignedAt).toLocaleDateString()}</td>
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
