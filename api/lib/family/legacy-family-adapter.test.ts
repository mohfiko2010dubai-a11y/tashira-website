import { describe, expect, it } from "vitest";
import { adaptLegacyFamily } from "./legacy-family-adapter";

describe("legacy family compatibility adapter", () => {
  it("keeps legacy records readable without inventing specific relationships", () => {
    const adapted = adaptLegacyFamily([{ applicantId: 12, applicantIndex: 1 }, { applicantId: 11, applicantIndex: 0 }]);
    expect(adapted.members).toEqual([
      { applicantId: 11, relationship: "LEAD_APPLICANT" },
      { applicantId: 12, relationship: "OTHER" },
    ]);
    expect(adapted.warnings).toContain("SPECIFIC_RELATIONSHIPS_REQUIRE_REVIEW");
  });

  it("fails closed for ambiguous duplicate legacy indexes", () => {
    expect(() => adaptLegacyFamily([{ applicantId: 11, applicantIndex: 0 }, { applicantId: 12, applicantIndex: 0 }])).toThrow(/unique/i);
  });
});
