import crypto from "node:crypto";
import * as cookie from "cookie";

const CUSTOMER_COOKIE_NAME = "tashira_customer_session";
const CUSTOMER_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_APPLICATION_REFERENCES = 10;

type CustomerSessionPayload = {
  references: string[];
  expiresAt: number;
};

function getSessionSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET || "";
  if (secret.length < 32) {
    throw new Error("CUSTOMER_SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function isSecureRequest(headers: Headers): boolean {
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = headers.get("host") || "";
  return forwardedProto === "https" || (!host.startsWith("localhost:") && !host.startsWith("127.0.0.1:"));
}

function parseSession(headers: Headers): CustomerSessionPayload | null {
  const token = cookie.parse(headers.get("cookie") || "")[CUSTOMER_COOKIE_NAME];
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const encodedPayload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: string;
  try {
    expected = sign(encodedPayload);
  } catch {
    return null;
  }

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as CustomerSessionPayload;
    if (!Array.isArray(payload.references) || !Number.isInteger(payload.expiresAt)) return null;
    if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    const references = payload.references.filter(
      (reference): reference is string => typeof reference === "string" && reference.length > 0 && reference.length <= 100,
    );
    return { references, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
}

export function getCustomerApplicationReferences(headers: Headers): ReadonlySet<string> {
  return new Set(parseSession(headers)?.references ?? []);
}

export function hasCustomerApplicationAccess(headers: Headers, referenceNumber: string): boolean {
  return getCustomerApplicationReferences(headers).has(referenceNumber);
}

export function createCustomerApplicationCookie(headers: Headers, referenceNumber: string): string {
  const currentReferences = [...getCustomerApplicationReferences(headers)];
  const references = [...currentReferences.filter((reference) => reference !== referenceNumber), referenceNumber]
    .slice(-MAX_APPLICATION_REFERENCES);
  const payload: CustomerSessionPayload = {
    references,
    expiresAt: Math.floor(Date.now() / 1000) + CUSTOMER_SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${encodedPayload}.${sign(encodedPayload)}`;

  return cookie.serialize(CUSTOMER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureRequest(headers),
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
  });
}
