import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserAuthRateLimiter, consumeStagingOwnerBrowserToken, isStagingBrowserAuthEnvironment } from "./staging-owner-browser-auth";

const directories: string[] = [];
const staging = (directory: string): NodeJS.ProcessEnv => ({
  APP_ID: "tashira-staging",
  PUBLIC_APP_URL: "https://staging.tashiraev.com",
  DATABASE_URL: "mysql://synthetic:synthetic@127.0.0.1:3306/tashira_staging",
  STAGING_BROWSER_AUTH_DIR: directory,
});

function issue(directory: string, token: string, expiresAt: string): void {
  fs.mkdirSync(directory, { recursive: true });
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  fs.writeFileSync(path.join(directory, `${hash}.json`), JSON.stringify({ account: "staging-owner", issuedAt: "2026-08-30T10:00:00Z", expiresAt }), { mode: 0o600 });
}

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("staging owner browser auth", () => {
  it("requires all three staging identity boundaries", () => {
    const directory = "C:\\staging-auth";
    expect(isStagingBrowserAuthEnvironment(staging(directory))).toBe(true);
    expect(isStagingBrowserAuthEnvironment({ ...staging(directory), PUBLIC_APP_URL: "https://tashiraev.com" })).toBe(false);
    expect(isStagingBrowserAuthEnvironment({ ...staging(directory), DATABASE_URL: "mysql://x:x@localhost/tashira" })).toBe(false);
    expect(isStagingBrowserAuthEnvironment({ ...staging(directory), APP_ID: "tashira" })).toBe(false);
  });

  it("consumes a valid token once and rejects replay", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tashira-browser-auth-")); directories.push(directory);
    const token = "A".repeat(43);
    issue(directory, token, "2026-08-30T10:15:00Z");
    expect(consumeStagingOwnerBrowserToken(token, { environment: staging(directory), now: new Date("2026-08-30T10:05:00Z") })).toBe("CONSUMED");
    expect(consumeStagingOwnerBrowserToken(token, { environment: staging(directory), now: new Date("2026-08-30T10:05:01Z") })).toBe("REJECTED");
  });

  it("rejects expired, malformed, and production-bound tokens", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tashira-browser-auth-")); directories.push(directory);
    const token = "B".repeat(43);
    issue(directory, token, "2026-08-30T10:01:00Z");
    expect(consumeStagingOwnerBrowserToken(token, { environment: staging(directory), now: new Date("2026-08-30T10:02:00Z") })).toBe("REJECTED");
    expect(consumeStagingOwnerBrowserToken("not valid", { environment: staging(directory) })).toBe("REJECTED");
    expect(consumeStagingOwnerBrowserToken(token, { environment: { ...staging(directory), PUBLIC_APP_URL: "https://tashiraev.com" } })).toBe("REJECTED");
  });

  it("rate limits repeated attempts without recording token values", () => {
    const limiter = new BrowserAuthRateLimiter(2, 1_000);
    expect(limiter.allow("synthetic-ip", 100)).toBe(true);
    expect(limiter.allow("synthetic-ip", 200)).toBe(true);
    expect(limiter.allow("synthetic-ip", 300)).toBe(false);
    expect(limiter.allow("synthetic-ip", 1_200)).toBe(true);
  });
});
