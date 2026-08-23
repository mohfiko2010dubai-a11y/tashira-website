import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATES, type Permission } from "./permissions";
import { authorize, projectSupplierForActor, type AuthorizationActor } from "./policy";

function actor(
  permissions: readonly Permission[],
  scopes: AuthorizationActor["scopes"] = ["ASSIGNED"],
): AuthorizationActor {
  return {
    id: "staff:7",
    permissions: new Set(permissions),
    scopes,
    teamIds: new Set([3]),
    departmentIds: new Set([2]),
  };
}

describe("authorization policy", () => {
  it("allows an operations employee to read an assigned case", () => {
    const employee = actor(ROLE_TEMPLATES.OPERATIONS_EMPLOYEE);
    expect(authorize(employee, "case.read_assigned", { assignedActorId: "staff:7" })).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
  });

  it("denies an operations employee outside the assigned scope", () => {
    const employee = actor(ROLE_TEMPLATES.OPERATIONS_EMPLOYEE);
    expect(authorize(employee, "case.read_assigned", { assignedActorId: "staff:8" }).reason).toBe("SCOPE_DENIED");
  });

  it("does not grant finance permissions to operations templates", () => {
    const manager = actor(ROLE_TEMPLATES.OPERATIONS_MANAGER, ["ALL"]);
    expect(authorize(manager, "finance.read_margin", {}).reason).toBe("PERMISSION_DENIED");
  });

  it("does not grant document access to a finance template", () => {
    const finance = actor(ROLE_TEMPLATES.FINANCE_MANAGER, ["ALL"]);
    expect(authorize(finance, "document.read", {}).reason).toBe("PERMISSION_DENIED");
  });

  it("removes confidential cost fields from operations supplier projections", () => {
    const employee = actor(ROLE_TEMPLATES.OPERATIONS_EMPLOYEE, ["ALL"]);
    const result = projectSupplierForActor(employee, {
      id: 1,
      name: "Synthetic Supplier",
      slaHours: 24,
      reliabilityScore: 95,
      effectiveCost: "100.00",
      internalCost: "5.00",
    });
    expect(result).toEqual({ id: 1, name: "Synthetic Supplier", slaHours: 24, reliabilityScore: 95 });
    expect(result).not.toHaveProperty("effectiveCost");
    expect(result).not.toHaveProperty("internalCost");
  });

  it("returns no supplier projection without either supplier permission", () => {
    expect(projectSupplierForActor(actor([], ["ALL"]), {
      id: 1, name: "Synthetic Supplier", slaHours: null, reliabilityScore: null,
      effectiveCost: "100.00", internalCost: "5.00",
    })).toBeNull();
  });
});
