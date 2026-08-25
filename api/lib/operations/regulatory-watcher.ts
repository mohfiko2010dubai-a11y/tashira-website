import { createHash } from "node:crypto";

export type RegulatorySnapshot = {
  sourceId: string;
  authority: string;
  sourceUrl: string;
  retrievedAt: string;
  normalizedContent: string;
};

export type RegulatoryProposal = {
  proposalId: string;
  sourceId: string;
  previousFingerprint: string;
  currentFingerprint: string;
  state: "PROPOSED";
  requiresAuthorizedHumanReview: true;
  automaticActivationAllowed: false;
  affectedActiveApplicationIds: readonly number[];
  changedAt: string;
};

export function regulatoryFingerprint(snapshot: RegulatorySnapshot): string {
  if (!snapshot.sourceUrl.startsWith("https://") || !snapshot.authority.trim() || Number.isNaN(Date.parse(snapshot.retrievedAt))) {
    throw new Error("REGULATORY_SOURCE_INVALID");
  }
  return createHash("sha256").update(snapshot.normalizedContent.trim().replace(/\s+/g, " ")).digest("hex");
}

export function proposeRegulatoryChange(input: {
  proposalId: string;
  previous: RegulatorySnapshot;
  current: RegulatorySnapshot;
  affectedActiveApplicationIds: readonly number[];
}): RegulatoryProposal | null {
  if (input.previous.sourceId !== input.current.sourceId) throw new Error("REGULATORY_SOURCE_MISMATCH");
  const previousFingerprint = regulatoryFingerprint(input.previous);
  const currentFingerprint = regulatoryFingerprint(input.current);
  if (previousFingerprint === currentFingerprint) return null;
  return {
    proposalId: input.proposalId,
    sourceId: input.current.sourceId,
    previousFingerprint,
    currentFingerprint,
    state: "PROPOSED",
    requiresAuthorizedHumanReview: true,
    automaticActivationAllowed: false,
    affectedActiveApplicationIds: [...new Set(input.affectedActiveApplicationIds)],
    changedAt: input.current.retrievedAt,
  };
}
