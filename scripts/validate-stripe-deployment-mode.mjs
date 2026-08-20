export function validateStripeDeploymentMode(input) {
  const mode = input.deploymentMode;
  const publishableKey = input.publishableKey || "";
  const secretKey = input.secretKey || "";
  const webhookSecret = input.webhookSecret || "";

  if (mode !== "PRELIVE" && mode !== "LIVE") {
    throw new Error("deployment_mode must be explicitly PRELIVE or LIVE");
  }

  if (mode === "PRELIVE") {
    if (!publishableKey.startsWith("pk_test_") || !secretKey.startsWith("sk_test_")) {
      throw new Error("PRELIVE requires matching Stripe TEST credentials");
    }
    if (publishableKey.startsWith("pk_live_") || secretKey.startsWith("sk_live_")) {
      throw new Error("PRELIVE rejects Stripe LIVE credentials");
    }
    return "PRELIVE";
  }

  if (!publishableKey.startsWith("pk_live_") || !secretKey.startsWith("sk_live_") || !webhookSecret.startsWith("whsec_")) {
    throw new Error("LIVE requires complete Stripe LIVE credentials");
  }
  if (publishableKey.startsWith("pk_test_") || secretKey.startsWith("sk_test_")) {
    throw new Error("LIVE rejects Stripe TEST credentials");
  }
  return "LIVE";
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("validate-stripe-deployment-mode.mjs")) {
  try {
    validateStripeDeploymentMode({
      deploymentMode: process.env.DEPLOYMENT_MODE,
      publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY,
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Stripe deployment mode validation failed");
    process.exit(1);
  }
}
