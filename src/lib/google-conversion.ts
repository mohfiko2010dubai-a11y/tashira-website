import { verifiedPaymentConversionParameters } from "./google-conversion-decision";

type GoogleEventParameters = Record<string, string | number>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: "config" | "event" | "js", target: string | Date, params?: GoogleEventParameters) => void;
  }
}

const googleTagId = import.meta.env.VITE_GOOGLE_TAG_ID?.trim() || "";
const adsConversionId = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID?.trim() || "";
const adsPurchaseLabel = import.meta.env.VITE_GOOGLE_ADS_PURCHASE_LABEL?.trim() || "";
let initialized = false;

function isSupportedGoogleTagId(value: string) {
  return /^(G|AW)-[A-Z0-9]+$/.test(value);
}

function initializeGoogleTag() {
  if (initialized || typeof window === "undefined" || !isSupportedGoogleTagId(googleTagId)) return false;
  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => window.dataLayer?.push(args));

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`;
  document.head.appendChild(script);
  window.gtag("js", new Date());
  window.gtag("config", googleTagId, { send_page_view: 1 });
  return true;
}

export function trackGoogleEvent(eventName: string, parameters: GoogleEventParameters = {}) {
  if (!initializeGoogleTag() || !window.gtag) return false;
  window.gtag("event", eventName, parameters);
  return true;
}

export function trackVerifiedPaymentConversion(input: { transactionId: string; value: number; currency: string }) {
  const parameters = verifiedPaymentConversionParameters({ conversionId: adsConversionId, purchaseLabel: adsPurchaseLabel }, input);
  if (!parameters) return false;
  const storageKey = `tashira_google_purchase_${input.transactionId}`;
  if (sessionStorage.getItem(storageKey) === "sent") return false;
  const sent = trackGoogleEvent("purchase", parameters);
  if (sent) sessionStorage.setItem(storageKey, "sent");
  return sent;
}
