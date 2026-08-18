import { db } from "@/lib/db";
import { Panel, StatTile } from "@/components/Charts";
import { Mail } from "@/components/Icons";

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-teal/10 text-teal",
  sent_no_sentfolder: "bg-amber/10 text-amber",
  simulated: "bg-indigo/10 text-indigo",
  failed: "bg-rose/10 text-rose",
  skipped_no_email: "bg-paper-2 text-faint",
};

// The log stores each email's rendered HTML. Show it as the words a trainee actually
// read rather than as markup — this table is where you check what went out.
function asText(html: string) {
  return html
    .replace(/<\/p>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}

export default async function EmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const kind = typeof sp.kind === "string" ? sp.kind : undefined;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (kind) where.kind = kind;

  const [logs, total, sentCount, simulatedCount, failedCount] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { toUser: { select: { name: true } } },
    }),
    db.emailLog.count(),
    db.emailLog.count({ where: { status: { in: ["sent", "sent_no_sentfolder"] } } }),
    db.emailLog.count({ where: { status: "simulated" } }),
    db.emailLog.count({ where: { status: "failed" } }),
  ]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total" value={total} icon={<Mail />} />
        <StatTile label="Sent" value={sentCount} />
        <StatTile label="Simulated (dev)" value={simulatedCount} />
        <StatTile label="Failed" value={failedCount} />
      </div>

      <Panel
        title={`Log (${logs.length}${status || kind ? " filtered" : ""})`}
        hint="Click a subject to read the message that was sent"
      >
        {logs.length === 0 ? (
          <p className="text-sm text-muted">No emails logged yet — schedule a session to see one here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2 pr-4">Kind</th>
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 text-muted">{l.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                    <td className="py-2 pr-4 text-ink">
                      {l.toUser.name} <span className="text-faint">{l.toEmail && `<${l.toEmail}>`}</span>
                    </td>
                    <td className="py-2 pr-4 text-muted">{l.kind}</td>
                    <td className="py-2 pr-4 text-ink">
                      <details>
                        <summary className="cursor-pointer marker:text-faint">{l.subject}</summary>
                        <p className="mt-2 max-w-xl whitespace-pre-wrap rounded-lg border border-line bg-paper-2 p-3 text-[13px] leading-relaxed text-muted">
                          {asText(l.body)}
                        </p>
                      </details>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[l.status] ?? "bg-paper-2 text-faint"}`}>
                        {l.status}
                      </span>
                      {l.error && <span className="ml-2 text-[11px] text-faint">{l.error.slice(0, 60)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
