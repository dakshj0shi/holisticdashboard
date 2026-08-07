import { notFound } from "next/navigation";
import { loadWorksheet } from "@/lib/worksheets";
import { db } from "@/lib/db";
import { Panel } from "@/components/Charts";
import { WorksheetBuilder } from "@/components/WorksheetBuilder";

export default async function WorksheetDetailPage({ params }: PageProps<"/admin/worksheets/[id]">) {
  const { id } = await params;
  const [worksheet, assignments] = await Promise.all([
    loadWorksheet(id),
    db.worksheetAssignment.findMany({ where: { worksheetId: id }, include: { batch: true } }),
  ]);
  if (!worksheet) notFound();

  return (
    <div className="space-y-6">
      <Panel title="Questions" hint={`${worksheet.items.length} in this worksheet`}>
        <WorksheetBuilder worksheetId={id} items={worksheet.items} />
      </Panel>

      {assignments.length > 0 && (
        <Panel title={`Currently assigned to (${assignments.length})`}>
          <ul className="space-y-1 text-sm">
            {assignments.map((a) => (
              <li key={a.id} className="text-muted">
                <span className="font-medium text-ink">{a.batch.name}</span> — {a.timing}
                {a.dueDate && ` · due ${new Date(a.dueDate).toLocaleDateString()}`}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
