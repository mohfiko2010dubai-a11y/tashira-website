import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const seedUrl = new URL("../../staging/seed-reference.sql", import.meta.url);

const expectedProducts = [
  "14days-single",
  "14days-multiple",
  "30days-single",
  "30days-multiple",
  "60days-single",
  "60days-multiple",
  "90days-single",
  "96hours-transit",
] as const;

describe("isolated staging pricing catalog", () => {
  it("seeds regular and express pricing for every selectable visa product", async () => {
    const sql = await readFile(seedUrl, "utf8");

    for (const product of expectedProducts) {
      expect(sql).toContain(`('${product}','regular'`);
      expect(sql).toContain(`('${product}','express'`);
    }
  });

  it("keeps the approved 14-day multiple-entry public prices reproducible", async () => {
    const sql = await readFile(seedUrl, "utf8");

    expect(sql).toContain("('14days-multiple','regular',1,180.00,15.00,70.00,265.00");
    expect(sql).toContain("('14days-multiple','express',1,195.00,15.00,85.00,295.00");
  });
});
