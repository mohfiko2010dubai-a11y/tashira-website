import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as cookie from "cookie";

const NAME = "tashira_creation_device";
const MAX_AGE = 30 * 24 * 60 * 60;
function signature(payload: string) {
  const secret = process.env.CUSTOMER_SESSION_SECRET ?? "";
  if (secret.length < 32) throw new Error("Customer session secret is unavailable");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
export function creationDeviceOwner(headers: Headers): string | null {
  const token = cookie.parse(headers.get("cookie") ?? "")[NAME];
  if (!token) return null;
  const [id, expires, supplied, extra] = token.split(".");
  if (extra || !id || !expires || !supplied || !/^[A-Za-z0-9_-]{43}$/.test(id)
    || !Number.isSafeInteger(Number(expires)) || Number(expires) <= Date.now() / 1000) return null;
  const expected = Buffer.from(signature(id + "." + expires)); const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return createHash("sha256").update(id).digest("hex");
}
export function issueCreationDevice(headers: Headers) {
  const id = randomBytes(32).toString("base64url");
  const payload = id + "." + (Math.floor(Date.now() / 1000) + MAX_AGE);
  const host = headers.get("host") ?? "";
  return { owner: createHash("sha256").update(id).digest("hex"), cookie: cookie.serialize(NAME, payload + "." + signature(payload), {
    httpOnly: true, secure: headers.get("x-forwarded-proto") === "https" || (!host.startsWith("localhost:") && !host.startsWith("127.0.0.1:")),
    sameSite: "lax", path: "/", maxAge: MAX_AGE,
  }) };
}
