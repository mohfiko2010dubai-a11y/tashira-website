import { afterEach, describe, expect, it } from "vitest";
import { validateStripeRuntimeConfig } from "./stripe-runtime";

const testConfig = {
  STRIPE_MODE: "TEST",
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_review_fixture",
  STRIPE_SECRET_KEY: "sk_test_review_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_review_fixture",
} satisfies NodeJS.ProcessEnv;

const liveConfig = {
  STRIPE_MODE: "LIVE",
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_live_review_fixture",
  STRIPE_SECRET_KEY: "sk_live_review_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_review_fixture",
} satisfies NodeJS.ProcessEnv;

afterEach(() => {
  delete process.env.STRIPE_MODE;
  delete process.env.DEPLOYMENT_MODE;
});

describe("Stripe runtime configuration", () => {
  it("accepts internally consistent TEST and LIVE configurations", () => {
    expect(validateStripeRuntimeConfig(testConfig).mode).toBe("TEST");
    expect(validateStripeRuntimeConfig(liveConfig).mode).toBe("LIVE");
  });

  it("maps the protected deployment modes to their runtime modes", () => {
    expect(validateStripeRuntimeConfig({ ...testConfig, STRIPE_MODE: undefined, DEPLOYMENT_MODE: "PRELIVE" }).mode).toBe("TEST");
    expect(validateStripeRuntimeConfig({ ...liveConfig, STRIPE_MODE: undefined, DEPLOYMENT_MODE: "LIVE" }).mode).toBe("LIVE");
  });

  it.each([
    [{ ...testConfig, STRIPE_SECRET_KEY: liveConfig.STRIPE_SECRET_KEY }],
    [{ ...liveConfig, STRIPE_SECRET_KEY: testConfig.STRIPE_SECRET_KEY }],
    [{ ...testConfig, VITE_STRIPE_PUBLISHABLE_KEY: liveConfig.VITE_STRIPE_PUBLISHABLE_KEY }],
    [{ ...liveConfig, VITE_STRIPE_PUBLISHABLE_KEY: testConfig.VITE_STRIPE_PUBLISHABLE_KEY }],
    [{ ...liveConfig, STRIPE_WEBHOOK_SECRET: "" }],
  ])("rejects mixed or incomplete runtime credentials", (environment) => {
    expect(() => validateStripeRuntimeConfig(environment)).toThrow("incomplete or inconsistent");
  });

  it("requires an explicit runtime/deployment mode", () => {
    expect(() => validateStripeRuntimeConfig({
      VITE_STRIPE_PUBLISHABLE_KEY: testConfig.VITE_STRIPE_PUBLISHABLE_KEY,
      STRIPE_SECRET_KEY: testConfig.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: testConfig.STRIPE_WEBHOOK_SECRET,
    })).toThrow("not explicitly configured");
  });
});
