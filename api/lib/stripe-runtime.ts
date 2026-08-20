export type StripeRuntimeMode = "TEST" | "LIVE";

function hasCredentialClass(value: string, prefix: string): boolean {
  const normalized = value.toLocaleLowerCase("en-US");
  return value.startsWith(prefix)
    && value.length > prefix.length
    && !normalized.includes("placeholder")
    && !normalized.includes("replace_with")
    && !normalized.includes("example");
}

function explicitStripeMode(environment: NodeJS.ProcessEnv = process.env): StripeRuntimeMode {
  if (environment.STRIPE_MODE === "TEST" || environment.STRIPE_MODE === "LIVE") {
    return environment.STRIPE_MODE;
  }
  if (environment.DEPLOYMENT_MODE === "PRELIVE") return "TEST";
  if (environment.DEPLOYMENT_MODE === "LIVE") return "LIVE";
  throw new Error("Stripe runtime mode is not explicitly configured");
}

export function validateStripeRuntimeConfig(environment: NodeJS.ProcessEnv = process.env) {
  const mode = explicitStripeMode(environment);
  const publishableKey = environment.VITE_STRIPE_PUBLISHABLE_KEY || "";
  const secretKey = environment.STRIPE_SECRET_KEY || "";
  const webhookSecret = environment.STRIPE_WEBHOOK_SECRET || "";
  const expectedPublishablePrefix = mode === "LIVE" ? "pk_live_" : "pk_test_";
  const expectedSecretPrefix = mode === "LIVE" ? "sk_live_" : "sk_test_";

  if (!hasCredentialClass(publishableKey, expectedPublishablePrefix)
    || !hasCredentialClass(secretKey, expectedSecretPrefix)
    || !hasCredentialClass(webhookSecret, "whsec_")) {
    throw new Error(`Stripe ${mode} runtime credentials are incomplete or inconsistent`);
  }
  if (mode === "LIVE" && (publishableKey.startsWith("pk_test_") || secretKey.startsWith("sk_test_"))) {
    throw new Error("Stripe LIVE runtime rejects TEST credentials");
  }
  if (mode === "TEST" && (publishableKey.startsWith("pk_live_") || secretKey.startsWith("sk_live_"))) {
    throw new Error("Stripe TEST runtime rejects LIVE credentials");
  }

  return { mode, secretKey, webhookSecret } as const;
}

export function stripeRuntimeMode(): StripeRuntimeMode {
  return validateStripeRuntimeConfig().mode;
}

export function stripeSecretKey(): string {
  return validateStripeRuntimeConfig().secretKey;
}

export function stripeWebhookSecret(): string {
  return validateStripeRuntimeConfig().webhookSecret;
}
