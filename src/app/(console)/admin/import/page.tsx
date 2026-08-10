import { Panel } from "@/components/Charts";
import { ImportForm } from "@/components/ImportForm";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Import & export</h1>
        <p className="mt-1 mb-6 text-muted">
          Upload the session tracker (.xlsx). Re-importing an updated copy is safe — batches, trainees, and
          session records are matched and updated rather than duplicated.
        </p>

        <Panel title="Import the full session tracker">
          <ImportForm />
        </Panel>
      </div>

      <Panel title="Export" hint="Every batch, every trainee — for a single batch's export, use that batch's Settings tab">
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/export/roster"
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-2"
          >
            Export trainee roster (all batches)
          </a>
          <a
            href="/api/export/facilitators"
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-2"
          >
            Export facilitator report
          </a>
        </div>
      </Panel>
    </div>
  );
}
