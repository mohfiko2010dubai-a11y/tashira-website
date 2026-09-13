import { describe, expect, it } from "vitest";
import fixtures from "./marketing-compliance.test.fixtures.json";
import metadata from "../../contracts/public-page-metadata.json";
import { findMarketingViolations } from "../../contracts/marketing-compliance";

describe("owner marketing claim fixtures", () => {
  it.each(fixtures.pass)("allows disclaimer: %s", text => {
    expect(findMarketingViolations(text)).toEqual([]);
  });
  it.each(fixtures.fail)("rejects claim: %s", text => {
    expect(findMarketingViolations(text).length).toBeGreaterThan(0);
  });
  it("reports the exact phrase and line for actionable build errors", () => {
    expect(findMarketingViolations("Safe text.\nGuaranteed approval.")).toEqual([
      expect.objectContaining({ phrase: "Guaranteed approval", line: 2 }),
    ]);
  });
  it("accepts every owner-approved fixed-page title and description", () => {
    for (const page of Object.values(metadata)) {
      for (const language of Object.values(page)) {
        expect(findMarketingViolations(language.title)).toEqual([]);
        expect(findMarketingViolations(language.description)).toEqual([]);
      }
    }
  });
});
