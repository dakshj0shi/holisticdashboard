"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, getCurrentAdminMailCredential } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { composeEmailDraft } from "@/lib/aiCompose";
import { sendMailAsAdmin } from "@/lib/mailer";
import { LABEL, TEMPLATE_KINDS, TOKENS, unknownTokens, type TemplateKind } from "@/lib/emailTemplates";

async function requireAdminMailContext() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  const cred = await getCurrentAdminMailCredential();
  return { id: user.id, email: cred?.email ?? user.email, password: cred?.password ?? "" };
}

export async function composeAiDraft(
  recipientIds: string[],
  brief: string,
): Promise<{ ok: boolean; error?: string; subject?: string; body?: string }> {
  const admin = await requireAdminMailContext();
  if (!admin) return { ok: false, error: "Not authorized." };
  if (recipientIds.length === 0) return { ok: false, error: "Select at least one recipient." };
  if (!brief.trim()) return { ok: false, error: "Describe what the email should say." };

  const recipients = await db.user.findMany({
    where: { id: { in: recipientIds } },
    include: { batch: { select: { name: true } } },
  });

  const result = await composeEmailDraft({
    brief,
    recipients: recipients.map((r) => ({ name: r.name, department: r.department, batchName: r.batch?.name ?? null })),
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, subject: result.subject, body: result.body };
}

export async function sendCustomEmail(
  recipientIds: string[],
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string; sent?: number; skipped?: number }> {
  const admin = await requireAdminMailContext();
  if (!admin) return { ok: false, error: "Not authorized." };
  if (!subject.trim() || !body.trim()) return { ok: false, error: "Subject and body are required." };

  const recipients = await db.user.findMany({ where: { id: { in: recipientIds } } });
  const html = body
    .split("\n")
    .map((line) => `<p>${line || "&nbsp;"}</p>`)
    .join("");

  let sent = 0;
  let skipped = 0;
  for (const r of recipients) {
    const result = await sendMailAsAdmin({
      adminEmail: admin.email,
      adminPassword: admin.password,
      sentByUserId: admin.id,
      toUserId: r.id,
      kind: "custom_ai",
      mail: { to: r.email ?? "", subject, html, text: body },
    });
    if (result.status === "skipped_no_email") skipped++;
    else sent++;
  }

  await logEvent(admin.id, "custom_email_send", `${subject} → ${recipients.length} recipient(s)`);
  return { ok: true, sent, skipped };
}

// Wording for one of the automated sends. Editing a template needs no mailbox
// credential — nothing is sent here — so this checks the role only.
export async function saveEmailTemplate(
  kind: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };
  if (!(TEMPLATE_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Unknown template." };
  const key = kind as TemplateKind;

  const cleanSubject = subject.trim();
  const cleanBody = body.trim();
  if (!cleanSubject || !cleanBody) return { ok: false, error: "Subject and body are both required." };

  // A mistyped placeholder would otherwise ship verbatim to a whole batch.
  const unknown = unknownTokens(key, cleanSubject, cleanBody);
  if (unknown.length) {
    const list = (t: string[]) => t.map((x) => `{{${x}}}`).join(", ");
    return {
      ok: false,
      error: `Unknown placeholder${unknown.length > 1 ? "s" : ""} ${list(unknown)}. This email can use ${list(TOKENS[key])}.`,
    };
  }

  await db.emailTemplate.upsert({
    where: { key },
    create: { key, subject: cleanSubject, body: cleanBody },
    update: { subject: cleanSubject, body: cleanBody },
  });

  await logEvent(user.id, "email_template_update", LABEL[key]);
  revalidatePath("/admin/emails/templates");
  return { ok: true };
}
