import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadAssignment } from "@/lib/worksheets";
import { db } from "@/lib/db";
import { WorksheetFillForm } from "@/components/WorksheetFillForm";

export default async function FillWorksheetPage({ params }: PageProps<"/worksheets/[assignmentId]">) {
  const { assignmentId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const assignment = await loadAssignment(assignmentId);
  if (!assignment || assignment.batchId !== (await db.user.findUnique({ where: { id: user.id } }))?.batchId) {
    notFound();
  }

  const existing = await db.worksheetSubmission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId: user.id } },
  });

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">{assignment!.worksheet.title}</h1>
      {assignment!.worksheet.description && <p className="mt-1 mb-6 text-muted">{assignment!.worksheet.description}</p>}

      {existing ? (
        <p className="rounded-lg border border-line bg-paper-2 px-4 py-3 text-sm text-muted">
          You already submitted this on {existing.submittedAt.toLocaleDateString()}. Thank you!
        </p>
      ) : (
        <WorksheetFillForm assignmentId={assignmentId} items={assignment!.worksheet.items} />
      )}
    </div>
  );
}
