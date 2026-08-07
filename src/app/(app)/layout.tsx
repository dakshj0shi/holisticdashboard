import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppHeader } from "@/components/AppHeader";
import { RouteTabs } from "@/components/RouteTabs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");

  // Badge the Worksheets tab with what's still outstanding — the main thing a
  // trainee needs pulled to their attention.
  const me = await db.user.findUnique({ where: { id: user.id }, select: { batchId: true } });
  const pendingCount = me?.batchId
    ? await db.worksheetAssignment.count({
        where: { batchId: me.batchId, submissions: { none: { userId: user.id } } },
      })
    : 0;

  return (
    <div className="min-h-full">
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8">
        <RouteTabs
          tabs={[
            { key: "dashboard", href: "/dashboard", label: "Overview" },
            { key: "schedule", href: "/schedule", label: "Schedule" },
            { key: "worksheets", href: "/worksheets", label: "Worksheets", badge: pendingCount },
            { key: "results", href: "/results", label: "My results" },
          ]}
        />
        {children}
      </main>
    </div>
  );
}
