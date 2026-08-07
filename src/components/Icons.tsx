// Minimal inline icon set (stroke, inherits currentColor). Keeps the app
// dependency-free and consistent. size defaults to 1em so it scales with text.

type P = { className?: string; size?: number | string };
const base = (size: P["size"]) => ({
  width: size ?? "1em",
  height: size ?? "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const ArrowLeft = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const Calendar = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <rect x="4" y="5.5" width="16" height="15" rx="2" />
    <path d="M8 3.5v4M16 3.5v4M4 10h16" />
  </svg>
);

export const Clipboard = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <rect x="6" y="4.5" width="12" height="16" rx="2" />
    <path d="M9 4.5a3 3 0 0 1 6 0M9.5 11h5M9.5 14.5h5" />
  </svg>
);

export const Chart = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M4 20V4M4 20h16M8 20v-6M12.5 20V9M17 20v-9" />
  </svg>
);

export const Users = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.6M17 20a5.5 5.5 0 0 0-2.5-4.6" />
  </svg>
);

export const Pulse = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M3 12h4l2.5-7 5 14L17 12h4" />
  </svg>
);

export const Mail = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M4.5 7l7.5 6 7.5-6" />
  </svg>
);

export const Upload = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 16V4M7 8.5L12 4l5 4.5M4.5 17v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const Sparkle = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5z" />
  </svg>
);
