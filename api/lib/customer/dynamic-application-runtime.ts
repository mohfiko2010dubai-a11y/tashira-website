import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { DynamicRequirementView, ApplicantAnswers } from "../requirements/dynamic-requirements";
import { buildDynamicRequirements } from "../requirements/dynamic-requirements";
import { toDynamicRequirementCatalog } from "../requirements/dynamic-catalog-adapter";
import type { MysqlRequirementCatalogProvider } from "../requirements/mysql-requirement-catalog-provider";
import type { FamilyEvaluation } from "../family/family-engine";
import type { SubmissionScheduleSnapshot } from "../travel/submission-scheduler";
import type { TravelQuestion } from "../travel/travel-questionnaire";
import { buildDynamicCustomerApplicationBehindFlags } from "./customer-experience-service";
import type { CustomerApplicantIdentity, CustomerTravelGroup, DynamicCustomerApplicationPlan } from "./dynamic-application-plan";
import type { CustomerPrecheckResult } from "./customer-precheck";

export type PrecheckHandoff = {
  precheckRuleEvidence: CustomerPrecheckResult["ruleEvidence"];
  finalRuleEvidence: FamilyEvaluation["members"][number]["ruleVersions"];
  materiallyChanged: boolean;
  changeReason: string | null;
};

export function comparePrecheckWithFinalEvaluation(input: {
  precheck: CustomerPrecheckResult;
  family: FamilyEvaluation;
}): PrecheckHandoff {
  const precheck = input.precheck.ruleEvidence.map(({ ruleId, version }) => `${ruleId}:${version}`).sort();
  const final = [...new Set(input.family.members.flatMap(({ ruleVersions }) => ruleVersions.map(({ ruleId, version }) => `${ruleId}:${version}`)))].sort();
  const materiallyChanged = precheck.join("|") !== final.join("|");
  return {
    precheckRuleEvidence: input.precheck.ruleEvidence,
    finalRuleEvidence: input.family.members.flatMap(({ ruleVersions }) => ruleVersions),
    materiallyChanged,
    changeReason: materiallyChanged ? "ACTIVE_RULE_VERSION_CHANGED_SINCE_PRECHECK" : null,
  };
}

/** Runtime composition boundary. Rules produce codes; the governed catalog supplies customer meaning. */
export async function buildDynamicApplicationFromCatalog(input: {
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  catalogProvider: Pick<MysqlRequirementCatalogProvider, "active">;
  evaluatedAt: Date;
  applicationId: number;
  identities: readonly CustomerApplicantIdentity[];
  family: FamilyEvaluation;
  answers: ApplicantAnswers;
  travelQuestions: readonly TravelQuestion[];
  travelGroups: readonly CustomerTravelGroup[];
  schedules: readonly SubmissionScheduleSnapshot[];
}): Promise<{ plan: DynamicCustomerApplicationPlan | null; requirements: DynamicRequirementView | null }> {
  const requiredFlags = ["VISA_RULES_EVALUATION", "DYNAMIC_REQUIREMENTS", "DYNAMIC_CUSTOMER_APPLICATION"] as const;
  const enabled = requiredFlags.every((key) => isOperationsFlagEnabled(key, input.context, input.flags));
  if (!enabled) return { plan: null, requirements: null };
  const catalog = toDynamicRequirementCatalog(await input.catalogProvider.active(input.evaluatedAt));
  const requirements = buildDynamicRequirements({ family: input.family, catalog, answers: input.answers });
  const plan = buildDynamicCustomerApplicationBehindFlags({ ...input, requirements });
  return { plan, requirements };
}
