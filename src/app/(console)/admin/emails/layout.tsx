import { db } from "@/lib/db";
import { RouteTabs } from "@/components/RouteTabs";

export default async function EmailsLayout({ children }: { children: React.ReactNode }) {
  const total = await db.emailLog.count();

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Emails</h1>
      <p className="mt-1 mb-6 text-muted">
        Read exactly what went out, edit the wording of the automated sends, or write a one-off
        message.
      </p>

      <RouteTabs
        tabs={[
          { key: "log", href: "/admin/emails", label: "Sent log", badge: total },
          { key: "compose", href: "/admin/emails/compose", label: "Compose with AI" },
          { key: "templates", href: "/admin/emails/templates", label: "Templates" },
        ]}
      />

      {children}
    </div>
  );
}
