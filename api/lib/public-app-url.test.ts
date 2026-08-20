import { afterEach, describe, expect, it } from "vitest";
import { publicAppOrigin, requirePublicAppUrl } from "./public-app-url";

afterEach(() => delete process.env.PUBLIC_APP_URL);

describe("configured public application origin", () => {
  it.each([
    "https://tashiraev.com",
    "https://staging.tashiraev.com",
  ])("accepts secure links for the configured origin %s", (origin) => {
    process.env.PUBLIC_APP_URL = origin;
    expect(publicAppOrigin()).toBe(origin);
    expect(requirePublicAppUrl(`${origin}/recover?token=safe`).origin).toBe(origin);
  });

  it("rejects an external origin", () => {
    process.env.PUBLIC_APP_URL = "https://tashiraev.com";
    expect(() => requirePublicAppUrl("https://attacker.example/recover?token=safe"))
      .toThrow("origin is not approved");
  });

  it.each([
    "not-a-url",
    "http://tashiraev.com",
    "https://localhost:3000",
    "https://tashiraev.com/unexpected-base-path",
    "https://user:password@tashiraev.com",
  ])("rejects malformed or unsafe PUBLIC_APP_URL %s", (configuredUrl) => {
    process.env.PUBLIC_APP_URL = configuredUrl;
    expect(() => publicAppOrigin()).toThrow();
  });
});
