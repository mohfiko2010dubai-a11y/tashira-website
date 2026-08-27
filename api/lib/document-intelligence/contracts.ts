import { createHash } from "node:crypto";

export const authorityFieldSourceTypes = [
  "PASSPORT_MRZ", "PASSPORT_VISUAL", "NATIONAL_ID", "RESIDENCE_DOCUMENT", "TICKET",
  "CUSTOMER_DECLARED", "STAFF_VERIFIED", "AUTHORITY_RESPONSE",
] as const;
export type AuthorityFieldSourceType = typeof authorityFieldSourceTypes[number];

export type FieldVerificationState = "DECLARED" | "EXTRACTED" | "CONFIRMED" | "VERIFIED" | "CONFLICTED";
export type AuthorityFieldRequirement = {
  requirementId: string;
  authorityCode: string;
  visaRouteCode: string;
  fieldCode: string;
  fieldLabel: string;
  requirement: "REQUIRED" | "CONDITIONAL";
  nationalityScopes: readonly string[];
  residenceScopes: readonly string[];
  familyMinorScope: string | null;
  travelPartyScope: string | null;
  preferredSources: readonly AuthorityFieldSourceType[];
  fallbackSources: readonly AuthorityFieldSourceType[];
  validationRule: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceEvidenceReferences: readonly string[];
  ruleVersionId: string;
  approvalState: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "SUPERSEDED" | "RETIRED";
};

export type PassportProfile = {
  profileId: string;
  version: number;
  issuingCountry: string;
  passportType: string;
  layoutVersion: string;
  expectedVisibleFields: readonly string[];
  optionalVisibleFields: readonly string[];
  labelAliases: Readonly<Record<string, readonly string[]>>;
  mrzType: "TD1" | "TD2" | "TD3" | "NONE";
  expectedMrzFields: readonly string[];
  languages: readonly string[];
  nameStructure: "FULL_NAME" | "SURNAME_GIVEN_NAMES" | "PROFILE_DEFINED";
  legitimatelyAbsentFields: readonly string[];
  extractionStrategy: string;
  validationRules: readonly string[];
  confidenceThreshold: number;
  sourceEvidenceReferences: readonly string[];
  effectiveFrom: string;
  effectiveTo: string | null;
  lifecycle: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "SUPERSEDED" | "RETIRED";
  stagingTestOnly: boolean;
};

export type ExtractedFieldEvidence = {
  evidenceId: string;
  applicationId: number;
  applicantId: number;
  documentId: number | null;
  fieldCode: string;
  rawValueReference: string;
  extractedValue: string;
  normalizedValue: string;
  sourceType: AuthorityFieldSourceType;
  passportProfileId: string | null;
  passportProfileVersion: number | null;
  extractionProvider: string;
  extractionModelVersion: string;
  confidence: number;
  customerConfirmed: boolean;
  staffVerified: boolean;
  verifiedAt: string | null;
  state: FieldVerificationState;
  extractedAt: string;
};

export type ApplicantFieldResolution = {
  applicationId: number;
  applicantId: number;
  fieldCode: string;
  state: FieldVerificationState | "MISSING";
  selectedValue: string | null;
  selectedEvidenceId: string | null;
  evidence: readonly ExtractedFieldEvidence[];
  reason: string;
  requiresHumanReview: boolean;
};

function requiredText(value: string, error: string): string {
  const result = value.trim();
  const hasControlCharacter = [...result].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
  if (!result || result.length > 500 || hasControlCharacter) throw new Error(error);
  return result;
}

function validDate(value: string | null): boolean {
  return value === null || !Number.isNaN(Date.parse(value));
}

export function validateAuthorityFieldRequirement(input: AuthorityFieldRequirement): AuthorityFieldRequirement {
  requiredText(input.requirementId, "AUTHORITY_FIELD_ID_INVALID");
  requiredText(input.authorityCode, "AUTHORITY_FIELD_AUTHORITY_INVALID");
  requiredText(input.visaRouteCode, "AUTHORITY_FIELD_ROUTE_INVALID");
  requiredText(input.fieldCode, "AUTHORITY_FIELD_CODE_INVALID");
  requiredText(input.fieldLabel, "AUTHORITY_FIELD_LABEL_INVALID");
  requiredText(input.validationRule, "AUTHORITY_FIELD_VALIDATION_INVALID");
  requiredText(input.ruleVersionId, "AUTHORITY_FIELD_RULE_VERSION_INVALID");
  if (input.preferredSources.length === 0 || new Set(input.preferredSources).size !== input.preferredSources.length) {
    throw new Error("AUTHORITY_FIELD_SOURCE_HIERARCHY_INVALID");
  }
  if (input.preferredSources.some((source) => input.fallbackSources.includes(source))) {
    throw new Error("AUTHORITY_FIELD_SOURCE_HIERARCHY_OVERLAP");
  }
  if (input.sourceEvidenceReferences.length === 0 || !validDate(input.effectiveFrom) || !validDate(input.effectiveTo)) {
    throw new Error("AUTHORITY_FIELD_GOVERNANCE_EVIDENCE_REQUIRED");
  }
  return structuredClone(input);
}

