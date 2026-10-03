export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;

export const TERMS_POLICY_VERSION = "legal-bundle-2026-10-04-v4" as const;
export const TERMS_POLICY_EFFECTIVE_DATE = "2026-10-04" as const;
export const ACCEPTED_POLICY_TYPES = ["TERMS", "PRIVACY", "REFUND_CANCELLATION"] as const;
