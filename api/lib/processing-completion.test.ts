import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
import { documentLeaves, requiredDocuments } from "../../contracts/document-requirement-engine";
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./customer/owner-document-evidence", async importOriginal => ({
  ...await importOriginal<typeof import("./customer/owner-document-evidence")>(), loadOwnerDocumentEvidence: mocks.load,
}));
import { recordDocumentCompletion, recordAuthoritySubmission } from "./processing-guarantee";
describe("durable service clocks", () => {
  const people = [{ id: 1, nationality: "EG", residenceCountry: "SA", visaType: "30days-single", residenceType: "gcc-resident", tripPurpose: "tourism" },
    { id: 2, nationality: "PK", residenceCountry: "SA", visaType: "30days-single", residenceType: "gcc-resident", tripPurpose: "tourism" }];
  const evidence = people.flatMap(person => requiredDocuments({ nationality: person.nationality, country_of_residence: person.residenceCountry,
    visa_type: person.visaType, residence_type: person.residenceType, trip_purpose: "tourism" }).flatMap(rule => documentLeaves(rule).map(leaf => ({ applicantId: person.id, code: leaf.code, storagePath: `${person.id}/${leaf.code}` })))).map((item, index) => ({ ...item, documentId: index + 1 }));
  const connection = () => { const execute = vi.fn().mockResolvedValueOnce([[]]).mockResolvedValueOnce([people]).mockResolvedValue([{}]); return { execute, value: { execute } as unknown as PoolConnection }; };
  beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue(evidence); });
  it("starts only after both travellers have their different required lists complete", async () => {
    const c = connection(); await recordDocumentCompletion(c.value, 1);
    expect(c.execute).toHaveBeenLastCalledWith(expect.stringContaining("COALESCE(documents_completed_at"), [1]);
  });
  it("does not start while the Pakistani second passport page is missing", async () => {
    mocks.load.mockResolvedValue(evidence.filter(item => item.code !== "PK_PASSPORT_PAGE_2"));
    const c = connection(); await recordDocumentCompletion(c.value, 1);expect(c.execute).toHaveBeenCalledTimes(2);
  });
  it("never resets a recorded completion clock on retry or subsequent edits", async () => {
    const execute = vi.fn().mockResolvedValue([[{ documents_completed_at: new Date() }]]);
    await recordDocumentCompletion({ execute } as unknown as PoolConnection, 1);expect(execute).toHaveBeenCalledTimes(1);expect(mocks.load).not.toHaveBeenCalled();
  });
  it("records actual authority submission once without replacing the first timestamp", async () => {
    const actualTime = new Date('2026-09-01T10:00:00Z');
    const execute = vi.fn().mockResolvedValueOnce([[{ occurred_at: actualTime }]]).mockResolvedValue([{}]);await recordAuthoritySubmission({ execute } as unknown as PoolConnection, 1, "staff:9", 'synthetic-proof');
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("COALESCE(authority_submitted_at"), [1, actualTime, "staff:9"]);
  });
  it('refuses to stop the authority clock without a committed proof for this action', async () => {
    const execute = vi.fn().mockResolvedValue([[]]);
    await expect(recordAuthoritySubmission({ execute } as unknown as PoolConnection, 1, 'staff:9')).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(execute).not.toHaveBeenCalled();
    await expect(recordAuthoritySubmission({ execute } as unknown as PoolConnection, 1, 'staff:9', 'missing')).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
