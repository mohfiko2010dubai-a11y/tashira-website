import { describe, expect, it } from "vitest";
import { assessRisk } from "./risk-engine";

describe("explainable risk engine", () => {
  it("returns transparent factors and never an accept/reject decision", () => {
    const result = assessRisk({ retries: 2, failures: 1, deviceChanges: 0, ipChanges: 0, velocityEvents: 0, applicantCount: 3 });
    expect(result.level).toBe("MEDIUM");
    expect(result.factors.map((factor) => factor.signal)).toEqual(["retries", "failures", "applicantCount"]);
    expect(result).not.toHaveProperty("decision");
  });

  it("caps the explainable score", () => {
    expect(assessRisk({ retries: 99, failures: 99, deviceChanges: 99, ipChanges: 99, velocityEvents: 99, applicantCount: 10 }).score).toBe(100);
  });
});
