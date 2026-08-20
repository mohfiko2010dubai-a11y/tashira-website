import fs from "node:fs";

function readSecret(name) {
  const path = `/run/secrets/${name}`;
  const value = fs.readFileSync(path, "utf8").trim();
  if (!value) throw new Error(`Staging secret ${name} is empty`);
  return value;
}

const databaseName = process.env.STAGING_DATABASE_NAME;
const databaseUser = process.env.STAGING_DATABASE_USER;

if (databaseName !== "tashira_staging") {
  throw new Error("Refusing to start outside the tashira_staging database");
}
if (databaseUser !== "tashira_staging_app") {
  throw new Error("Refusing to start with a non-staging database user");
}

const databasePassword = encodeURIComponent(readSecret("mysql_app_password"));
process.env.DATABASE_URL = `mysql://${databaseUser}:${databasePassword}@staging-db:3306/${databaseName}`;
process.env.APP_ID = "tashira-staging";
process.env.APP_SECRET = readSecret("app_secret");
process.env.KIMI_OPEN_URL = "https://unused.example.com";
process.env.ADMIN_PASSWORD = readSecret("admin_password");
process.env.ADMIN_SESSION_SECRET = readSecret("admin_session_secret");
process.env.CUSTOMER_SESSION_SECRET = readSecret("customer_session_secret");
process.env.STORAGE_URL_SECRET = readSecret("storage_url_secret");
process.env.STRIPE_MODE = "TEST";
process.env.STRIPE_SECRET_KEY = readSecret("stripe_secret_key");
process.env.STRIPE_WEBHOOK_SECRET = readSecret("stripe_webhook_secret");
process.env.VITE_KIMI_API_KEY = readSecret("kimi_api_key");

if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  throw new Error("Staging requires a Stripe TEST secret key");
}
if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
  throw new Error("Staging requires a Stripe webhook signing secret");
}

await import("../dist/boot.js");
