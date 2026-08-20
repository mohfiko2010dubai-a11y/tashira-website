import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  verifyAdminPassword,
  verifyAdminSession,
} from "./admin-session";

const secureHeaders = new Headers({ host: "app.example.test", "x-forwarded-proto": "https" });

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "review-only-password";
  process.env.ADMIN_SESSION_SECRET = "a-secure-review-session-secret-of-32-chars";
});

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
  vi.useRealTimers();
});

describe("admin server session", () => {
  it("validates the configured password without a frontend fallback", () => {
    expect(verifyAdminPassword("review-only-password")).toBe(true);
    expect(verifyAdminPassword("wrong-password")).toBe(false);
  });

  it("creates a secure HttpOnly cookie that verifies server-side", () => {
    const setCookie = createAdminSessionCookie(secureHeaders);
    const cookieHeader = setCookie.split(";")[0];

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(verifyAdminSession(new Headers({ cookie: cookieHeader }))).toBe(true);
  });

  it("rejects tampered and expired sessions", () => {
    const setCookie = createAdminSessionCookie(secureHeaders);
    const cookieHeader = setCookie.split(";")[0];
    expect(verifyAdminSession(new Headers({ cookie: `${cookieHeader}x` }))).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 9 * 60 * 60 * 1000);
    expect(verifyAdminSession(new Headers({ cookie: cookieHeader }))).toBe(false);
  });

  it("clears the admin cookie", () => {
    expect(clearAdminSessionCookie(secureHeaders)).toContain("Max-Age=0");
  });
});
