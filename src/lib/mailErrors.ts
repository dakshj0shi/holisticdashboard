// How to read a failed mail-server connection. Deliberately free of `server-only` and of
// any db/nodemailer import so it can be unit-checked outside Next — see
// scripts/check-admin-auth.mjs. Same reasoning as src/lib/emailTemplates.ts.

export type MailVerdict = "ok" | "refused" | "unreachable";

// Only a server that actually answered and rejected the credentials counts as "refused".
// Everything else — timeout, DNS failure, refused connection, TLS trouble, anything
// unrecognised — means we never got to ask, so the caller may fall back to the stored
// admin password (see ADMIN_AUTH in src/lib/auth.ts).
//
// "unreachable" is the safe default on purpose: that path still demands a valid stored
// password, so guessing it wrong costs nothing. Guessing the other way locks out every
// admin, which is exactly the outage this exists for.
export function classifyMailError(e: unknown): "refused" | "unreachable" {
  const code = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return code === "EAUTH" ? "refused" : "unreachable";
}

// The code to log for diagnosis, so an outage and a wrong password are distinguishable
// after the fact instead of both reading as "wrong email or password".
export function mailErrorCode(e: unknown): string {
  const code = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : "unknown";
}
