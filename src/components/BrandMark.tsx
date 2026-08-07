// A compass/rising-arrow mark — pure decoration, aria-hidden.

export function BrandMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 30l7-13 4 7 4-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="2.6" fill="currentColor" />
    </svg>
  );
}
