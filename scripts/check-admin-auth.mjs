// Self-check for how a failed mail connection is classified. No framework — run with:
//   npm run check:auth
//
// This is the security-critical branch of admin login. "refused" rejects the sign-in;
// "unreachable" is what allows the ADMIN_PASSWORD_LOGIN fallback to be consulted. Getting
// it backwards either locks out every admin during an outage, or accepts a password the
// mail server already rejected.
import assert from "node:assert/strict";
import { classifyMailError, mailErrorCode } from "../src/lib/mailErrors.ts";

// Only a server that answered and said no is a genuinely wrong password.
assert.equal(classifyMailError({ code: "EAUTH" }), "refused");

// Everything that means "we never got to ask" must stay unreachable — a firewall that
// DROPs packets, a dead DNS record, a refused connection, a TLS failure.
for (const code of ["ETIMEDOUT", "ECONNECTION", "ESOCKET", "EDNS", "ECONNREFUSED", " EAUTH", "eauth"]) {
  assert.equal(classifyMailError({ code }), "unreachable", `${code} should be unreachable`);
}

// Anything unrecognisable defaults to unreachable, which is the safe side: that path
// still demands a valid stored password, so a wrong guess costs nothing.
for (const e of [null, undefined, "EAUTH", 42, {}, { code: undefined }, { code: 500 }, new Error("boom")]) {
  assert.equal(classifyMailError(e), "unreachable", `${JSON.stringify(e)} should be unreachable`);
}

// A real nodemailer error carries its code as an own property on an Error.
const authError = Object.assign(new Error("Invalid login"), { code: "EAUTH" });
assert.equal(classifyMailError(authError), "refused");

// The logged code is what makes an outage distinguishable from a bad password after the
// fact, so it must never come out as "[object Object]" or undefined.
assert.equal(mailErrorCode(authError), "EAUTH");
assert.equal(mailErrorCode(new Error("no code")), "unknown");
assert.equal(mailErrorCode(null), "unknown");
assert.equal(mailErrorCode({ code: 42 }), "unknown");

console.log("admin auth: all checks passed");
