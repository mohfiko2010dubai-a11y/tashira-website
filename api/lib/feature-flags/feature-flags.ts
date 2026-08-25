export const OPERATIONS_FLAGS = [
  "VISA_RULES_EVALUATION",
  "DYNAMIC_REQUIREMENTS",
  "FAMILY_ENGINE",
  "TRAVEL_PARTY_ENGINE",
  "SUBMISSION_SCHEDULER",
  "OPERATIONS_CASE_READ_MODEL",
  "OPERATIONS_CONTROLLED_WRITES",
  "AI_DOCUMENT_REVIEW",
  "OPERATIONS_STATE_MACHINE",
  "SUPPORT_INBOX",
  "REGULATORY_WATCHER",
  "DYNAMIC_CUSTOMER_APPLICATION",
  "CUSTOMER_PRECHECK",
  "CUSTOMER_OPERATIONS_PORTAL",
] as const;

export type OperationsFlag = typeof OPERATIONS_FLAGS[number];
export type FlagEnvironment = "DEVELOPMENT" | "TEST" | "STAGING" | "PRODUCTION";
export type FlagScope = "GLOBAL" | "TEAM" | "STAFF" | "APPLICATION";

export type FeatureFlagRecord = {
  flagKey: OperationsFlag;
  environment: FlagEnvironment;
  enabled: boolean;
  scopeType: FlagScope;
  scopeReference: string;
};

export type FeatureFlagContext = {
  environment: FlagEnvironment;
  staffId?: number;
  teamIds?: ReadonlySet<number>;
  applicationReference?: string;
};

function matchesScope(flag: FeatureFlagRecord, context: FeatureFlagContext): boolean {
  switch (flag.scopeType) {
    case "GLOBAL": return flag.scopeReference === "";
    case "STAFF": return context.staffId !== undefined && flag.scopeReference === String(context.staffId);
    case "TEAM": return [...(context.teamIds ?? [])].some((teamId) => flag.scopeReference === String(teamId));
    case "APPLICATION": return context.applicationReference !== undefined
      && flag.scopeReference === context.applicationReference;
  }
}

const scopePriority: Readonly<Record<FlagScope, number>> = {
  GLOBAL: 0,
  TEAM: 1,
  STAFF: 2,
  APPLICATION: 3,
};

export function isOperationsFlagEnabled(
  flagKey: OperationsFlag,
  context: FeatureFlagContext,
  records: readonly FeatureFlagRecord[],
): boolean {
  const matching = records
    .filter((record) => record.flagKey === flagKey && record.environment === context.environment)
    .filter((record) => matchesScope(record, context))
    .sort((left, right) => scopePriority[right.scopeType] - scopePriority[left.scopeType]);
  return matching[0]?.enabled === true;
}
