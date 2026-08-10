"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { BrandMark } from "./BrandMark";
import { Chart, Users, Calendar, Clipboard, Mail, Pulse, Upload, ArrowLeft } from "./Icons";

const NAV: { section: string; items: { href: string; label: string; Icon: typeof Chart }[] }[] = [
  {
    section: "Program",
    items: [
      { href: "/admin", label: "Overview", Icon: Chart },
      { href: "/admin/planning", label: "Planning", Icon: Pulse },
      { href: "/admin/batches", label: "Batches", Icon: Calendar },
      { href: "/admin/trainees", label: "Trainees", Icon: Users },
    ],
  },
  {
    section: "Content",
    items: [{ href: "/admin/worksheets", label: "Worksheets", Icon: Clipboard }],
  },
  {
    section: "Communication",
    items: [{ href: "/admin/emails", label: "Emails", Icon: Mail }],
  },
  {
    section: "System",
    items: [
      { href: "/admin/activity", label: "Activity log", Icon: Pulse },
      { href: "/admin/import", label: "Import & Export", Icon: Upload },
    ],
  },
];

export function ConsoleSidebar({ name }: { name: string }) {
  const path = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col bg-slate text-paper lg:h-screen lg:w-60 lg:sticky lg:top-0">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <BrandMark size={26} />
        <div className="leading-none">
          <div className="font-display text-[15px]">Founders Mentality</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-paper/55">Admin Console</div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:mt-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
        {NAV.map(({ section, items }) => (
          <div key={section} className="flex shrink-0 gap-1 lg:mb-3 lg:flex-col lg:gap-0.5">
            <div className="hidden px-3 pb-1 text-[10px] uppercase tracking-[0.16em] text-paper/40 lg:block">
              {section}
            </div>
            {items.map(({ href, label, Icon }) => {
              const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-paper/15 font-medium text-paper" : "text-paper/70 hover:bg-paper/8 hover:text-paper"
                  }`}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto hidden gap-1 border-t border-paper/15 p-3 lg:flex lg:flex-col">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-paper/70 transition-colors hover:bg-paper/8 hover:text-paper"
        >
          <ArrowLeft size={16} /> Back to portal
        </Link>
        <div className="flex items-center justify-between px-3 pt-2">
          <span className="truncate text-[13px] text-paper/60">{name}</span>
          <form action={logoutAction}>
            <button type="submit" className="text-[13px] text-paper/70 underline-offset-2 hover:text-paper hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
