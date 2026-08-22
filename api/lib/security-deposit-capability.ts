import crypto from "node:crypto";

export const securityDepositTokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export function securityDepositTokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newSecurityDepositCapability() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: securityDepositTokenHash(token) };
}

export function securityDepositRetryIdempotencyKey(requestId: string, tokenHash: string) {
  return `security-deposit/${requestId}/${tokenHash}`;
}
