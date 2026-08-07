import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { BrandMark } from "./BrandMark";
import type { SessionUser } from "@/lib/auth";

export function AppHeader({ user }: { user: SessionUser }) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-3 text-ink">
          <span className="text-indigo">
            <BrandMark size={30} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[17px] font-medium tracking-tight">Founders Mentality</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-faint">Portal</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-ink">{user.name}</div>
            <div className="text-[11px] uppercase tracking-wide text-faint">{user.role}</div>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-indigo/10 text-sm font-medium text-indigo">
            {initials}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-muted transition-colors hover:bg-paper-2 hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
