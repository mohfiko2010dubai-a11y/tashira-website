import { describe, expect, it } from "vitest";
import type { FeatureFlagRecord, OperationsFlag } from "../feature-flags/feature-flags";
import { generateTypingPackBehindFlag } from "./case-output-service";
const enabled = (flagKey: OperationsFlag): FeatureFlagRecord => ({ flagKey, environment: "STAGING", enabled: true, scopeType: "GLOBAL", scopeReference: "" });
const input = { context: { environment: "STAGING" as const }, pack: { packId: "p1", applicationId: 1, applicantId: 1, templateId: "reviewed", templateVersion: 1, generatedAt: "2026-08-25T12:00:00Z", fields: [], evidenceReferences: ["e1"] } };
describe("case output feature gates", () => {
  it("keeps Typing Pack closed by default", () => { expect(generateTypingPackBehindFlag({ ...input, flags: [] })).toBeNull(); expect(generateTypingPackBehindFlag({ ...input, flags: [enabled("TYPING_PACK")] })?.state).toBe("DRAFT_REQUIRES_HUMAN_REVIEW"); });
});
