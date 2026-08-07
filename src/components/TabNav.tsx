// Underline tab bar. Server component on purpose — the page already knows which tab
// is active (it read the route/searchParams), so passing `active` in avoids shipping
// any client-side matching logic. Works for both route tabs and ?tab= tabs.

import Link from "next/link";

export type Tab = { key: string; href: string; label: string; badge?: number };

export function TabNav({ tabs, active }: { tabs: Tab[]; active: string }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
              on
                ? "border-indigo font-medium text-indigo"
                : "border-transparent text-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                  on ? "bg-indigo text-paper" : "bg-paper-2 text-muted"
                }`}
              >
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
