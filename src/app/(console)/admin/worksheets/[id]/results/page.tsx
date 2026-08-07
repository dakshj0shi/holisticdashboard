import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadWorksheet, loadAssignmentResults, loadPrePostComparison } from "@/lib/worksheets";
import {
  Panel,
  StatTile,
  AveragePerStatementBars,
  PrePostCompareBars,
  ScoreBadge,
  BandScale,
  BandBreakdown,
} from "@/components/Charts";
import { bandMeta, bandCounts, ALL_BANDS } from "@/lib/scoring";

export default async function WorksheetResultsPage({ params }: PageProps<"/admin/worksheets/[id]/results">) {
  const { id } = await params;
  const worksheet = await loadWorksheet(id);
  if (!worksheet) notFound();

  const assignments = await db.worksheetAssignment.findMany({ where: { worksheetId: id }, include: { batch: true } });

  const perAssignment = await Promise.all(
    assignments.map(async (a) => ({ assignment: a, results: await loadAssignmentResults(a.id) })),
  );

  // Batches that have both a "pre" and "post" assignment for this worksheet get a comparison.
  const batchIdsWithBoth = [...new Set(assignments.map((a) => a.batchId))].filter(
    (bid) =>
      assignments.some((a) => a.batchId === bid && a.timing === "pre") &&
      assignments.some((a) => a.batchId === bid && a.timing === "post"),
  );
  const comparisons = await Promise.all(
    batchIdsWithBoth.map(async (bid) => ({
      batch: assignments.find((a) => a.batchId === bid)!.batch,
      comparison: await loadPrePostComparison(id, bid),
    })),
  );

  // The headline should describe where the cohort stands NOW, so it reads from the
  // latest stage only. Averaging pre and post together would blend the situation before
  // the programme into the current score and understate any improvement.
  const averagesFor = (timings: string[]) =>
    perAssignment.filter((p) => timings.includes(p.assignment.timing)).flatMap((p) => p.results?.submissionAverages ?? []);

  const postAverages = averagesFor(["post"]);
  const preAverages = averagesFor(["pre"]);
  const currentAverages = postAverages.length ? postAverages : averagesFor(["pre", "standalone"]);
  const showingPost = postAverages.length > 0;

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const overall = mean(currentAverages);
  const priorOverall = showingPost ? mean(preAverages) : null;
  const allAverages = currentAverages;

  return (
    <div className="space-y-6">
      {overall !== null && (
        <Panel
          title="Founders Mentality score"
          hint={`${showingPost ? "current standing, from the post-programme reflection" : `mean of ${allAverages.length} responses`} · higher = stronger agreement the issue is present`}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <ScoreBadge avg={overall} size="lg" />
                {priorOverall !== null && (
                  <span className="text-sm text-muted">
                    was <span className="font-medium text-ink">{priorOverall.toFixed(1)}</span> ({bandMeta(priorOverall).label}) before the
                    programme
                    <span className={`ml-2 font-medium ${overall < priorOverall ? "text-teal" : overall > priorOverall ? "text-rose" : "text-muted"}`}>
                      {overall < priorOverall ? "↓" : overall > priorOverall ? "↑" : ""}
                      {Math.abs(overall - priorOverall).toFixed(2)}
                    </span>
                  </span>
                )}
              </div>
              <div className="mb-3 text-sm text-muted">{bandMeta(overall).meaning}</div>
              <BandScale avg={overall} />
              <div className="mt-4 grid grid-cols-3 gap-2">
                {ALL_BANDS.map((b) => (
                  <div key={b.band} className={`rounded-lg px-2.5 py-2 ${b.bg}`}>
                    <div className={`text-xs font-medium ${b.tone}`}>{b.label}</div>
                    <div className="text-[11px] text-muted">{b.range}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[12px] uppercase tracking-wide text-faint">
                Respondents per band {showingPost && <span className="normal-case tracking-normal">(after)</span>}
              </div>
              <BandBreakdown buckets={bandCounts(allAverages)} />
            </div>
          </div>
        </Panel>
      )}

      {comparisons.map(({ batch, comparison }) =>
        comparison ? (
          <Panel
            key={batch.id}
            title={`${batch.name} — Pre vs Post`}
            hint={`${comparison.preSubmissions} pre · ${comparison.postSubmissions} post submissions`}
          >
            {comparison.preAvg !== null && comparison.postAvg !== null && (
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper-2 px-4 py-3">
                <span className="text-sm text-muted">Before</span>
                <ScoreBadge avg={comparison.preAvg} />
                <span className="text-faint">→</span>
                <span className="text-sm text-muted">After</span>
                <ScoreBadge avg={comparison.postAvg} />
                {(() => {
                  const delta = comparison.postAvg - comparison.preAvg;
                  const better = delta < 0; // negatively framed statements: lower is an improvement
                  return (
                    <span className={`ml-auto text-sm font-medium ${better ? "text-teal" : delta === 0 ? "text-muted" : "text-rose"}`}>
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(2)} {better ? "improved" : delta === 0 ? "no change" : "worsened"}
                    </span>
                  );
                })()}
              </div>
            )}
            <PrePostCompareBars data={comparison.data} />
          </Panel>
        ) : null,
      )}

      {perAssignment.map(({ assignment, results }) => (
        <Panel
          key={assignment.id}
          title={`${assignment.batch.name} — ${assignment.timing}`}
          hint={`${results?.submissionCount ?? 0} submissions`}
        >
          {!results || results.submissionCount === 0 ? (
            <p className="text-sm text-muted">No submissions yet.</p>
          ) : (
            <>
              {results.overallAvg !== null && (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="text-[12px] uppercase tracking-wide text-faint">Group score</span>
                  <ScoreBadge avg={results.overallAvg} />
                </div>
              )}

              <AveragePerStatementBars data={results.perStatement.map((p) => ({ prompt: p.prompt, avg: p.avg }))} />

              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 text-[12px] uppercase tracking-wide text-faint">Individual scores</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
                        <th className="py-2 pr-4">Trainee</th>
                        <th className="py-2 pr-4">Score</th>
                        <th className="py-2 pr-4">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.submissions.map((s, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="py-2 pr-4 text-ink">{s.userName}</td>
                          <td className="py-2 pr-4">
                            {s.avg !== null ? <ScoreBadge avg={s.avg} size="sm" /> : <span className="text-faint">—</span>}
                          </td>
                          <td className="py-2 pr-4 text-muted">{new Date(s.submittedAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </Panel>
      ))}

      {perAssignment.length === 0 && (
        <Panel title="No results yet">
          <p className="text-sm text-muted">
            This worksheet isn&apos;t assigned to any batch yet — assign it first, then results appear here as
            trainees submit.
          </p>
        </Panel>
      )}

      {perAssignment.length > 0 && allAverages.length === 0 && (
        <div className="mb-3">
          <StatTile label="Responses so far" value={0} />
        </div>
      )}
    </div>
  );
}
