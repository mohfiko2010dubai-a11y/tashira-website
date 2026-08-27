import { createHash } from "node:crypto";
import type { ApplicantFieldResolution, AuthorityFieldRequirement } from "../document-intelligence/contracts";

export type TypingPackField = { key: string; label: string; source: "APPLICANT" | "APPLICATION" | "EVALUATION" | "TRAVEL"; value: string };
export type TypingPack = {
  packId: string;
  applicationId: number;
  applicantId: number;
  templateId: string;
  templateVersion: number;
  generatedAt: string;
  fields: readonly TypingPackField[];
  humanVerificationFieldKeys: readonly string[];
  evidenceReferences: readonly string[];
  integritySha256: string;
  state: "DRAFT_REQUIRES_HUMAN_REVIEW";
};

export type AuthorityTypingFieldStatus = "VERIFIED" | "CONFIRMED" | "EXTRACTED" | "MISSING" | "CONFLICT" | "NEEDS_HUMAN_VERIFICATION";
export type AuthorityTypingField = {
  fieldCode: string;
  label: string;
  value: string | null;
  sourceEvidenceId: string | null;
  confidence: number | null;
  customerConfirmed: boolean;
  staffVerified: boolean;
  status: AuthorityTypingFieldStatus;
  blocking: boolean;
  reason: string;
};

export function projectAuthorityTypingFields(input: {
  applicantId: number;
  requirements: readonly AuthorityFieldRequirement[];
  resolutions: readonly ApplicantFieldResolution[];
}): { fields: readonly AuthorityTypingField[]; readyForTyping: boolean; blockingFieldCodes: readonly string[] } {
  if (input.resolutions.some((resolution) => resolution.applicantId !== input.applicantId)) throw new Error("TYPING_PACK_AUTHORITY_APPLICANT_SCOPE_MISMATCH");
  const byCode = new Map(input.resolutions.map((resolution) => [resolution.fieldCode, resolution]));
  const fields = input.requirements.map((requirement): AuthorityTypingField => {
    const resolution = byCode.get(requirement.fieldCode);
    const selected = resolution?.evidence.find((evidence) => evidence.evidenceId === resolution.selectedEvidenceId);
    let status: AuthorityTypingFieldStatus = "MISSING";
    if (resolution?.state === "CONFLICTED") status = "CONFLICT";
    else if (resolution?.state === "VERIFIED") status = "VERIFIED";
    else if (resolution?.state === "CONFIRMED") status = "CONFIRMED";
    else if (resolution?.state === "EXTRACTED" || resolution?.state === "DECLARED") status = "NEEDS_HUMAN_VERIFICATION";
    const blocking = requirement.requirement === "REQUIRED" && !["VERIFIED", "CONFIRMED"].includes(status);
    return { fieldCode: requirement.fieldCode, label: requirement.fieldLabel, value: resolution?.selectedValue ?? null,
      sourceEvidenceId: resolution?.selectedEvidenceId ?? null, confidence: selected?.confidence ?? null,
      customerConfirmed: selected?.customerConfirmed ?? false, staffVerified: selected?.staffVerified ?? false,
      status, blocking, reason: resolution?.reason ?? "MISSING_REQUIRED_AUTHORITY_FIELD" };
  });
  const blockingFieldCodes = fields.filter((field) => field.blocking).map((field) => field.fieldCode).sort();
  return { fields, readyForTyping: blockingFieldCodes.length === 0, blockingFieldCodes };
}

const prohibitedKeyFragments = ["cardnumber", "cvc", "cardexpiry", "stripesecret", "passportfilecontents", "storagepath", "documentcontents"] as const;
const humanVerificationSources: ReadonlySet<TypingPackField["source"]> = new Set(["APPLICANT", "EVALUATION", "TRAVEL"]);

export function humanVerificationFieldKeys(fields: readonly TypingPackField[]): readonly string[] {
  return [...new Set(fields.filter((field) => humanVerificationSources.has(field.source)).map((field) => field.key))].sort();
}

function prohibited(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  return prohibitedKeyFragments.some((fragment) => normalized.includes(fragment));
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });
}

export function generateTypingPack(input: Omit<TypingPack, "humanVerificationFieldKeys" | "integritySha256" | "state">): TypingPack {
  if (!input.packId.trim() || !Number.isSafeInteger(input.applicationId) || !Number.isSafeInteger(input.applicantId)) throw new Error("TYPING_PACK_IDENTITY_REQUIRED");
  if (!input.templateId.trim() || input.templateVersion <= 0 || input.evidenceReferences.length === 0) throw new Error("TYPING_PACK_TEMPLATE_EVIDENCE_REQUIRED");
  if (Number.isNaN(Date.parse(input.generatedAt))) throw new Error("TYPING_PACK_TIMESTAMP_INVALID");
  if (input.fields.some((field) => !field.key.trim() || field.key.length > 128 || !field.label.trim() || field.label.length > 200
    || field.value.length > 2_000 || hasControlCharacters(field.key) || hasControlCharacters(field.label)
    || hasControlCharacters(field.value) || prohibited(field.key))) throw new Error("TYPING_PACK_FIELD_PROHIBITED");
  if (new Set(input.fields.map((field) => field.key)).size !== input.fields.length) throw new Error("TYPING_PACK_FIELD_DUPLICATE");
  const canonical = { ...input, fields: [...input.fields].sort((a, b) => a.key.localeCompare(b.key)), evidenceReferences: [...new Set(input.evidenceReferences)].sort() };
  return { ...canonical, humanVerificationFieldKeys: humanVerificationFieldKeys(canonical.fields),
    integritySha256: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"), state: "DRAFT_REQUIRES_HUMAN_REVIEW" };
}
