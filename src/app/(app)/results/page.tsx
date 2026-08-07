import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadUserProgress } from "@/lib/worksheets";
import { WorksheetProgress } from "@/components/WorksheetProgress";

export default async function ResultsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const trainee = await db.user.findUnique({ where: { id: user.id } });
  if (!trainee?.batchId) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink">Your results</h1>
        <p className="mt-1 text-muted">You&apos;re not assigned to a batch yet.</p>
      </div>
    );
  }

  const results = await loadUserProgress(user.id, trainee.batchId);

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Your results</h1>
      <p className="mt-1 mb-6 text-muted">
        Your own answers, scored 1–5. These statements describe problems, so a lower score means you see less of that
        problem — a drop from pre to post is an improvement.
      </p>

      <WorksheetProgress results={results} emptyMessage="Fill in your assigned worksheets and your results will appear here." />
    </div>
  );
}
