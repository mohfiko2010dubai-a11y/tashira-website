import type { ApplicationReadiness } from "./application-readiness";

export type AbandonedReminderStage = "APPLICATION" | "DOCUMENTS" | "PAYMENT";

export function abandonedReminderStage(input: {
  paymentStatus: string;
  emailKnown: boolean;
  checkoutReached: boolean;
  readiness: ApplicationReadiness;
}): AbandonedReminderStage | null {
  if (input.paymentStatus === "paid" || !input.emailKnown) return null;
  if (input.checkoutReached) return "PAYMENT";
  const documentsMissing = input.readiness.applicants.some((applicant) =>
    applicant.missing.some((item) => item.code.startsWith("document.")),
  );
  if (documentsMissing) return "DOCUMENTS";
  return input.readiness.status === "INCOMPLETE" ? "APPLICATION" : null;
}
