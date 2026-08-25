import { describe, expect, it } from "vitest";
import { generateTypingPack } from "./typing-pack";

const base = { packId: "pack-1", applicationId: 1, applicantId: 2, templateId: "OWNER_APPROVED_TEMPLATE", templateVersion: 1, generatedAt: "2026-08-25T12:00:00Z", fields: [{ key: "passportNumber", label: "Passport number", source: "APPLICANT" as const, value: "SYNTHETIC" }], evidenceReferences: ["evaluation:1"] };
describe("typing pack", () => {
  it("creates an integrity-bound draft that requires staff review", () => { const pack = generateTypingPack(base); expect(pack.state).toBe("DRAFT_REQUIRES_HUMAN_REVIEW"); expect(pack.integritySha256).toMatch(/^[a-f0-9]{64}$/); });
  it("rejects payment and raw-document fields", () => expect(() => generateTypingPack({ ...base, fields: [{ ...base.fields[0], key: "cvc" }] })).toThrow("TYPING_PACK_FIELD_PROHIBITED"));
});
