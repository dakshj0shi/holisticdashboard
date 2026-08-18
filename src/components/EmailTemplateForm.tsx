"use client";

// Editor for the automated sends. The preview runs the same renderTemplate() the mailer
// uses, on sample values, so what an admin sees here is what a trainee receives.

import { useState, useTransition } from "react";
import { saveEmailTemplate } from "@/app/actions";
import { SAMPLE, renderTemplate, type Template } from "@/lib/emailTemplates";
import { Panel } from "./Charts";

export type EditableTemplate = Template & {
  kind: string;
  label: string;
  hint: string;
  tokens: string[];
  builtIn: Template;
  editedAt: string | null;
};

function TemplateEditor({ tpl }: { tpl: EditableTemplate }) {
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = renderTemplate({ subject, body }, SAMPLE);
  const isDefault = subject === tpl.builtIn.subject && body === tpl.builtIn.body;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveEmailTemplate(tpl.kind, subject, body);
      if (result.ok) setSaved(true);
      else setError(result.error ?? "Could not save.");
    });
  }

  return (
    <Panel title={tpl.label} hint={tpl.editedAt ? `Edited ${tpl.editedAt}` : "Using the built-in wording"}>
      <p className="mb-4 text-sm text-muted">{tpl.hint}</p>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] uppercase tracking-wide text-faint">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-sm text-ink focus:border-indigo focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] uppercase tracking-wide text-faint">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 font-mono text-[13px] leading-relaxed text-ink focus:border-indigo focus:outline-none"
            />
          </label>

          <p className="text-[12px] text-muted">
            Placeholders:{" "}
            {tpl.tokens.map((t) => (
              <code key={t} className="mr-1 rounded bg-paper-2 px-1.5 py-0.5 text-[12px] text-ink">{`{{${t}}}`}</code>
            ))}
            <span className="text-faint"> — blank lines separate paragraphs, and tags like &lt;strong&gt; work.</span>
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save wording"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSubject(tpl.builtIn.subject);
                setBody(tpl.builtIn.body);
                setSaved(false);
                setError(null);
              }}
              disabled={pending || isDefault}
              className="rounded-lg border border-line-strong px-4 py-2 text-sm text-ink transition-colors hover:bg-paper-2 disabled:opacity-40"
            >
              Restore default
            </button>
            {error && <span className="text-sm text-rose">{error}</span>}
            {!error && saved && <span className="text-sm text-teal">Saved — future sends use this.</span>}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-paper-2 p-4">
          <p className="text-[12px] uppercase tracking-wide text-faint">Preview</p>
          <p className="mt-2 border-b border-line pb-2 text-sm font-medium text-ink">{preview.subject}</p>
          <div
            className="mt-3 space-y-2 text-sm leading-relaxed text-ink [&_p]:m-0"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
          <p className="mt-4 text-[12px] text-faint">
            Sample values — a real send uses the actual trainee name and session date.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function EmailTemplateForm({ templates }: { templates: EditableTemplate[] }) {
  return (
    <div className="space-y-5">
      {templates.map((tpl) => (
        <TemplateEditor key={tpl.kind} tpl={tpl} />
      ))}
    </div>
  );
}
