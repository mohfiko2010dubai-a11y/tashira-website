import { claimAnalyticsEvent, safeFunnelParameters, verifiedPaymentConversionParameters, type VerifiedPurchaseInput } from "./google-conversion-decision";

type GoogleEventParameters = Record<string, string | number>;
type FunnelEvent = "begin_application" | "application_submitted" | "begin_checkout";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: "config" | "event" | "js", target: string | Date, params?: GoogleEventParameters) => void;
  }
}

export function initializeGoogleAnalytics() {
  // Automatic vendor collection can include private application/recovery URLs.
  // Keep collection closed until an explicitly reviewed, URL-safe integration
  // exists. Setting a measurement ID alone must never re-enable this path.
  return false;
}

function once(storage: Storage, key: string, send: () => void) {
  if (!claimAnalyticsEvent(storage, key)) return false;
  send();
  return true;
}

export function trackFunnelEventOnce(eventName: FunnelEvent, journeyKey: string, parameters: GoogleEventParameters = {}) {
  if (!initializeGoogleAnalytics() || !window.gtag) return false;
  const safeParameters = safeFunnelParameters(eventName, parameters);
  return once(sessionStorage, `tashira_ga4_${eventName}_${journeyKey}`, () => {
    window.gtag?.("event", eventName, safeParameters);
  });
}

export function trackVerifiedPaymentConversion(input: VerifiedPurchaseInput) {
  const parameters = verifiedPaymentConversionParameters(input);
  if (!parameters || !initializeGoogleAnalytics() || !window.gtag) return false;
  return once(localStorage, `tashira_ga4_purchase_${input.transactionId}`, () => {
    window.gtag?.("event", "purchase", parameters);
  });
}
