import { db } from "@/lib/db";
import { EmailTemplateForm, type EditableTemplate } from "@/components/EmailTemplateForm";
import { DEFAULTS, HINT, LABEL, TEMPLATE_KINDS, TOKENS } from "@/lib/emailTemplates";

export default async function EmailTemplatesPage() {
  const rows = await db.emailTemplate.findMany();

  // A missing row means this template has never been edited, so it shows (and sends)
  // the built-in default.
  const templates: EditableTemplate[] = TEMPLATE_KINDS.map((kind) => {
    const row = rows.find((r) => r.key === kind);
    return {
      kind,
      label: LABEL[kind],
      hint: HINT[kind],
      tokens: TOKENS[kind],
      builtIn: DEFAULTS[kind],
      subject: row?.subject ?? DEFAULTS[kind].subject,
      body: row?.body ?? DEFAULTS[kind].body,
      editedAt: row ? row.updatedAt.toISOString().slice(0, 10) : null,
    };
  });

  return <EmailTemplateForm templates={templates} />;
}
