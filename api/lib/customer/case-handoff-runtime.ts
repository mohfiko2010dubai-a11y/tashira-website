import { randomUUID } from "node:crypto";
import type {
  FeatureFlagContext,
  FeatureFlagRecord,
} from "../feature-flags/feature-flags";
import { isOperationsFlagEnabled } from "../feature-flags/feature-flags";
import {
  createHumanHandoff,
  type HumanHandoff,
} from "../operations/human-handoff";
import type { MysqlOperationsCaseBundle } from "../operations/mysql-case-read-provider";
import { answerCustomerVisaAssistant } from "./visa-assistant-runtime";

export type CaseHandoffPersistenceInput = HumanHandoff & {
  teamId: number;
  customerReference: string;
  requestFingerprint: string;
};

export interface CaseHandoffRepository {
  create(input: CaseHandoffPersistenceInput): Promise<HumanHandoff>;
}

export async function requestCustomerCaseHandoff(input: {
  bundle: MysqlOperationsCaseBundle;
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  applicationReference: string;
  customerAuthorized: boolean;
  questionKey: string;
  requestId: string;
  requestFingerprint: string;
  now: Date;
  repository: CaseHandoffRepository;
}): Promise<HumanHandoff | null> {
  if (!isOperationsFlagEnabled("CASE_CHAT_HANDOFF", input.context, input.flags))
    return null;
  const summary = input.bundle.source.summary;
  if (
    !input.customerAuthorized ||
    summary.reference !== input.applicationReference ||
    !summary.teamId
  ) {
    throw new Error("CASE_HANDOFF_OWNERSHIP_OR_TEAM_REQUIRED");
  }
  const answer = answerCustomerVisaAssistant(input);
  if (!answer) return null;
  const applicants = input.bundle.source.applicants;
  if (applicants.length === 0)
    throw new Error("CASE_HANDOFF_APPLICANT_SCOPE_REQUIRED");
  const ruleReferences: string[] = [];
  const requirementReferences: string[] = [];
  for (const applicant of applicants) {
    const evaluation = input.bundle.snapshots.current(
      summary.applicationId,
      applicant.applicantId
    );
    if (!evaluation)
      throw new Error("CASE_HANDOFF_CURRENT_EVALUATION_REQUIRED");
    ruleReferences.push(
      ...evaluation.matchedRuleVersions.map(
        rule => `rule:${rule.ruleId}@${rule.version}`
      )
    );
    requirementReferences.push(
      ...input.bundle.family
        .requirements(
          summary.applicationId,
          applicant.applicantId,
          evaluation.evaluationId
        )
        .map(requirement => `requirement:${requirement.instance.id}`)
    );
  }
  const handoff = createHumanHandoff({
    handoffId: input.requestId,
    conversationId: input.requestId,
    applicationId: summary.applicationId,
    createdAt: input.now.toISOString(),
    trigger: "CUSTOMER_REQUEST",
    customerQuestion: input.questionKey,
    aiSummary: answer.answer,
    applicantIds: applicants.map(applicant => applicant.applicantId),
    travelGroupIds: (input.bundle.source.travelGroups ?? []).map(
      group => group.id
    ),
    ruleReferences,
    requirementReferences,
    documentReferences: input.bundle.source.documents.map(
      document => `document:${document.documentId}`
    ),
    schedulerReference: null,
    suggestedReply:
      "A TASHIRA specialist will review your case evidence and respond through an authorized channel.",
    auditReference: randomUUID(),
  });
  return input.repository.create({
    ...handoff,
    teamId: summary.teamId,
    customerReference: summary.reference,
    requestFingerprint: input.requestFingerprint,
  });
}
