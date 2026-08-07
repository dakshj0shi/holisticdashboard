import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadBatches } from "@/app/actions";
import { loadUserProgress } from "@/lib/worksheets";
import { Panel } from "@/components/Charts";
import { TraineeEditForm } from "@/components/TraineeEditForm";
import { WorksheetProgress } from "@/components/WorksheetProgress";

export default async function TraineeDetailPage({ params }: PageProps<"/admin/trainees/[id]">) {
  const { id } = await params;
  const [trainee, batches] = await Promise.all([
    db.user.findUnique({ where: { id } }),
    loadBatches(),
  ]);
  if (!trainee || trainee.role !== "trainee") notFound();

  const progress = await loadUserProgress(trainee.id, trainee.batchId);

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">{trainee.name}</h1>
      <p className="mt-1 mb-6 text-muted">Edit trainee details, batch assignment, or reset their password.</p>

      <div className="mb-6">
        <Panel title="Details">
          <TraineeEditForm
            trainee={{
              id: trainee.id,
              name: trainee.name,
              email: trainee.email,
              department: trainee.department,
              batchId: trainee.batchId,
              active: trainee.active,
            }}
            batches={batches.map((b) => ({ id: b.id, name: b.name, program: b.program }))}
          />
        </Panel>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-ink">Worksheet progress</h2>
        {trainee.batchId ? (
          <WorksheetProgress
            results={progress}
            emptyMessage="No worksheets assigned to this trainee's batch yet, or none submitted."
          />
        ) : (
          <Panel title="Nothing to show yet">
            <p className="text-sm text-muted">This trainee isn&apos;t assigned to a batch yet.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
