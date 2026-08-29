import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const STAGING_ORIGIN = "https://staging.tashiraev.com";
const STAGING_APP_ID = "tashira-staging";
const STAGING_DATABASE = "tashira_staging";

type TokenRecord = {
  account: "staging-owner";
  expiresAt: string;
  issuedAt: string;
};

export function isStagingBrowserAuthEnvironment(environment: NodeJS.ProcessEnv = process.env): boolean {
  if (environment.APP_ID !== STAGING_APP_ID || environment.PUBLIC_APP_URL !== STAGING_ORIGIN) return false;
  try {
    return new URL(environment.DATABASE_URL || "").pathname.replace(/^\//, "") === STAGING_DATABASE;
  } catch {
    return false;
  }
}

function tokenDirectory(environment: NodeJS.ProcessEnv): string {
  const directory = environment.STAGING_BROWSER_AUTH_DIR || "";
  if (!path.isAbsolute(directory)) throw new Error("STAGING_BROWSER_AUTH_DIR must be absolute");
  return directory;
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function consumeStagingOwnerBrowserToken(
  token: string,
  options: { environment?: NodeJS.ProcessEnv; now?: Date } = {},
): "CONSUMED" | "REJECTED" {
  const environment = options.environment ?? process.env;
  if (!isStagingBrowserAuthEnvironment(environment) || !TOKEN_PATTERN.test(token)) return "REJECTED";

  const directory = tokenDirectory(environment);
  const hash = tokenHash(token);
  const source = path.join(directory, `${hash}.json`);
  const claimed = path.join(directory, `${hash}.${process.pid}.${crypto.randomUUID()}.consuming`);

  try {
    fs.renameSync(source, claimed);
  } catch {
    return "REJECTED";
  }

  try {
    const stat = fs.lstatSync(claimed);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024) return "REJECTED";
    const record = JSON.parse(fs.readFileSync(claimed, "utf8")) as Partial<TokenRecord>;
    const expiresAt = Date.parse(record.expiresAt || "");
    if (record.account !== "staging-owner" || !Number.isFinite(expiresAt)) return "REJECTED";
    if (expiresAt <= (options.now ?? new Date()).getTime()) return "REJECTED";
    return "CONSUMED";
  } catch {
    return "REJECTED";
  } finally {
    try { fs.unlinkSync(claimed); } catch { /* already consumed or unavailable */ }
  }
}

export class BrowserAuthRateLimiter {
  readonly #attempts = new Map<string, number[]>();
  constructor(private readonly limit = 10, private readonly windowMs = 60_000) {}

  allow(identity: string, now = Date.now()): boolean {
    const recent = (this.#attempts.get(identity) ?? []).filter((value) => value > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.#attempts.set(identity, recent);
      return false;
    }
    recent.push(now);
    this.#attempts.set(identity, recent);
    return true;
  }
}
