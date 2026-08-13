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

function readPublishableKey() {
  const source = fs.readFileSync(path.join(expectedDirectory, "staging", ".env"), "utf8");
  const line = source.split(/\r?\n/).find((entry) => entry.startsWith("VITE_STRIPE_PUBLISHABLE_KEY="));
  const value = line?.slice("VITE_STRIPE_PUBLISHABLE_KEY=".length).trim() ?? "";
  if (!value.startsWith("pk_test_")) throw new Error("Staging requires a Stripe TEST publishable key");
  return value;
}

process.env.VITE_STRIPE_PUBLISHABLE_KEY = readPublishableKey();
process.env.STRIPE_SECRET_KEY = readSecret("stripe_secret_key");
process.env.STRIPE_WEBHOOK_SECRET = readSecret("stripe_webhook_secret");
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

await import("../dist/boot.js");
