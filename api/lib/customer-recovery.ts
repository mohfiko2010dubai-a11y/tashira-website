import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";

export type RecoveryChannel = "MAGIC_LINK" | "EMAIL_OTP" | "SMS_OTP";

export interface RecoveryDeliveryProvider {
  readonly name: string;
  deliver(input: { channel: RecoveryChannel; destination: string; secret: string; expiresAt: Date }): Promise<{ reference: string }>;
}

export type RecoveryChallenge = {
  id: string;
  tokenHash: string;
  destinationHash: string;
  secret: string;
};

export function hashRecoveryValue(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createRecoveryChallenge(channel: RecoveryChannel, destination: string): RecoveryChallenge {
  const secret = channel === "MAGIC_LINK"
    ? randomBytes(32).toString("base64url")
    : String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, "0");
  return { id: randomUUID(), tokenHash: hashRecoveryValue(secret), destinationHash: hashRecoveryValue(destination.trim().toLowerCase()), secret };
}

export function verifyRecoverySecret(secret: string, expectedHash: string) {
  const actual = Buffer.from(hashRecoveryValue(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class DisabledRecoveryProvider implements RecoveryDeliveryProvider {
  readonly name = "disabled";
  async deliver(): Promise<{ reference: string }> {
    throw new Error("Recovery delivery is not enabled in this environment");
  }
}
