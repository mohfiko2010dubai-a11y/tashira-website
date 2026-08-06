import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);
const LEGACY_SALT = "tashira-staff-salt-2025";

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (storedHash.startsWith("scrypt$")) {
    const [, salt, encodedHash] = storedHash.split("$");
    if (!salt || !encodedHash) return { valid: false, needsUpgrade: false };
    const derived = await scrypt(password, salt, 64) as Buffer;
    return {
      valid: safeEqual(derived, Buffer.from(encodedHash, "base64url")),
      needsUpgrade: false,
    };
  }

  const legacy = crypto.createHash("sha256").update(password + LEGACY_SALT).digest("hex");
  const valid = safeEqual(Buffer.from(legacy), Buffer.from(storedHash));
  return { valid, needsUpgrade: valid };
}
