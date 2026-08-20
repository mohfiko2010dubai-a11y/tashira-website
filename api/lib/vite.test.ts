import { describe, expect, it } from "vitest";
import { getFrontendCacheControl } from "./vite";

describe("frontend cache policy", () => {
  it("keeps HTML and client-side routes revalidatable", () => {
    expect(getFrontendCacheControl("/")).toBe("no-cache, no-store, must-revalidate");
    expect(getFrontendCacheControl("/admin/applications")).toBe("no-cache, no-store, must-revalidate");
  });

  it("caches content-hashed Vite assets immutably", () => {
    expect(getFrontendCacheControl("/assets/AdminApplications-b3w7EEc2.js")).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});
