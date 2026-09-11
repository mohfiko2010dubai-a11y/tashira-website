export type CheckoutPreflightDecision = {
  openPaymentUi: boolean;
  initializeStripe: boolean;
  createPaymentIntent: boolean;
  showCompletionPanel: boolean;
};

export function canVisitCheckout(readiness: { applicationMissing: readonly { code: string }[]; applicants: readonly { missing: readonly unknown[] }[] } | undefined): boolean {
  return Boolean(readiness && readiness.applicants.length > 0 && readiness.applicants.every(applicant => !applicant.missing.length)
    && readiness.applicationMissing.every(item => item.code === "application.policy"));
}

export function checkoutPreflightDecision(status: "READY" | "INCOMPLETE"): CheckoutPreflightDecision {
  const ready = status === "READY";
  return {
    openPaymentUi: ready,
    initializeStripe: ready,
    createPaymentIntent: false,
    showCompletionPanel: !ready,
  };
}

export function completionPanelGroups(input: {
  applicationMissing: Array<{ label: string }>;
  applicants: Array<{ label: string; missing: Array<{ label: string }> }>;
}): Array<{ heading: string; items: string[] }> {
  return [
    ...(input.applicationMissing.length > 0 ? [{ heading: "Application", items: input.applicationMissing.map((item) => item.label) }] : []),
    ...input.applicants
      .filter((applicant) => applicant.missing.length > 0)
      .map((applicant) => ({ heading: applicant.label, items: applicant.missing.map((item) => item.label) })),
  ];
}

export function safeCheckoutErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("APPLICATION_INCOMPLETE")) {
    return "Your application is not ready for payment yet. Please complete the missing information and documents first.";
  }
  return message || "Payment failed. Please try again.";
}
