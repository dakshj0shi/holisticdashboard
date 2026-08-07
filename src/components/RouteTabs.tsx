"use client";

// Tab bar for tabs that are real routes (not ?tab= params) — derives the active tab
// from the pathname so a shared layout can render it once for all its children.

import { usePathname } from "next/navigation";
import { TabNav, type Tab } from "./TabNav";

export function RouteTabs({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  // Longest matching href wins, so "/x/assign" beats the "/x" index tab.
  const active =
    [...tabs]
      .sort((a, b) => b.href.length - a.href.length)
      .find((t) => path === t.href || path.startsWith(`${t.href}/`))?.key ?? tabs[0]?.key ?? "";
  return <TabNav tabs={tabs} active={active} />;
}
