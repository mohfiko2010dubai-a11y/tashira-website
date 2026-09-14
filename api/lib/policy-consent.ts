export const EXPLICIT_POLICY_SOURCE = "PAYMENT_API";

export function policyConsentValidity(event: { eventName: string; eventSource: string; actorType: string }, invalidated: boolean) {
  if (event.eventName !== "POLICY_ACCEPTED") return null;
  return !invalidated && event.eventSource === EXPLICIT_POLICY_SOURCE && event.actorType === "CUSTOMER" ? "VALID" : "INVALID";
}
