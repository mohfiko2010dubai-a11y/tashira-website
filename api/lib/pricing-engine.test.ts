import { describe, expect, it } from "vitest";

describe("pricing invariants", () => {
  it("keeps all payable calculation on the server module", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./pricing-engine.ts", import.meta.url), "utf8"));
    expect(source).toContain("minimum selling price");
    expect(source).toContain("saveApplicationPriceSnapshot");
    expect(source).not.toContain("Math.random");
  });
});
