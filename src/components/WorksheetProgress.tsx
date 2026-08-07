// Shared between the trainee's own /results page and the admin's per-trainee view
// (admin/trainees/[id]) — same before/after scoring treatment in both places.
import { Panel, ScoreBadge, BandScale } from "@/components/Charts";
import { bandMeta, ALL_BANDS } from "@/lib/scoring";
import type { loadUserProgress } from "@/lib/worksheets";

type Progress = Awaited<ReturnType<typeof loadUserProgress>>;

export function WorksheetProgress({ results, emptyMessage }: { results: Progress; emptyMessage: string }) {
  if (results.every((r) => !r.result)) {
    return (
      <Panel title="Nothing to show yet">
        <p className="text-sm text-muted">{emptyMessage}</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {results.map(({ worksheet, result }) =>
        result ? (
          <Panel
            key={worksheet.id}
            title={worksheet.title}
            hint={result.hasPost ? "pre vs post" : "post reflection not submitted yet"}
          >
            {result.preAvg !== null && (
              <div className="animate-in mb-5 rounded-lg border border-line bg-paper-2 p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-faint">Before the programme</div>
                    <div className="mt-1">
                      <ScoreBadge avg={result.preAvg} size="lg" />
                    </div>
                  </div>

                  {result.hasPost && result.postAvg !== null && (
                    <>
                      <span className="text-2xl text-faint">→</span>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-faint">After</div>
                        <div className="mt-1">
                          <ScoreBadge avg={result.postAvg} size="lg" />
                        </div>
                      </div>
                      {(() => {
                        const delta = result.postAvg - result.preAvg;
                        const better = delta < 0;
                        return (
                          <div className="ml-auto text-right">
                            <div className="text-[11px] uppercase tracking-wide text-faint">Change</div>
                            <div
                              className={`mt-1 text-lg font-medium ${
                                better ? "text-teal" : delta === 0 ? "text-muted" : "text-rose"
                              }`}
                            >
                              {delta > 0 ? "+" : ""}
                              {delta.toFixed(2)}
                              <span className="ml-1 text-xs">{better ? "improved" : delta === 0 ? "no change" : "worsened"}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                <div className="mt-4">
                  <BandScale avg={result.hasPost && result.postAvg !== null ? result.postAvg : result.preAvg} />
                </div>

                <p className="mt-3 text-sm text-muted">
                  {bandMeta(result.hasPost && result.postAvg !== null ? result.postAvg : result.preAvg).meaning}.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {ALL_BANDS.map((b) => (
                    <span key={b.band} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${b.bg} ${b.tone}`}>
                      {b.label} {b.range}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        ) : null,
      )}
    </div>
  );
}
