// Founders Mentality scoring: average every Likert answer, then place the mean in
// one of three bands.
//
//   1.0 – 2.5   low
//   2.5 – 3.5   medium
//   3.5 – 5.0   high
//
// Boundaries are inclusive at the lower edge (2.5 is medium, 3.5 is high), so every
// value in 1..5 lands in exactly one band.
//
// NOTE ON DIRECTION: every statement in "The Mirror" is negatively framed ("we are
// losing our differentiation", "we have too many bureaucrats"). Agreeing strongly
// therefore describes a *worse* situation, so a HIGH band means high concern, not
// high performance. The colours below follow that reading. If your team interprets
// the score the other way round, swap the `tone` values here and nothing else changes.

export type Band = "low" | "medium" | "high";

export type BandMeta = {
  band: Band;
  label: string;
  range: string;
  /** Tailwind text colour token for the band. */
  tone: string;
  /** Tailwind background token for pills/bars. */
  bg: string;
  /** Hex, for SVG fills where a class won't do. */
  hex: string;
  meaning: string;
};

const META: Record<Band, BandMeta> = {
  low: {
    band: "low",
    label: "Low",
    range: "1.0 – 2.5",
    tone: "text-teal",
    bg: "bg-teal/12",
    hex: "#1f6f66",
    meaning: "Little agreement that these issues are present",
  },
  medium: {
    band: "medium",
    label: "Medium",
    range: "2.5 – 3.5",
    tone: "text-amber",
    bg: "bg-amber/12",
    hex: "#b0790e",
    meaning: "Mixed signals — worth discussing",
  },
  high: {
    band: "high",
    label: "High",
    range: "3.5 – 5.0",
    tone: "text-rose",
    bg: "bg-rose/12",
    hex: "#a23a4a",
    meaning: "Strong agreement that these issues are present",
  },
};

export function scoreBand(avg: number): Band {
  if (avg < 2.5) return "low";
  if (avg < 3.5) return "medium";
  return "high";
}

export function bandMeta(avg: number): BandMeta {
  return META[scoreBand(avg)];
}

export const ALL_BANDS: BandMeta[] = [META.low, META.medium, META.high];

/** Mean of the supplied Likert values, or null when there's nothing to average. */
export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** How many submissions fall in each band, given one average per submission. */
export function bandCounts(averages: number[]) {
  return ALL_BANDS.map((m) => ({
    label: m.label,
    count: averages.filter((a) => scoreBand(a) === m.band).length,
    hex: m.hex,
  }));
}
