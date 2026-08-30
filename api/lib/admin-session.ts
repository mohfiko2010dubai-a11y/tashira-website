import crypto from "crypto";
import * as cookie from "cookie";

const ADMIN_COOKIE_NAME = "tashira_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters");
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function isSecureRequest(headers: Headers): boolean {
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = headers.get("host") || "";
  return forwardedProto === "https" || (!host.startsWith("localhost:") && !host.startsWith("127.0.0.1:"));
}

export function createAdminSessionCookie(headers: Headers, sessionEpoch = 1): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
  const payload = `${expiresAt}:${sessionEpoch}`;
  const token = `${payload}.${sign(payload)}`;

  return cookie.serialize(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureRequest(headers),
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAdminSessionCookie(headers: Headers): string {
  return cookie.serialize(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isSecureRequest(headers),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function verifyAdminSession(headers: Headers): boolean {
  const token = cookie.parse(headers.get("cookie") || "")[ADMIN_COOKIE_NAME];
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !/^\d+(:\d+)?$/.test(payload)) return false;
  if (Number(payload.split(":")[0]) <= Math.floor(Date.now() / 1000)) return false;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) throw new Error("ADMIN_PASSWORD is not configured");

  const actualBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

// ---------------------------------------------------------------------------
// DB-backed admin password override + session epoch invalidation
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export function hashAdminPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

export function verifyAdminPasswordHash(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(keyB64, "base64url");
  const actual = crypto.scryptSync(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

type AdminSecurityRow = { id: number; passwordHash: string | null; sessionEpoch: number } | null;

async function loadAdminSecurityRow(): Promise<AdminSecurityRow> {
  try {
    const { getDb } = await import("../queries/connection");
    const { adminSecuritySettings } = await import("@db/schema");
    const rows = await getDb().select({
      id: adminSecuritySettings.id,
      passwordHash: adminSecuritySettings.passwordHash,
      sessionEpoch: adminSecuritySettings.sessionEpoch,
    }).from(adminSecuritySettings).limit(1);
    return rows[0] ?? null;
  } catch {
    // Table may not exist yet (pre-migration) or DB unavailable: fail open to env-only mode.
    return null;
  }
}

/**
 * Password source of truth: DB override hash when set, otherwise the
 * ADMIN_PASSWORD environment variable.
 */
export async function verifyAdminPasswordAsync(password: string): Promise<boolean> {
  const row = await loadAdminSecurityRow();
  if (row?.passwordHash) return verifyAdminPasswordHash(password, row.passwordHash);
  return verifyAdminPassword(password);
}

export async function getAdminSessionEpoch(): Promise<number> {
  return (await loadAdminSecurityRow())?.sessionEpoch ?? 1;
}

/**
 * Epoch-aware session check: cookies issued before the latest password change
 * (older epoch) are rejected, so changing the password signs out every other
 * admin session. Falls back to the legacy check when no security row exists.
 */
export async function verifyAdminSessionAsync(headers: Headers): Promise<boolean> {
  if (!verifyAdminSession(headers)) return false;
  const row = await loadAdminSecurityRow();
  if (!row) return true;
  const token = cookie.parse(headers.get("cookie") || "")[ADMIN_COOKIE_NAME] || "";
  const payload = token.split(".")[0] || "";
  const epoch = Number(payload.split(":")[1] ?? "1");
  return epoch === row.sessionEpoch;
}

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

export function validateNewAdminPassword(password: string): string | null {
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return "Password must contain upper- and lower-case letters";
  if (!/\d/.test(password)) return "Password must contain at least one digit";
  return null;
}
