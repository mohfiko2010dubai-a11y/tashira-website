import type {
  FeatureFlagContext,
  FeatureFlagRecord,
} from "../feature-flags/feature-flags";
import { isOperationsFlagEnabled } from "../feature-flags/feature-flags";
import {
  answerVisaAssistant,
  type VisaAssistantResult,
} from "../operations/visa-assistant-grounding";
import type { MysqlOperationsCaseBundle } from "../operations/mysql-case-read-provider";
import { buildCustomerPortalFromRuntime } from "./customer-portal-runtime";

const allowedKeys = new Set([
  "case.status",
  "case.requirements",
  "travel.together",
  "submission.when",
  "document.missing",
]);
export function answerCustomerVisaAssistant(input: {
  bundle: MysqlOperationsCaseBundle;
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  applicationReference: string;
  customerAuthorized: boolean;
  questionKey: string;
}): VisaAssistantResult | null {
  if (!isOperationsFlagEnabled("VISA_ASSISTANT", input.context, input.flags))
    return null;
  if (!allowedKeys.has(input.questionKey))
    return answerVisaAssistant(input.questionKey, {
      activeRules: [],
      approvedFaq: {},
      policies: {},
      approvedProcedures: {},
    });
  const portal = buildCustomerPortalFromRuntime({ ...input });
  if (!portal) return null;
  const actions = portal.requiredCustomerActions;
  const travel = portal.travel;
  return answerVisaAssistant(input.questionKey, {
    activeRules: [],
    approvedFaq: {},
    policies: {},
    approvedProcedures: {},
    authenticatedCase: {
      applicationReference: input.applicationReference,
      customerAuthorized: input.customerAuthorized,
      statusAnswer: portal.currentStatus.message,
      requirementAnswer: actions.length
        ? actions.join("; ")
        : "No outstanding customer actions are currently recorded.",
    },
    travelPartyAnswers: {
      "travel.together": {
        answer:
          travel.length === 0
            ? "No travel group schedule is currently recorded."
            : `${travel.length} travel group schedule${travel.length === 1 ? " is" : "s are"} recorded.`,
        evidenceReferences: travel.map(item => `travel:${item.travelGroupId}`),
      },
    },
    submissionScheduleAnswers: {
      "submission.when": {
        answer:
          travel.length === 0
            ? "Submission timing requires review by the TASHIRA team."
            : travel.map(item => item.explanation).join(" "),
        evidenceReferences: travel.map(
          item => `schedule:${item.travelGroupId}`
        ),
      },
    },
    documentStatusAnswers: {
      "document.missing": {
        answer: actions.length
          ? actions.join("; ")
          : "No outstanding customer document action is currently recorded.",
        evidenceReferences: portal.applicants.map(
          item => `applicant:${item.applicantId}`
        ),
      },
    },
  });
}
