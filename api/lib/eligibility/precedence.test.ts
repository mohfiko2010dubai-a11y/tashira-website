import { describe, expect, it } from "vitest";
import { compareRuleLayers, RULE_PRECEDENCE, type RuleLayer } from "./precedence";

describe("visa rule precedence", () => {
  it("keeps the owner-approved precedence order immutable", () => {
    expect(RULE_PRECEDENCE).toEqual([
      "BASE_ROUTE",
      "NATIONALITY_OVERLAY",
      "RESIDENCE_OVERLAY",
      "GCC_OVERLAY",
      "AGE_MINOR_OVERLAY",
      "FAMILY_OVERLAY",
      "TRAVEL_PARTY_OVERLAY",
      "TICKET_TRAVEL_OVERLAY",
      "SUBMISSION_TIMING_OVERLAY",
      "OPERATIONAL_OVERLAY",
    ]);
  });

  it("sorts overlays deterministically", () => {
    expect((["FAMILY_OVERLAY", "BASE_ROUTE", "GCC_OVERLAY", "NATIONALITY_OVERLAY"] satisfies RuleLayer[])
      .sort(compareRuleLayers)).toEqual([
        "BASE_ROUTE", "NATIONALITY_OVERLAY", "GCC_OVERLAY", "FAMILY_OVERLAY",
      ]);
  });
});
