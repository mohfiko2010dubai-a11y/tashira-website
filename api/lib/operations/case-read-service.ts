import { authorize, projectSupplierForActor, type AuthorizationActor } from "../authorization/policy";
import type { Permission } from "../authorization/permissions";
import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import { InMemoryFamilyPersistenceRepository } from "../family/family-persistence";
import { buildOperationsCaseReadModel, caseAuthorizationResource, type OperationsCaseReadModel, type OperationsCaseSource } from "./case-read-model";

function requirePermission(actor: AuthorizationActor, permission: Permission, resource: ReturnType<typeof caseAuthorizationResource>): void {
  if (!authorize(actor, permission, resource).allowed) throw new Error("OPERATIONS_CASE_ACCESS_DENIED");
}

export function readOperationsCase(input: {
  actor: AuthorizationActor;
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  source: OperationsCaseSource;
  snapshots: InMemoryEligibilitySnapshotRepository;
  family: InMemoryFamilyPersistenceRepository;
}): OperationsCaseReadModel {
  if (!isOperationsFlagEnabled("OPERATIONS_CASE_READ_MODEL", input.context, input.flags)) {
    throw new Error("OPERATIONS_CASE_READ_MODEL_DISABLED");
  }
  const resource = caseAuthorizationResource(input.source);
  const casePermission: Permission = input.actor.permissions.has("case.read") ? "case.read" : "case.read_assigned";
  requirePermission(input.actor, casePermission, resource);
  requirePermission(input.actor, "applicant.read", resource);
  requirePermission(input.actor, "document.read", resource);
  requirePermission(input.actor, "rule.read", resource);
  return buildOperationsCaseReadModel({
    source: input.source,
    snapshots: input.snapshots,
    family: input.family,
    supplierProjection: input.source.supplier ? projectSupplierForActor(input.actor, input.source.supplier) : null,
  });
}
