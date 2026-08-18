// Wording for the automated sends. Kept free of `server-only` and of any db import on
// purpose: the editor's live preview renders with the exact same code in the browser,
// so what an admin sees before saving is what trainees receive.

export const TEMPLATE_KINDS = ["session_scheduled", "session_rescheduled", "session_summary"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export type Template = { subject: string; body: string };

export const LABEL: Record<TemplateKind, string> = {
  session_scheduled: "Session scheduled",
  session_rescheduled: "Session rescheduled",
  session_summary: "Session summary",
};

export const HINT: Record<TemplateKind, string> = {
  session_scheduled: "Sent to every trainee in the batch when a session is first given a date.",
  session_rescheduled: "Sent when a session moves to a new date. Not sent by “Change date (no email)”.",
  session_summary: "Sent when you write a recap — the send that also marks the session completed.",
};

// Placeholders each template may use. Anything else is rejected on save, so a typo
// like {{Name}} can't quietly ship to a whole batch.
export const TOKENS: Record<TemplateKind, string[]> = {
  session_scheduled: ["name", "batch", "session", "date"],
  session_rescheduled: ["name", "batch", "session", "date"],
  session_summary: ["name", "batch", "session", "summary"],
};

// What the portal sent before templates existed. Used whenever a template has never
// been edited, so an untouched or freshly reset database behaves exactly as before.
export const DEFAULTS: Record<TemplateKind, Template> = {
  session_scheduled: {
    subject: "{{batch}} — Session {{session}} scheduled for {{date}}",
    body: [
      "Hi {{name}},",
      "",
      "Session {{session}} for {{batch}} has been scheduled.",
      "",
      "New date: {{date}}",
      "",
      "— Founders Mentality Program",
    ].join("\n"),
  },
  session_rescheduled: {
    subject: "{{batch}} — Session {{session}} rescheduled to {{date}}",
    body: [
      "Hi {{name}},",
      "",
      "Sorry for the change — Session {{session}} for {{batch}} has a new date.",
      "",
      "New date: {{date}}",
      "",
      "— Founders Mentality Program",
    ].join("\n"),
  },
  session_summary: {
    subject: "{{batch}} — Session {{session}} summary",
    body: [
      "Hi {{name}},",
      "",
      "Here's a recap of Session {{session}} for {{batch}}:",
      "",
      "{{summary}}",
      "",
      "— Founders Mentality Program",
    ].join("\n"),
  },
};

// Stand-in values for the editor preview, so admins see a realistic email rather than
// raw placeholders.
export const SAMPLE: Record<string, string> = {
  name: "Ritu Sharma",
  batch: "BATCH A",
  session: "3",
  date: "12 September 2026",
  summary: "We worked through the owner's mindset exercise and agreed on one action each\nbefore the next session.",
};

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);

// Substitutes {{token}} from `vars`. An unrecognised token is left standing rather than
// blanked, so a mistake is visible in the preview instead of emptying a line silently.
function fill(template: string, vars: Record<string, string>, forHtml: boolean) {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, token: string) =>
    token in vars ? (forHtml ? escapeHtml(vars[token]) : vars[token]) : whole,
  );
}

// Blank lines are dropped from the HTML because <p> already supplies the spacing —
// this keeps the markup identical to what the portal sent before templates existed.
export function renderTemplate(tpl: Template, vars: Record<string, string>) {
  return {
    subject: fill(tpl.subject, vars, false),
    text: fill(tpl.body, vars, false),
    html: fill(tpl.body, vars, true)
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => `<p>${line}</p>`)
      .join(""),
  };
}

// Placeholders used in a template that aren't available for its kind.
export function unknownTokens(kind: TemplateKind, ...parts: string[]) {
  const allowed = TOKENS[kind];
  return [...new Set(parts.flatMap((p) => [...p.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])))].filter(
    (t) => !allowed.includes(t),
  );
}
