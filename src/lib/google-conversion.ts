import { claimAnalyticsEvent, GA4_MEASUREMENT_ID, safeFunnelParameters, verifiedPaymentConversionParameters, type VerifiedPurchaseInput } from "./google-conversion-decision";

type GoogleEventParameters = Record<string, string | number>;
type FunnelEvent = "begin_application" | "application_submitted" | "begin_checkout";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: "config" | "event" | "js", target: string | Date, params?: GoogleEventParameters) => void;
  }
}

const configuredMeasurementId = import.meta.env.VITE_GOOGLE_TAG_ID?.trim() || "";
let initialized = false;

export function initializeGoogleAnalytics() {
  if (initialized) return true;
  if (typeof window === "undefined" || configuredMeasurementId !== GA4_MEASUREMENT_ID) return false;
  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => window.dataLayer?.push(args));

  if (!document.querySelector(`script[data-tashira-ga4="${GA4_MEASUREMENT_ID}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.tashiraGa4 = GA4_MEASUREMENT_ID;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`;
    document.head.appendChild(script);
  }
  window.gtag("js", new Date());
  window.gtag("config", GA4_MEASUREMENT_ID, { send_page_view: 1 });
  return true;
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
