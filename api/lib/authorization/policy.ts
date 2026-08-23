import type { Permission, ResourceScope } from "./permissions";

export type AuthorizationActor = {
  id: string;
  permissions: ReadonlySet<Permission>;
  scopes: readonly ResourceScope[];
  teamIds: ReadonlySet<number>;
  departmentIds: ReadonlySet<number>;
};

export type AuthorizationResource = {
  ownerId?: string;
  assignedActorId?: string;
  teamId?: number;
  departmentId?: number;
};

export type AuthorizationDecision = {
  allowed: boolean;
  reason: "PERMISSION_DENIED" | "SCOPE_DENIED" | "ALLOWED";
};

function isWithinScope(actor: AuthorizationActor, resource: AuthorizationResource): boolean {
  if (actor.scopes.includes("ALL")) return true;
  if (actor.scopes.includes("OWN") && resource.ownerId === actor.id) return true;
  if (actor.scopes.includes("ASSIGNED") && resource.assignedActorId === actor.id) return true;
  if (actor.scopes.includes("TEAM") && resource.teamId !== undefined && actor.teamIds.has(resource.teamId)) return true;
  return actor.scopes.includes("DEPARTMENT")
    && resource.departmentId !== undefined
    && actor.departmentIds.has(resource.departmentId);
}

export function authorize(
  actor: AuthorizationActor,
  permission: Permission,
  resource: AuthorizationResource,
): AuthorizationDecision {
  if (!actor.permissions.has(permission)) return { allowed: false, reason: "PERMISSION_DENIED" };
  if (!isWithinScope(actor, resource)) return { allowed: false, reason: "SCOPE_DENIED" };
  return { allowed: true, reason: "ALLOWED" };
}

export type SupplierOperationalView = {
  id: number;
  name: string;
  slaHours: number | null;
  reliabilityScore: number | null;
};

export type SupplierFinancialView = SupplierOperationalView & {
  effectiveCost: string | null;
  internalCost: string | null;
};

export function projectSupplierForActor(
  actor: AuthorizationActor,
  supplier: SupplierFinancialView,
): SupplierOperationalView | SupplierFinancialView | null {
  if (actor.permissions.has("supplier.read_financial")) return supplier;
  if (!actor.permissions.has("supplier.read_operational")) return null;
  const { effectiveCost: _effectiveCost, internalCost: _internalCost, ...operational } = supplier;
  void _effectiveCost;
  void _internalCost;
  return operational;
}
