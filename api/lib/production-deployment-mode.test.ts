import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const validator = fileURLToPath(new URL("../../scripts/validate-stripe-deployment-mode.mjs", import.meta.url));

function validate(deploymentMode: string, publishableKey: string, secretKey: string, webhookSecret: string) {
  return execFileSync(process.execPath, [validator], {
    env: {
      ...process.env,
      DEPLOYMENT_MODE: deploymentMode,
      VITE_STRIPE_PUBLISHABLE_KEY: publishableKey,
      STRIPE_SECRET_KEY: secretKey,
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    },
    stdio: "pipe",
  });
}

describe("manual Production Stripe deployment mode", () => {
  it.each([
    ["PRELIVE", "pk_test_review", "sk_test_review", "whsec_review"],
    ["LIVE", "pk_live_review", "sk_live_review", "whsec_review"],
  ])("allows an explicitly matching %s configuration", (deploymentMode, publishableKey, secretKey, webhookSecret) => {
    expect(() => validate(deploymentMode, publishableKey, secretKey, webhookSecret)).not.toThrow();
  });

  it.each([
    ["PRELIVE", "pk_live_review", "sk_live_review", ""],
    ["PRELIVE", "pk_test_review", "sk_test_review", ""],
    ["LIVE", "pk_test_review", "sk_test_review", "whsec_review"],
    ["INVALID", "pk_test_review", "sk_test_review", ""],
    ["", "pk_test_review", "sk_test_review", ""],
  ])("rejects mismatched or invalid mode %s", (deploymentMode, publishableKey, secretKey, webhookSecret) => {
    expect(() => validate(deploymentMode, publishableKey, secretKey, webhookSecret)).toThrow();
  });
});
