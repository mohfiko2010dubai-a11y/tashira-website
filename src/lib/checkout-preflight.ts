export type CheckoutPreflightDecision = {
  openPaymentUi: boolean;
  initializeStripe: boolean;
  createPaymentIntent: boolean;
  showCompletionPanel: boolean;
};

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
