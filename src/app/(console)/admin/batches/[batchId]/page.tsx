import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBatch, loadBatches, loadFacilitatorOptions } from "@/app/actions";
import { Panel, StatTile } from "@/components/Charts";
import { TabNav } from "@/components/TabNav";
import { TraineeForm } from "@/components/TraineeForm";
import { ScheduleSlotForm } from "@/components/ScheduleSlotForm";
import { ObservationGrid } from "@/components/ObservationGrid";
import { BatchEditForm } from "@/components/BatchEditForm";
import { BatchDescriptionForm } from "@/components/BatchDescriptionForm";
import { RosterImportForm } from "@/components/RosterImportForm";
import { SessionSummaryForm } from "@/components/SessionSummaryForm";
import { suggestNextSessionDate } from "@/lib/scheduling";
import { Calendar, Users, Clipboard } from "@/components/Icons";

const TABS = ["sessions", "trainees", "description", "settings"] as const;

export default async function BatchDetailPage({ params, searchParams }: PageProps<"/admin/batches/[batchId]">) {
  const [{ batchId }, sp] = await Promise.all([params, searchParams]);
  const raw = typeof sp.tab === "string" ? sp.tab : "sessions";
  const tab = (TABS as readonly string[]).includes(raw) ? raw : "sessions";

  const [batch, allBatches, facilitators] = await Promise.all([
    loadBatch(batchId),
    loadBatches(),
    loadFacilitatorOptions(),
  ]);
  if (!batch) notFound();

  const suggested = suggestNextSessionDate(allBatches, batchId);
  const suggestedDateStr = suggested ? suggested.toISOString().slice(0, 10) : undefined;

  const scheduled = batch.slots.filter((s) => s.status !== "unscheduled").length;
  const completed = batch.slots.filter((s) => s.status === "completed").length;
  const missingEmail = batch.trainees.filter((t) => !t.email).length;
  const base = `/admin/batches/${batchId}`;

  return (
    <div>
      <Link href="/admin/batches" className="text-sm text-indigo hover:underline">
        ← All batches
      </Link>
      <h1 className="mt-2 font-display text-3xl text-ink">{batch.name}</h1>
      <p className="mt-1 mb-6 text-muted">
        {batch.program} · {batch.sessionCount} sessions · {batch.trainees.length} trainees · Facilitator:{" "}
        {batch.facilitator ? (
          <span className="text-ink">{batch.facilitator.name}</span>
        ) : (
          <span className="text-faint">unassigned</span>
        )}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Trainees" value={batch.trainees.length} icon={<Users />} />
        <StatTile label="Scheduled" value={`${scheduled}/${batch.sessionCount}`} icon={<Calendar />} />
        <StatTile label="Completed" value={`${completed}/${batch.sessionCount}`} icon={<Clipboard />} />
        <StatTile label="Missing email" value={missingEmail} />
      </div>

      {missingEmail > 0 && (
        <div className="mb-6 rounded-lg border border-amber/30 bg-amber/8 px-4 py-3 text-sm text-ink">
          {missingEmail} trainee(s) in this batch have no email — they won&apos;t receive scheduling emails until
          you add one in Trainees.
        </div>
      )}

      <TabNav
        active={tab}
        tabs={[
          { key: "sessions", href: base, label: "Sessions", badge: batch.sessionCount },
          { key: "trainees", href: `${base}?tab=trainees`, label: "Trainees", badge: batch.trainees.length },
          { key: "description", href: `${base}?tab=description`, label: "Description" },
          { key: "settings", href: `${base}?tab=settings`, label: "Settings" },
        ]}
      />

      {tab === "sessions" && (
        <Panel title="Sessions" hint="Scheduling a date emails every trainee in this batch">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Schedule</th>
                  <th className="py-2 pr-4">Summary</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const nextUnscheduledId = batch.slots.find((s) => s.status === "unscheduled")?.id;
                  return batch.slots.map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-4 text-muted">Session {s.index}</td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs capitalize text-muted">{s.status}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <ScheduleSlotForm
                          slot={{
                            id: s.id,
                            index: s.index,
                            status: s.status,
                            scheduledDate: s.scheduledDate ? new Date(s.scheduledDate).toISOString().slice(0, 10) : null,
                          }}
                          suggestedDate={s.id === nextUnscheduledId ? suggestedDateStr : undefined}
                        />
                      </td>
                      <td className="py-2.5 pr-4">
                        {s.status === "unscheduled" ? (
                          <span className="text-xs text-faint">Schedule first</span>
                        ) : (
                          <SessionSummaryForm slotId={s.id} initialSummary={s.summary} />
                        )}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === "trainees" && (
        <div className="space-y-6">
          <Panel title={`Trainees & session tracking (${batch.trainees.length})`}>
            {batch.trainees.length === 0 ? (
              <p className="text-sm text-muted">No trainees in this batch yet — add one below.</p>
            ) : (
              <ObservationGrid
                trainees={batch.trainees.map((t) => ({
                  id: t.id,
                  name: t.email ? t.name : `${t.name} (missing email)`,
                  oneOnOneNote: t.oneOnOneNote,
                  records: t.sessionRecords.map((r) => ({ slotId: r.slotId, completed: r.completed, observation: r.observation })),
                }))}
                slots={batch.slots.map((s) => ({ id: s.id, index: s.index }))}
              />
            )}
          </Panel>

          <Panel title="Add trainee to this batch">
            <TraineeForm
              batches={allBatches.map((b) => ({ id: b.id, name: b.name, program: b.program }))}
              defaultBatchId={batch.id}
            />
          </Panel>
        </div>
      )}

      {tab === "description" && (
        <Panel title="About this batch" hint="Freeform notes — goals, audience, anything worth flagging">
          <BatchDescriptionForm batchId={batch.id} description={batch.description} />
        </Panel>
      )}

      {tab === "settings" && (
        <div className="space-y-6">
          <Panel title="Batch settings" hint="Change the name, session count, or facilitator">
            <BatchEditForm
              batch={{
                id: batch.id,
                name: batch.name,
                sessionCount: batch.sessionCount,
                traineeCount: batch.trainees.length,
                facilitatorId: batch.facilitatorId,
              }}
              facilitators={facilitators}
            />
          </Panel>

          <Panel title="Export this batch" hint="Excel downloads scoped to just this batch">
            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/export/roster?batchId=${batch.id}`}
                className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-2"
              >
                Export trainee roster
              </a>
              <a
                href={`/api/export/facilitators?batchId=${batch.id}`}
                className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-2"
              >
                Export facilitator report
              </a>
            </div>
          </Panel>

          <Panel
            title="Import roster into this batch"
            hint='Name, Email, Department, S1..Sn, "1:1 Note" — matches the roster export above'
          >
            <RosterImportForm batchId={batch.id} />
          </Panel>
        </div>
      )}
    </div>
  );
}
