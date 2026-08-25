export type AssistantGrounding = {
  activeRules: readonly { id: string; version: number; questionKey: string; answer: string; authority: string }[];
  authenticatedCase?: { applicationReference: string; customerAuthorized: boolean; statusAnswer?: string; requirementAnswer?: string };
  applicantRequirements?: readonly { applicantId: number; relationship: string; answer: string; evidenceReferences: readonly string[] }[];
  travelPartyAnswers?: Readonly<Record<string, { answer: string; evidenceReferences: readonly string[] }>>;
  submissionScheduleAnswers?: Readonly<Record<string, { answer: string; evidenceReferences: readonly string[] }>>;
  documentStatusAnswers?: Readonly<Record<string, { answer: string; evidenceReferences: readonly string[] }>>;
  approvedFaq: Readonly<Record<string, string>>;
  policies: Readonly<Record<string, string>>;
  approvedProcedures: Readonly<Record<string, string>>;
};

export type VisaAssistantResult = {
  state: "ANSWERED" | "HUMAN_REVIEW_REQUIRED" | "AUTHENTICATION_REQUIRED";
  answer: string;
  sourceType: "ACTIVE_RULE" | "AUTHENTICATED_CASE" | "APPROVED_FAQ" | "POLICY" | "APPROVED_PROCEDURE" | "NONE";
  sourceReferences: readonly string[];
};

export function answerVisaAssistant(questionKey: string, grounding: AssistantGrounding): VisaAssistantResult {
  const key = questionKey.trim();
  if (!key) throw new Error("ASSISTANT_QUESTION_KEY_REQUIRED");

  const rules = grounding.activeRules.filter((rule) => rule.questionKey === key);
  if (rules.length > 0) {
    const answers = new Set(rules.map((rule) => rule.answer));
    if (answers.size !== 1) return { state: "HUMAN_REVIEW_REQUIRED", answer: "This requirement needs human review.", sourceType: "NONE", sourceReferences: rules.map((rule) => `${rule.id}@${rule.version}`) };
    return { state: "ANSWERED", answer: rules[0].answer, sourceType: "ACTIVE_RULE", sourceReferences: rules.map((rule) => `${rule.id}@${rule.version}:${rule.authority}`) };
  }

  if (key === "case.status" || key === "case.requirements") {
    const currentCase = grounding.authenticatedCase;
    if (!currentCase?.customerAuthorized) return { state: "AUTHENTICATION_REQUIRED", answer: "Please sign in securely to view application-specific information.", sourceType: "NONE", sourceReferences: [] };
    const answer = key === "case.status" ? currentCase.statusAnswer : currentCase.requirementAnswer;
    return answer
      ? { state: "ANSWERED", answer, sourceType: "AUTHENTICATED_CASE", sourceReferences: [currentCase.applicationReference] }
      : { state: "HUMAN_REVIEW_REQUIRED", answer: "Your case requires assistance from the TASHIRA team.", sourceType: "AUTHENTICATED_CASE", sourceReferences: [currentCase.applicationReference] };
  }

  if (key.startsWith("applicant.requirements.")) {
    const currentCase = grounding.authenticatedCase;
    if (!currentCase?.customerAuthorized) return { state: "AUTHENTICATION_REQUIRED", answer: "Please sign in securely to view application-specific information.", sourceType: "NONE", sourceReferences: [] };
    const relationship = key.slice("applicant.requirements.".length).toLocaleUpperCase("en");
    const matches = (grounding.applicantRequirements ?? []).filter((item) => item.relationship.toLocaleUpperCase("en") === relationship);
    if (matches.length !== 1) return { state: "HUMAN_REVIEW_REQUIRED", answer: "A TASHIRA specialist must confirm the applicant requirements.", sourceType: "AUTHENTICATED_CASE", sourceReferences: [currentCase.applicationReference] };
    return { state: "ANSWERED", answer: matches[0].answer, sourceType: "AUTHENTICATED_CASE", sourceReferences: matches[0].evidenceReferences };
  }

  for (const values of [grounding.travelPartyAnswers, grounding.submissionScheduleAnswers, grounding.documentStatusAnswers]) {
    const grounded = values?.[key];
    if (!grounded) continue;
    if (!grounding.authenticatedCase?.customerAuthorized) return { state: "AUTHENTICATION_REQUIRED", answer: "Please sign in securely to view application-specific information.", sourceType: "NONE", sourceReferences: [] };
    return { state: "ANSWERED", answer: grounded.answer, sourceType: "AUTHENTICATED_CASE", sourceReferences: grounded.evidenceReferences };
  }

  for (const [sourceType, values] of [
    ["APPROVED_FAQ", grounding.approvedFaq], ["POLICY", grounding.policies], ["APPROVED_PROCEDURE", grounding.approvedProcedures],
  ] as const) {
    const answer = values[key];
    if (answer) return { state: "ANSWERED", answer, sourceType, sourceReferences: [key] };
  }
  return { state: "HUMAN_REVIEW_REQUIRED", answer: "I cannot confirm this information. A TASHIRA specialist must review it.", sourceType: "NONE", sourceReferences: [] };
}
