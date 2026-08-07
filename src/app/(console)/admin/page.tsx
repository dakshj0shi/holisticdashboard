import { loadOverview } from "@/lib/admin";
import { StatTile, TrackCompletionBars, ActivityChart, Panel } from "@/components/Charts";
import { Calendar, Users, Clipboard, Mail, Pulse } from "@/components/Icons";

export default async function OverviewPage() {
  const a = await loadOverview();

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Overview</h1>
      <p className="mt-1 mb-6 text-muted">Batches, scheduling, and worksheet activity at a glance.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Batches" value={a.totals.batches} icon={<Calendar />} />
        <StatTile label="Trainees" value={a.totals.trainees} icon={<Users />} />
        <StatTile label="Worksheets" value={a.totals.worksheets} icon={<Clipboard />} />
        <StatTile label="Submissions" value={a.totals.submissions} icon={<Pulse />} />
        <StatTile label="Emails sent" value={a.totals.emailsSent} icon={<Mail />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Activity — last 14 days">
          <ActivityChart data={a.activity} />
        </Panel>

        <Panel title="Session completion by batch" hint="completed slots / total sessions">
          {a.perBatch.length === 0 ? (
            <p className="text-sm text-muted">No batches yet — import your Excel roster or create one.</p>
          ) : (
            <TrackCompletionBars data={a.perBatch} />
          )}
        </Panel>
      </div>
    </div>
  );
}
