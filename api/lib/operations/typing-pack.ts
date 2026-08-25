import { createHash } from "node:crypto";

export type TypingPackField = { key: string; label: string; source: "APPLICANT" | "APPLICATION" | "EVALUATION" | "TRAVEL"; value: string };
export type TypingPack = {
  packId: string;
  applicationId: number;
  applicantId: number;
  templateId: string;
  templateVersion: number;
  generatedAt: string;
  fields: readonly TypingPackField[];
  evidenceReferences: readonly string[];
  integritySha256: string;
  state: "DRAFT_REQUIRES_HUMAN_REVIEW";
};

const prohibitedKeys = new Set(["cardNumber", "cvc", "cardExpiry", "stripeSecret", "passportFileContents"]);

export function generateTypingPack(input: Omit<TypingPack, "integritySha256" | "state">): TypingPack {
  if (!input.packId.trim() || !Number.isSafeInteger(input.applicationId) || !Number.isSafeInteger(input.applicantId)) throw new Error("TYPING_PACK_IDENTITY_REQUIRED");
  if (!input.templateId.trim() || input.templateVersion <= 0 || input.evidenceReferences.length === 0) throw new Error("TYPING_PACK_TEMPLATE_EVIDENCE_REQUIRED");
  if (Number.isNaN(Date.parse(input.generatedAt))) throw new Error("TYPING_PACK_TIMESTAMP_INVALID");
  if (input.fields.some((field) => !field.key.trim() || !field.label.trim() || prohibitedKeys.has(field.key))) throw new Error("TYPING_PACK_FIELD_PROHIBITED");
  const canonical = { ...input, fields: [...input.fields].sort((a, b) => a.key.localeCompare(b.key)), evidenceReferences: [...new Set(input.evidenceReferences)].sort() };
  return { ...canonical, integritySha256: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"), state: "DRAFT_REQUIRES_HUMAN_REVIEW" };
}
