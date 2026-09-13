import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolveStoragePath } from "../local-storage";
import type { OperationsSqlClient } from "../operations/mysql-access-provider";
import { documentLeaves, requirementSatisfied, type DocumentRequirementRule } from "../../../contracts/document-requirement-engine";

export type OwnerDocumentEvidence = { applicantId: number; code: string; documentId: number; storagePath: string };
export async function loadOwnerDocumentEvidence(sql: OperationsSqlClient, applicationId: number): Promise<OwnerDocumentEvidence[]> {
  const rows = await sql.query(`SELECT l.applicant_id AS applicantId,l.requirement_code AS code,d.id AS documentId,d.storage_path AS storagePath
    FROM applicant_requirement_document_links l JOIN documents d ON d.id=l.document_id
      AND d.application_id=l.application_id AND d.applicant_id=l.applicant_id
    WHERE l.application_id=? AND d.upload_status='uploaded'`, [applicationId]);
  return rows.map(row => ({ applicantId: Number(Reflect.get(row, "applicantId")), code: String(Reflect.get(row, "code")),
    documentId: Number(Reflect.get(row, "documentId")), storagePath: String(Reflect.get(row, "storagePath")) }));
}
export function projectOwnerDocuments(rules: readonly DocumentRequirementRule[], evidence: readonly OwnerDocumentEvidence[], applicantId: number) {
  const uploadedCodes = [...new Set(evidence.filter(row => row.applicantId === applicantId).map(row => row.code))];
  return rules.map(rule => {
    const ownCodes = new Set([...documentLeaves(rule).map(leaf => leaf.code), ...(rule.legacy_codes ?? [])]);
    const distinctCodes = new Set(rules.filter(other => rule.distinct_from?.includes(other.key))
      .flatMap(other => [...documentLeaves(other).map(leaf => leaf.code), ...(other.legacy_codes ?? [])]));
    const own = evidence.filter(row => row.applicantId === applicantId && ownCodes.has(row.code));
    const validCodes = distinctCodes.size ? own.filter(file => !evidence.some(other => other.applicantId === applicantId && distinctCodes.has(other.code)
      && (file.documentId === other.documentId || file.storagePath === other.storagePath))).map(file => file.code) : uploadedCodes;
    return { applicantId, requirementCode: rule.code, documentType: rule.document_type, uploadedCodes,
      state: requirementSatisfied(rule, new Set(validCodes)) ? "UPLOADED" as const : "MISSING" as const };
  });
}
import { DISTINCT_DOCUMENT_MESSAGE } from "../../../contracts/document-upload-policy";
export { DISTINCT_DOCUMENT_MESSAGE };
export function conflictingDocumentCodes(rule: DocumentRequirementRule, rules: readonly DocumentRequirementRule[]): Set<string> {
  return new Set(rules.filter(other => rule.distinct_from?.includes(other.key) || other.distinct_from?.includes(rule.key))
    .flatMap(other => [...documentLeaves(other).map(leaf => leaf.code), ...(other.legacy_codes ?? [])]));
}
async function fileDigest(storagePath: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(resolveStoragePath(storagePath))) digest.update(chunk);
  return digest.digest("hex");
}
/** Compare bytes too: re-uploading the same file under a new ID cannot bypass the separate-document rule. */
export async function assertDistinctDocument(rule: DocumentRequirementRule, rules: readonly DocumentRequirementRule[],
  candidate: OwnerDocumentEvidence, evidence: readonly OwnerDocumentEvidence[], hashFile = fileDigest): Promise<void> {
  const conflicting = conflictingDocumentCodes(rule, rules);
  const paired = evidence.filter(row => row.applicantId === candidate.applicantId && conflicting.has(row.code));
  if (!paired.length) return;
  if (paired.some(row => row.documentId === candidate.documentId || row.storagePath === candidate.storagePath)) throw new Error(DISTINCT_DOCUMENT_MESSAGE);
  const hash = await hashFile(candidate.storagePath);
  for (const row of paired) if (hash === await hashFile(row.storagePath)) throw new Error(DISTINCT_DOCUMENT_MESSAGE);
}
