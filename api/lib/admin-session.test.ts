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

describe("admin password hashing and policy", () => {
  it("hashes and verifies with scrypt, rejecting wrong passwords", async () => {
    const { hashAdminPassword, verifyAdminPasswordHash } = await import("./admin-session");
    const hash = hashAdminPassword("NewStrongPass123");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(verifyAdminPasswordHash("NewStrongPass123", hash)).toBe(true);
    expect(verifyAdminPasswordHash("WrongPass123", hash)).toBe(false);
    expect(verifyAdminPasswordHash("NewStrongPass123", "garbage")).toBe(false);
  });

  it("enforces the new-password policy", async () => {
    const { validateNewAdminPassword } = await import("./admin-session");
    expect(validateNewAdminPassword("short")).toMatch(/12/);
    expect(validateNewAdminPassword("alllowercase123")).toMatch(/upper/);
    expect(validateNewAdminPassword("NoDigitsHere")).toMatch(/digit/);
    expect(validateNewAdminPassword("ValidPass123")).toBeNull();
  });

  it("embeds the session epoch in the cookie and still verifies", async () => {
    const { createAdminSessionCookie: create, verifyAdminSession: verify } = await import("./admin-session");
    const setCookie = create(secureHeaders, 7);
    const cookieHeader = setCookie.split(";")[0];
    expect(verify(new Headers({ cookie: cookieHeader }))).toBe(true);
    // payload must carry the epoch segment
    const payload = decodeURIComponent(cookieHeader.split("=")[1]).split(".")[0];
    expect(payload.split(":")[1]).toBe("7");
  });
});
