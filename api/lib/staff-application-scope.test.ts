import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "./authorization/policy";
import { assertStaffCaseScope, staffResourceTargets } from "./staff-application-scope";

const employee: AuthorizationActor = { id: "staff:7", permissions: new Set(["case.read_assigned", "document.read", "document.review", "case.transition"]), scopes: ["ASSIGNED"], teamIds: new Set(), departmentIds: new Set() };
describe("legacy staff application boundaries", () => {
  it("permits assigned reads and edits but denies another employee's case", () => {
    expect(() => assertStaffCaseScope(employee, { assignedActorId: "staff:7" }, true, true)).not.toThrow();
    for (const mutation of [true, false]) expect(() => assertStaffCaseScope(employee, { assignedActorId: "staff:8" }, true, mutation)).toThrow("Application access denied");
  });
  it("requires a document review permission even inside the case scope", () => {
    const reader = { ...employee, permissions: new Set(["case.read_assigned", "document.read"] as const) };
    expect(() => assertStaffCaseScope(reader, { assignedActorId: "staff:7" }, true, false)).not.toThrow();
    expect(() => assertStaffCaseScope(reader, { assignedActorId: "staff:7" }, true, true)).toThrow();
  });
  it("limits manager access to their own team", () => {
    const manager = { ...employee, permissions: new Set(["case.read", "document.read"] as const), scopes: ["TEAM"] as const, teamIds: new Set([2]) };
    expect(() => assertStaffCaseScope(manager, { teamId: 2 }, true, false)).not.toThrow();
    expect(() => assertStaffCaseScope(manager, { teamId: 3 }, true, false)).toThrow();
  });
  it("resolves legacy document IDs, signed URLs and application references", () => {
    expect(staffResourceTargets("document.delete", { id: 13 })).toEqual([{ kind: "document", value: 13 }]);
    expect(staffResourceTargets("storage.getSignedUrl", { documentId: 13 })).toEqual([{ kind: "document", value: 13 }]);
    expect(staffResourceTargets("application.getByReference", { referenceNumber: "TSH-X" })).toEqual([{ kind: "reference", value: "TSH-X" }]);
    expect(staffResourceTargets("document.create", { applicationId: 2, documentId: 13 })).toHaveLength(2);
    expect(staffResourceTargets("staff.update", { id: 7 })).toEqual([]);
    expect(staffResourceTargets("emailOperations.history", { referenceNumber: "TSH-X" })).toEqual([{ kind: "reference", value: "TSH-X" }]);
  });
});
