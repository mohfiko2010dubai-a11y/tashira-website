import { afterEach, describe, expect, it } from "vitest";

import { consumeRateLimit, resetRateLimitsForTests } from "./rate-limit";

afterEach(resetRateLimitsForTests);

describe("rate limiting", () => {
  it("allows requests up to the configured limit per client and scope", () => {
    const headers = new Headers({ "x-forwarded-for": "192.0.2.10, 10.0.0.1" });
    expect(consumeRateLimit(headers, "login", 2, 60_000, 1_000).allowed).toBe(true);
    expect(consumeRateLimit(headers, "login", 2, 60_000, 1_001).allowed).toBe(true);
    expect(consumeRateLimit(headers, "login", 2, 60_000, 1_002)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it("isolates scopes and resets after the window", () => {
    const headers = new Headers({ "x-real-ip": "192.0.2.20" });
    expect(consumeRateLimit(headers, "login", 1, 1_000, 1_000).allowed).toBe(true);
    expect(consumeRateLimit(headers, "upload", 1, 1_000, 1_001).allowed).toBe(true);
    expect(consumeRateLimit(headers, "login", 1, 1_000, 2_001).allowed).toBe(true);
  });
});
