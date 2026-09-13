import { describe, expect, it, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import { MysqlCustomerInterviewWriteRepository } from "./mysql-customer-interview-write-repository";
import { DISTINCT_DOCUMENT_MESSAGE } from "./owner-document-evidence";

function fixture(evidence: object[] = [], owned = true) {
  const execute = vi.fn(async (query: string) => {
    if (query.startsWith("SELECT id FROM applications")) return [[{ id: 9 }]];
    if (query.includes("SELECT i.id,i.requirement_code")) return [[{ id: "requirement-instance" }]];
    if (query.includes("SELECT id,storage_path")) return [owned ? [{ id: 10, storagePath: "synthetic/candidate.pdf" }] : []];
    if (query.includes("FROM applicant_requirement_document_links l JOIN documents")) return [evidence];
    if (query.includes("SELECT a.nationality")) return [[{ nationality: "EG", residenceCountry: "SA", visaType: "30days-single", tripPurpose: "tourism" }]];
    return [[]];
  });
  const connection = { execute, beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  const repository = new MysqlCustomerInterviewWriteRepository({ getConnection: async () => connection } as unknown as Pool);
  const input = { applicationId: 9, applicantId: 1, requirementCode: "KSA_RESIDENCE_PROOF", documentKey: "ksa_proof_muqeem",
    documentId: 10, ownerDocuments: true, actorReference: "synthetic-test", idempotencyKey: "synthetic-upload-1", occurredAt: new Date("2026-09-13") };
  return { repository, input, connection, execute };
}
describe("Owner document linking transaction", () => {
  it("persists the chosen leaf against the parent requirement instance and marks the group complete", async () => {
    const { repository, input, execute, connection } = fixture();
    await repository.linkRequirementDocument(input);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO applicant_requirement_document_links"),
      expect.arrayContaining(["requirement-instance", "KSA_PROOF_MUQEEM"]));
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO applicant_requirement_events"), expect.any(Array));
    expect(connection.commit).toHaveBeenCalledOnce();
  });
  it("rejects a missing or forged choice instead of marking the group uploaded", async () => {
    for (const documentKey of [undefined, "ksa_absher_report"]) {
      const { repository, input, connection } = fixture();
      await expect(repository.linkRequirementDocument({ ...input, documentKey })).rejects.toThrow("CHOOSE_DOCUMENT_OPTION");
      expect(connection.rollback).toHaveBeenCalledOnce(); expect(connection.commit).not.toHaveBeenCalled();
    }
  });
  it("enforces document ownership before processing file content", async () => {
    const { repository, input } = fixture([], false);
    await expect(repository.linkRequirementDocument(input)).rejects.toThrow("OWNERSHIP_INVALID");
  });
  it("rejects reusing proof for the separate report before any link or state event is written", async () => {
    const { repository, input, execute, connection } = fixture([{ applicantId: 1, code: "KSA_PROOF_ABSHER", documentId: 10, storagePath: "synthetic/candidate.pdf" }]);
    await expect(repository.linkRequirementDocument({ ...input, requirementCode: "SA_ABSHER_REPORT", documentKey: undefined })).rejects.toThrow(DISTINCT_DOCUMENT_MESSAGE);
    expect(execute).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO applicant_requirement_document_links"), expect.any(Array));
    expect(connection.rollback).toHaveBeenCalledOnce();
  });
});