export function validatePassportProfile(input: PassportProfile): PassportProfile {
  requiredText(input.profileId, "PASSPORT_PROFILE_ID_INVALID");
  requiredText(input.issuingCountry, "PASSPORT_PROFILE_COUNTRY_INVALID");
  requiredText(input.passportType, "PASSPORT_PROFILE_TYPE_INVALID");
  requiredText(input.layoutVersion, "PASSPORT_PROFILE_LAYOUT_INVALID");
  if (!Number.isSafeInteger(input.version) || input.version < 1 || input.expectedVisibleFields.length === 0) {
    throw new Error("PASSPORT_PROFILE_VERSION_FIELDS_INVALID");
  }
  if (!Number.isFinite(input.confidenceThreshold) || input.confidenceThreshold <= 0 || input.confidenceThreshold > 1) {
    throw new Error("PASSPORT_PROFILE_CONFIDENCE_INVALID");
  }
  if (input.sourceEvidenceReferences.length === 0 || !validDate(input.effectiveFrom) || !validDate(input.effectiveTo)) {
    throw new Error("PASSPORT_PROFILE_GOVERNANCE_EVIDENCE_REQUIRED");
  }
  return structuredClone(input);
}

function canonicalValue(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleUpperCase("en-US");
}

function validateEvidence(evidence: ExtractedFieldEvidence): void {
  if (!Number.isSafeInteger(evidence.applicationId) || !Number.isSafeInteger(evidence.applicantId)) throw new Error("FIELD_EVIDENCE_OWNERSHIP_INVALID");
  requiredText(evidence.evidenceId, "FIELD_EVIDENCE_ID_INVALID");
  requiredText(evidence.fieldCode, "FIELD_EVIDENCE_CODE_INVALID");
  requiredText(evidence.rawValueReference, "FIELD_EVIDENCE_RAW_REFERENCE_REQUIRED");
  if (!Number.isFinite(evidence.confidence) || evidence.confidence < 0 || evidence.confidence > 1) throw new Error("FIELD_EVIDENCE_CONFIDENCE_INVALID");
  if (!validDate(evidence.extractedAt) || !validDate(evidence.verifiedAt)) throw new Error("FIELD_EVIDENCE_TIMESTAMP_INVALID");
  if (evidence.staffVerified && !evidence.verifiedAt) throw new Error("FIELD_EVIDENCE_VERIFICATION_TIMESTAMP_REQUIRED");
}

export function resolveApplicantField(input: {
  applicationId: number;
  applicantId: number;
  fieldCode: string;
  evidence: readonly ExtractedFieldEvidence[];
  preferredSources: readonly AuthorityFieldSourceType[];
}): ApplicantFieldResolution {
  const owned = input.evidence.filter((item) => item.applicationId === input.applicationId && item.applicantId === input.applicantId && item.fieldCode === input.fieldCode);
  if (owned.length !== input.evidence.length) throw new Error("FIELD_EVIDENCE_OWNERSHIP_SCOPE_MISMATCH");
  owned.forEach(validateEvidence);
  if (owned.length === 0) return { applicationId: input.applicationId, applicantId: input.applicantId, fieldCode: input.fieldCode,
    state: "MISSING", selectedValue: null, selectedEvidenceId: null, evidence: [], reason: "MISSING_REQUIRED_AUTHORITY_FIELD", requiresHumanReview: false };

  const materialValues = new Set(owned.map((item) => canonicalValue(item.normalizedValue || item.extractedValue)).filter(Boolean));
  if (materialValues.size > 1 || owned.some((item) => item.state === "CONFLICTED")) {
    return { applicationId: input.applicationId, applicantId: input.applicantId, fieldCode: input.fieldCode,
      state: "CONFLICTED", selectedValue: null, selectedEvidenceId: null, evidence: structuredClone(owned), reason: "IDENTITY_DATA_CONFLICT", requiresHumanReview: true };
  }
  const rank = (source: AuthorityFieldSourceType) => {
    const index = input.preferredSources.indexOf(source);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const selected = [...owned].sort((left, right) => {
    if (left.staffVerified !== right.staffVerified) return left.staffVerified ? -1 : 1;
    if (left.customerConfirmed !== right.customerConfirmed) return left.customerConfirmed ? -1 : 1;
    return rank(left.sourceType) - rank(right.sourceType) || right.confidence - left.confidence || left.evidenceId.localeCompare(right.evidenceId);
  })[0];
  if (!selected) throw new Error("FIELD_EVIDENCE_SELECTION_FAILED");
  const state: FieldVerificationState = selected.staffVerified ? "VERIFIED" : selected.customerConfirmed ? "CONFIRMED" : selected.state;
  return { applicationId: input.applicationId, applicantId: input.applicantId, fieldCode: input.fieldCode, state,
    selectedValue: selected.normalizedValue || selected.extractedValue, selectedEvidenceId: selected.evidenceId,
    evidence: structuredClone(owned), reason: `SELECTED_${selected.sourceType}`, requiresHumanReview: false };
}

export function evidenceIntegrityReference(evidence: readonly ExtractedFieldEvidence[]): string {
  const canonical = [...evidence].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
