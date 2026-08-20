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

export function createAdminSessionCookie(headers: Headers): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
  const payload = String(expiresAt);
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
  if (!payload || !signature || !/^\d+$/.test(payload)) return false;
  if (Number(payload) <= Math.floor(Date.now() / 1000)) return false;

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
