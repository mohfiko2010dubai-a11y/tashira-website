import { OWNER_DOCUMENTS } from "@contracts/owner-document-requirements";

type ReviewRequirement = { code: string; label: string; classification: string; state: string };
type SavedRequirement = { applicantId: number; requirementCode: string; state: string };

export function reviewDocumentStatus(applicantId: number, evaluated: readonly ReviewRequirement[], saved: readonly SavedRequirement[] | undefined, ar = false): ReviewRequirement[] {
  if (!saved) return [...evaluated];
  return saved.filter(item => item.applicantId === applicantId).map(item => {
    const original = evaluated.find(requirement => requirement.code === item.requirementCode);
    const owner = OWNER_DOCUMENTS.find(requirement => requirement.code === item.requirementCode);
    const label = owner ? (ar ? owner.ar : owner.en) : original?.label ?? item.requirementCode.replaceAll("_", " ");
    return { code: item.requirementCode, label, classification: original?.classification ?? "TASHIRA_PROCESSING", state: item.state };
  });
}
