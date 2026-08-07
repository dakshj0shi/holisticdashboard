// Charts follow the dataviz method: magnitude = one hue (length carries value),
// ordered stages = one sequential ramp (light->dark), values labelled directly,
// text in ink tokens (never the series color), native-title hover on every mark.

import { bandMeta, ALL_BANDS } from "@/lib/scoring";

const HUE = "#2F3F8F"; // single magnitude hue (indigo)
const SEQ = ["#C9D0EA", "#9AA6D6", "#5F6EB0", "#2F3F8F"]; // sequential indigo, light -> dark
const PRE_HUE = "#B7BEDD"; // pre-worksheet shade (light)
const POST_HUE = "#2F3F8F"; // post-worksheet shade (dark) — same ramp as HUE

export function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="group rounded-[14px] border border-line bg-paper px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-wide text-faint">{label}</div>
        {icon && (
          <span className="text-indigo/70 transition-colors group-hover:text-indigo" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-1 font-display text-2xl text-ink">{value}</div>
    </div>
  );
}

// Circular completion indicator — one hue, value labelled in the center, native tooltip.
export function ProgressRing({ pct, size = 92, sublabel }: { pct: number; size?: number; sublabel?: string }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${clamped}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-paper-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={HUE}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl text-ink">{clamped}%</span>
        {sublabel && <span className="text-[10px] text-faint">{sublabel}</span>}
      </div>
    </div>
  );
}

export function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-line bg-paper p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-medium text-ink">{title}</h2>
        {hint && <span className="text-[12px] text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ---- Founders Mentality banding (see src/lib/scoring.ts) ----

// The headline number for a set of answers: mean out of 5 plus its band.
export function ScoreBadge({ avg, size = "md" }: { avg: number; size?: "sm" | "md" | "lg" }) {
  const m = bandMeta(avg);
  const pad = size === "lg" ? "px-3.5 py-1.5 text-base" : size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-medium ${m.bg} ${m.tone} ${pad}`}
      title={`${avg.toFixed(2)} / 5 — ${m.label} (${m.range}): ${m.meaning}`}
    >
      <span>{avg.toFixed(1)}</span>
      <span className="opacity-60">/ 5</span>
      <span className="border-l border-current/25 pl-2">{m.label}</span>
    </span>
  );
}

// Where the mean sits on the 1–5 scale, with the three bands drawn behind it.
export function BandScale({ avg }: { avg: number }) {
  const m = bandMeta(avg);
  const pct = ((Math.min(5, Math.max(1, avg)) - 1) / 4) * 100;
  return (
    <div>
      <div className="relative h-7 overflow-hidden rounded-lg" title={`${avg.toFixed(2)} / 5 — ${m.label}`}>
        <div className="absolute inset-0 flex">
          {ALL_BANDS.map((b) => (
            <div
              key={b.band}
              className="h-full"
              style={{
                width: b.band === "low" ? "37.5%" : b.band === "medium" ? "25%" : "37.5%",
                backgroundColor: `${b.hex}22`,
              }}
            />
          ))}
        </div>
        <div className="absolute top-0 h-full w-[3px] rounded" style={{ left: `calc(${pct}% - 1.5px)`, backgroundColor: m.hex }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-faint">
        <span>1.0 low</span>
        <span>2.5</span>
        <span>3.5</span>
        <span>high 5.0</span>
      </div>
    </div>
  );
}

// How many respondents landed in each band.
export function BandBreakdown({ buckets }: { buckets: { label: string; count: number; hex: string }[] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;
  return (
    <div className="space-y-2.5">
      {buckets.map((b) => {
        const share = Math.round((b.count / total) * 100);
        return (
          <div key={b.label} className="flex items-center gap-3" title={`${b.label}: ${b.count} of ${total} (${share}%)`}>
            <span className="w-16 shrink-0 text-[13px] text-muted">{b.label}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-paper-2">
              <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(2, share)}%`, backgroundColor: b.hex }} />
            </div>
            <span className="w-16 shrink-0 text-right text-sm text-ink">
              {b.count} <span className="text-faint">· {share}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Ordered stages — one bar per bucket, sequential ramp, count + share labelled.
