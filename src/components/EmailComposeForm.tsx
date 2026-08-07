"use client";

import { useMemo, useState, useTransition } from "react";
import { composeAiDraft, sendCustomEmail } from "@/app/actions";
import { Sparkle } from "./Icons";

type Trainee = { id: string; name: string; email: string | null; batchId: string | null; batchName: string | null };
type Batch = { id: string; name: string };

export function EmailComposeForm({ trainees, batches }: { trainees: Trainee[]; batches: Batch[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchFilter, setBatchFilter] = useState("");
  const [brief, setBrief] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () => (batchFilter ? trainees.filter((t) => t.batchId === batchFilter) : trainees),
    [trainees, batchFilter],
  );
  const selectedWithEmail = trainees.filter((t) => selected.has(t.id) && t.email).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => new Set([...prev, ...visible.map((t) => t.id)]));
  }

  function generateDraft() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await composeAiDraft([...selected], brief);
      if (!res.ok) {
        setError(res.error ?? "Could not generate a draft.");
        return;
      }
      setSubject(res.subject ?? "");
      setBody(res.body ?? "");
    });
  }

  function send() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await sendCustomEmail([...selected], subject, body);
      if (!res.ok) {
        setError(res.error ?? "Send failed.");
        return;
      }
      setResult(`Sent to ${res.sent} recipient(s)${res.skipped ? `, skipped ${res.skipped} with no email` : ""}.`);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">1. Recipients ({selected.size} selected, {selectedWithEmail} with email)</p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink focus:border-indigo focus:outline-none"
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={selectAllVisible}
            className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-paper-2"
          >
            Select all shown
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-paper-2"
          >
            Clear
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-line">
          {visible.map((t) => (
            <label key={t.id} className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-sm last:border-0 hover:bg-paper-2">
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 accent-indigo" />
              <span className="text-ink">{t.name}</span>
              <span className="text-faint">{t.batchName ?? "—"}</span>
              {!t.email && <span className="ml-auto rounded-full bg-rose/10 px-2 py-0.5 text-xs text-rose">no email</span>}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">2. What should this email say?</p>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="e.g. remind them their next session is coming up and to bring their laptop"
          className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
        />
        <button
          type="button"
          onClick={generateDraft}
          disabled={pending || selected.size === 0}
          className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
        >
          <Sparkle size={14} /> {pending ? "Working…" : "Generate draft"}
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">3. Review &amp; edit</p>
        <div className="space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Body"
            className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-indigo focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="text-sm text-rose">{error}</p>}
      {result && <p className="text-sm text-teal">{result}</p>}

      <button
        type="button"
        onClick={send}
        disabled={pending || selected.size === 0 || !subject.trim() || !body.trim()}
        className="rounded-lg bg-indigo px-5 py-2.5 font-medium text-paper transition-colors hover:bg-indigo-deep disabled:opacity-60"
      >
        {pending ? "Sending…" : `Send to ${selectedWithEmail} recipient(s)`}
      </button>
    </div>
  );
}
