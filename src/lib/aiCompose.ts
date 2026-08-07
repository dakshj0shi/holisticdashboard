import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export type ComposeInput = {
  brief: string;
  recipients: { name: string; department: string | null; batchName: string | null }[];
};

export type ComposeResult = { ok: true; subject: string; body: string } | { ok: false; error: string };

// Drafts a subject + body for the admin to review/edit before sending — never sends directly.
export async function composeEmailDraft(input: ComposeInput): Promise<ComposeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "AI drafting isn't configured yet — set ANTHROPIC_API_KEY to enable it." };
  }

  const recipientSummary = input.recipients
    .slice(0, 5)
    .map((r) => `${r.name}${r.department ? ` (${r.department})` : ""}${r.batchName ? `, ${r.batchName}` : ""}`)
    .join("; ");
  const more = input.recipients.length > 5 ? ` and ${input.recipients.length - 5} more` : "";

  try {
    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system:
        "You draft short, warm, professional emails for a corporate training program facilitator to send to trainees. " +
        "Reply with exactly two lines: the first line is 'Subject: <subject>', the second line onward is the email body " +
        "(plain text, no markdown, no signature block — the sender will add their own).",
      messages: [
        {
          role: "user",
          content:
            `Recipients: ${recipientSummary}${more}\n\n` +
            `What the admin wants to say:\n${input.brief}`,
        },
      ],
    });

    const text = message.content.find((b) => b.type === "text")?.text ?? "";
    const subjectMatch = text.match(/^Subject:\s*(.+)$/m);
    const subject = subjectMatch?.[1]?.trim() || "Message from the Founders Mentality Program";
    const body = subjectMatch ? text.slice(text.indexOf(subjectMatch[0]) + subjectMatch[0].length).trim() : text.trim();

    return { ok: true, subject, body };
  } catch (e) {
    return { ok: false, error: `Draft generation failed: ${String(e)}` };
  }
}
