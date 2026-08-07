import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM encrypt/decrypt for the session-scoped admin mailbox password.
// Never used for anything long-lived — see Session.mailPasswordEnc in schema.prisma.

function getKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("CREDENTIAL_ENC_KEY must be set to a 64-char hex string (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

// Output format: iv:authTag:ciphertext, all hex.
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}
