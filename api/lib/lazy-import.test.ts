import { describe, expect, it } from "vitest";
import { isStaleChunkError } from "../../src/lib/stale-chunk-error";

describe("stale lazy chunk detection", () => {
  it.each([
    "Failed to fetch dynamically imported module: /assets/AdminLogin-old.js",
    "Importing a module script failed.",
    "Loading chunk StaffLogin-old failed",
  ])("recognizes a deploy-stale chunk error: %s", (message) => {
    expect(isStaleChunkError(new TypeError(message))).toBe(true);
  });

  it("does not hide unrelated application errors", () => {
    expect(isStaleChunkError(new Error("Invalid credentials"))).toBe(false);
    expect(isStaleChunkError("Failed to fetch dynamically imported module")).toBe(false);
  });
});
