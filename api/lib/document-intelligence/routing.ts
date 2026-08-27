export type DocumentIntelligenceTier = "DETERMINISTIC" | "MRZ" | "LOW_COST_OCR" | "PROFILE_MAPPING" | "ADVANCED_AI" | "HUMAN_REVIEW";
export type DocumentRoutingInput = {
  hasMachineReadableZone: boolean;
  knownPassportProfile: boolean;
  ocrConfidence: number | null;
  profileConfidenceThreshold: number;
  materialConflict: boolean;
  unreadable: boolean;
  requiredFieldMissing: boolean;
  advancedProviderAvailable: boolean;
  estimatedCosts: Readonly<Partial<Record<DocumentIntelligenceTier, number>>>;
};
export type DocumentRoutingDecision = {
  tiers: readonly DocumentIntelligenceTier[];
  finalTier: DocumentIntelligenceTier;
  escalationReasons: readonly string[];
  estimatedCost: number;
  requiresHumanReview: boolean;
};

export function routeDocumentIntelligence(input: DocumentRoutingInput): DocumentRoutingDecision {
  if (!Number.isFinite(input.profileConfidenceThreshold) || input.profileConfidenceThreshold <= 0 || input.profileConfidenceThreshold > 1) {
    throw new Error("DOCUMENT_ROUTING_THRESHOLD_INVALID");
  }
  if (input.ocrConfidence !== null && (!Number.isFinite(input.ocrConfidence) || input.ocrConfidence < 0 || input.ocrConfidence > 1)) {
    throw new Error("DOCUMENT_ROUTING_CONFIDENCE_INVALID");
  }
  const tiers: DocumentIntelligenceTier[] = ["DETERMINISTIC"];
  const reasons: string[] = [];
  if (input.hasMachineReadableZone) tiers.push("MRZ");
  tiers.push("LOW_COST_OCR");
  if (input.knownPassportProfile) tiers.push("PROFILE_MAPPING");
  else reasons.push("UNKNOWN_PASSPORT_LAYOUT");
  if (input.unreadable) reasons.push("DOCUMENT_UNREADABLE");
  if (input.materialConflict) reasons.push("IDENTITY_DATA_CONFLICT");
  if (input.requiredFieldMissing) reasons.push("REQUIRED_FIELD_NOT_FOUND");
  if (input.ocrConfidence === null || input.ocrConfidence < input.profileConfidenceThreshold) reasons.push("OCR_CONFIDENCE_BELOW_THRESHOLD");

  const needsEscalation = reasons.length > 0;
  if (needsEscalation && input.advancedProviderAvailable) tiers.push("ADVANCED_AI");
  const unresolvedWithoutProvider = needsEscalation && !input.advancedProviderAvailable;
  const mandatoryHumanReview = input.materialConflict || input.unreadable || unresolvedWithoutProvider;
  if (mandatoryHumanReview) tiers.push("HUMAN_REVIEW");
  const estimatedCost = Number(tiers.reduce((sum, tier) => sum + (input.estimatedCosts[tier] ?? 0), 0).toFixed(6));
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) throw new Error("DOCUMENT_ROUTING_COST_INVALID");
  return { tiers, finalTier: tiers.at(-1) ?? "DETERMINISTIC", escalationReasons: reasons,
    estimatedCost, requiresHumanReview: mandatoryHumanReview };
}
