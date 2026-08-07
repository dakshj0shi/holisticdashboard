import { Panel } from "@/components/Charts";
import { ImportForm } from "@/components/ImportForm";

export default function ImportPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Import Excel</h1>
      <p className="mt-1 mb-6 text-muted">
        Upload the session tracker (.xlsx). Re-importing an updated copy is safe — batches, trainees, and
        session records are matched and updated rather than duplicated.
      </p>

      <Panel title="Upload">
        <ImportForm />
      </Panel>
    </div>
  );
}
