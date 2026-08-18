// Self-check for the email template renderer. No framework — run it with:
//   npm run check:templates
//
// The first two assertions are the important ones: they pin the built-in defaults to the
// exact text and markup the portal sent before templates existed, so editing this file's
// defaults can't silently change what trainees receive.
import assert from "node:assert/strict";
import { DEFAULTS, SAMPLE, renderTemplate, unknownTokens } from "../src/lib/emailTemplates.ts";

const scheduled = renderTemplate(DEFAULTS.session_scheduled, SAMPLE);

assert.equal(
  scheduled.text,
  "Hi Ritu Sharma,\n\nSession 3 for BATCH A has been scheduled.\n\nNew date: 12 September 2026\n\n— Founders Mentality Program",
);
assert.equal(
  scheduled.html,
  "<p>Hi Ritu Sharma,</p><p>Session 3 for BATCH A has been scheduled.</p><p>New date: 12 September 2026</p><p>— Founders Mentality Program</p>",
);
assert.equal(scheduled.subject, "BATCH A — Session 3 scheduled for 12 September 2026");

// A trainee name or a recap containing markup must not become live HTML in the email,
// while the plain-text part stays literal.
const nasty = renderTemplate(DEFAULTS.session_summary, { ...SAMPLE, name: 'Ann <b>"A"</b>', summary: "1 < 2 & 3" });
assert.ok(nasty.html.includes("Ann &lt;b&gt;&quot;A&quot;&lt;/b&gt;"));
assert.ok(nasty.html.includes("1 &lt; 2 &amp; 3"));
assert.ok(nasty.text.includes('Ann <b>"A"</b>'));

// A multi-line recap becomes one paragraph per line.
assert.equal(renderTemplate({ subject: "s", body: "a\n\nb\nc" }, {}).html, "<p>a</p><p>b</p><p>c</p>");

// An unrecognised placeholder is left standing rather than blanked, and is reported.
assert.equal(renderTemplate({ subject: "{{nope}}", body: "x" }, SAMPLE).subject, "{{nope}}");
assert.deepEqual(unknownTokens("session_scheduled", "{{Name}} {{name}}", "{{summary}}"), ["Name", "summary"]);
assert.deepEqual(unknownTokens("session_summary", DEFAULTS.session_summary.subject, DEFAULTS.session_summary.body), []);

console.log("email templates: all checks passed");