export function ProgressDistribution({ buckets }: { buckets: { label: string; count: number }[] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="space-y-2.5">
      {buckets.map((b, i) => {
        const share = Math.round((b.count / total) * 100);
        return (
          <div key={b.label} className="flex items-center gap-3" title={`${b.label}: ${b.count} (${share}%)`}>
            <span className="w-24 shrink-0 text-[13px] text-muted">{b.label}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-paper-2">
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: `${Math.max(2, (b.count / max) * 100)}%`, backgroundColor: SEQ[i] ?? HUE }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-sm text-ink">
              {b.count} <span className="text-faint">· {share}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Single measure across categories — ONE hue, length is the value, % labelled.
export function TrackCompletionBars({ data }: { data: { title: string; pct: number }[] }) {
  return (
    <div className="space-y-2.5">
      {data.map((t) => (
        <div key={t.title} className="flex items-center gap-3" title={`${t.title}: ${t.pct}%`}>
          <span className="w-36 shrink-0 truncate text-[13px] text-ink">{t.title}</span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-paper-2">
            <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(2, t.pct)}%`, backgroundColor: HUE }} />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-medium text-muted">{t.pct}%</span>
        </div>
      ))}
    </div>
  );
}

// Change over time — single series, one hue, hover per day, endpoints + peak labelled.
export function ActivityChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const peak = data.reduce((m, d) => (d.count > m.count ? d : m), data[0] ?? { date: "", count: 0 });
  const totalEvents = data.reduce((s, d) => s + d.count, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[12px] text-faint">
        <span>{totalEvents} events</span>
        <span>peak {peak.count} on {peak.date}</span>
      </div>
      <div className="flex h-28 items-end gap-1.5" style={{ borderBottom: "1px solid var(--color-line)" }}>
        {data.map((d) => (
          <div key={d.date} className="flex flex-1 items-end justify-center" title={`${d.date}: ${d.count} events`}>
            <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(3, (d.count / max) * 100)}%`, backgroundColor: HUE }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-faint">
        <span>{data[0]?.date}</span>
        <span>{data[Math.floor(data.length / 2)]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// Worksheet results — one bar per Likert bucket (1-5), sequential ramp, count + % labelled.
export function LikertDistribution({ buckets }: { buckets: { label: string; count: number }[] }) {
  return <ProgressDistribution buckets={buckets} />;
}

// One statement per row, single hue, bar length = average score scaled 1-5 -> %.
export function AveragePerStatementBars({
  data,
}: {
  data: { prompt: string; avg: number }[];
}) {
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} title={`${d.prompt}: avg ${d.avg.toFixed(1)} / 5`}>
          <div className="mb-1 text-[13px] text-ink">{d.prompt}</div>
          <div className="flex items-center gap-3">
            <div className="h-5 flex-1 overflow-hidden rounded bg-paper-2">
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: `${Math.max(2, (d.avg / 5) * 100)}%`, backgroundColor: HUE }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-sm font-medium text-muted">{d.avg.toFixed(1)}/5</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Pre vs post — two shades of the same ramp per statement, both values labelled.
export function PrePostCompareBars({
  data,
}: {
  data: { prompt: string; pre: number; post: number }[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-[12px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PRE_HUE }} /> Pre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: POST_HUE }} /> Post
        </span>
      </div>
      {data.map((d, i) => (
        <div key={i}>
          <div className="mb-1 text-[13px] text-ink">{d.prompt}</div>
          <div className="space-y-1">
            <div className="flex items-center gap-3" title={`Pre: ${d.pre.toFixed(1)} / 5`}>
              <div className="h-4 flex-1 overflow-hidden rounded bg-paper-2">
                <div
                  className="h-full rounded-r-[4px]"
                  style={{ width: `${Math.max(2, (d.pre / 5) * 100)}%`, backgroundColor: PRE_HUE }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-xs text-muted">{d.pre.toFixed(1)}/5</span>
            </div>
            <div className="flex items-center gap-3" title={`Post: ${d.post.toFixed(1)} / 5`}>
              <div className="h-4 flex-1 overflow-hidden rounded bg-paper-2">
                <div
                  className="h-full rounded-r-[4px]"
                  style={{ width: `${Math.max(2, (d.post / 5) * 100)}%`, backgroundColor: POST_HUE }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-xs text-muted">{d.post.toFixed(1)}/5</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
