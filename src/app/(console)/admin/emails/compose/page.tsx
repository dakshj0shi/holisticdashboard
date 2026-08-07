import { db } from "@/lib/db";
import { Panel } from "@/components/Charts";
import { EmailComposeForm } from "@/components/EmailComposeForm";

export default async function ComposeEmailPage() {
  const [trainees, batches] = await Promise.all([
    db.user.findMany({
      where: { role: "trainee", active: true },
      orderBy: { name: "asc" },
      include: { batch: { select: { name: true } } },
    }),
    db.batch.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <Panel title="New message" hint="pick recipients, describe it, AI drafts, you review and send">
        <EmailComposeForm
          trainees={trainees.map((t) => ({ id: t.id, name: t.name, email: t.email, batchId: t.batchId, batchName: t.batch?.name ?? null }))}
          batches={batches.map((b) => ({ id: b.id, name: b.name }))}
        />
      </Panel>
    </div>
  );
}
