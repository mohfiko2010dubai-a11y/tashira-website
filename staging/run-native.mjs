import fs from "node:fs";
import path from "node:path";

const expectedDirectory = "/var/www/tashira-staging";
if (path.resolve(process.cwd()) !== expectedDirectory) {
  throw new Error(`Refusing to start outside ${expectedDirectory}`);
}

function readSecret(name) {
  const value = fs.readFileSync(path.join(expectedDirectory, "staging", "secrets", name), "utf8").trim();
  if (!value) throw new Error(`Staging secret ${name} is empty`);
  return value;
}

function readStagingConfig() {
  const source = fs.readFileSync(path.join(expectedDirectory, "staging", ".env"), "utf8");
  return Object.fromEntries(source.split(/\r?\n/).flatMap((entry) => {
    const separator = entry.indexOf("=");
    if (separator < 1) return [];
    return [[entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]];
  }));
}

const stagingConfig = readStagingConfig();
const publishableKey = stagingConfig.VITE_STRIPE_PUBLISHABLE_KEY ?? "";
if (!publishableKey.startsWith("pk_test_")) throw new Error("Staging requires a Stripe TEST publishable key");
process.env.VITE_STRIPE_PUBLISHABLE_KEY = publishableKey;
process.env.STRIPE_MODE = "TEST";
process.env.STRIPE_SECRET_KEY = readSecret("stripe_secret_key");
process.env.STRIPE_WEBHOOK_SECRET = readSecret("stripe_webhook_secret");
process.env.STAGING_BROWSER_AUTH_DIR = "/var/lib/tashira-staging/browser-auth";
for (const name of ["STAGING_EMAIL_MODE", "STAGING_EMAIL_ALLOWED_RECIPIENTS", "STAGING_EMAIL_ALLOWED_APPLICATION_REFERENCES", "FROM_NAME", "FROM_EMAIL", "EMAIL_REPLY_TO", "TRANSACTIONAL_ADMIN_EMAIL", "PUBLIC_APP_URL"]) {
  if (stagingConfig[name]) process.env[name] = stagingConfig[name];
}
const resendSecretPath = path.join(expectedDirectory, "staging", "secrets", "resend_api_key");
if (fs.existsSync(resendSecretPath)) {
  const resendApiKey = fs.readFileSync(resendSecretPath, "utf8").trim();
  if (resendApiKey) process.env.RESEND_API_KEY = resendApiKey;
}

if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  throw new Error("Staging requires a Stripe TEST secret key");
}
if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
  throw new Error("Staging requires a Stripe webhook signing secret");
}

// Default remains disabled. Owner-authorized UAT is restricted by the provider's recipient allowlist.
const mailUatEnabled = stagingConfig.STAGING_EMAIL_UAT_ENABLED === "true";
if (mailUatEnabled && (!stagingConfig.STAGING_EMAIL_ALLOWED_RECIPIENTS?.trim() || stagingConfig.STAGING_EMAIL_MODE !== "resend")) {
  throw new Error("Staging email UAT requires Resend and an explicit recipient allowlist");
}
process.env.APP_ID = "tashira-staging";
process.env.EMAIL_MODE = mailUatEnabled ? "resend" : "disabled";
process.env.STAGING_EMAIL_MODE = process.env.EMAIL_MODE;
await import("../dist/boot.js");
