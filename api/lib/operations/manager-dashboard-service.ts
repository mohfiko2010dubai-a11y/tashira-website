import { authorize, type AuthorizationActor, type AuthorizationResource } from "../authorization/policy";
import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import { buildOperationsManagerDashboard, type OperationsAnalyticsCase, type OperationsManagerDashboard } from "./manager-analytics";

export type OperationsAnalyticsCandidate = OperationsAnalyticsCase & AuthorizationResource;

export function readOperationsManagerDashboard(input: { actor: AuthorizationActor; context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[]; candidates: readonly OperationsAnalyticsCandidate[]; now: Date;
  dueSoonDays: number; urgentDays: number }): OperationsManagerDashboard {
  if (!isOperationsFlagEnabled("OPERATIONS_CASE_READ_MODEL", input.context, input.flags)) throw new Error("OPERATIONS_MANAGER_DASHBOARD_DISABLED");
  if (!input.actor.permissions.has("case.read")) throw new Error("OPERATIONS_MANAGER_DASHBOARD_ACCESS_DENIED");
  const permitted = input.candidates.filter((candidate) => authorize(input.actor, "case.read", candidate).allowed);
  return buildOperationsManagerDashboard({ cases: permitted, now: input.now, dueSoonDays: input.dueSoonDays, urgentDays: input.urgentDays });
}
