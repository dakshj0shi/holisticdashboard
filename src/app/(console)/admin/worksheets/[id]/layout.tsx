import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWorksheet } from "@/lib/worksheets";
import { db } from "@/lib/db";
import { RouteTabs } from "@/components/RouteTabs";

export default async function WorksheetLayout({
  params,
  children,
}: LayoutProps<"/admin/worksheets/[id]">) {
  const { id } = await params;
  const [worksheet, assignmentCount] = await Promise.all([
    loadWorksheet(id),
    db.worksheetAssignment.count({ where: { worksheetId: id } }),
  ]);
  if (!worksheet) notFound();

  const base = `/admin/worksheets/${id}`;

  return (
    <div>
      <Link href="/admin/worksheets" className="text-sm text-indigo hover:underline">
        ← All worksheets
      </Link>
      <h1 className="mt-2 font-display text-3xl text-ink">{worksheet.title}</h1>
      <p className="mt-1 mb-6 text-muted">
        {worksheet.description ?? `${worksheet.items.length} questions`}
      </p>

      <RouteTabs
        tabs={[
          { key: "questions", href: base, label: "Questions", badge: worksheet.items.length },
          { key: "assign", href: `${base}/assign`, label: "Assign", badge: assignmentCount },
          { key: "results", href: `${base}/results`, label: "Results" },
        ]}
      />

      {children}
    </div>
  );
}
