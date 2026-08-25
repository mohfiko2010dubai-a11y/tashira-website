import { authorize, type AuthorizationActor } from "../authorization/policy";
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
  const travelPartyEnabled = isOperationsFlagEnabled("TRAVEL_PARTY_ENGINE", input.context, input.flags);
  const schedulerEnabled = isOperationsFlagEnabled("SUBMISSION_SCHEDULER", input.context, input.flags);
  const travelGroups = travelPartyEnabled ? (input.source.travelGroups ?? []).map((group) => schedulerEnabled ? group : {
    ...group, currentSchedule: null, scheduleHistory: [],
  }) : [];
  return buildOperationsCaseReadModel({
    source: { ...input.source, travelGroups },
    snapshots: input.snapshots,
    family: input.family,
    supplierProjection: input.source.supplier && input.actor.permissions.has("supplier.read_operational") ? {
      id: input.source.supplier.id,
      name: input.source.supplier.name,
      slaHours: input.source.supplier.slaHours,
      reliabilityScore: input.source.supplier.reliabilityScore,
    } : null,
  });
}
