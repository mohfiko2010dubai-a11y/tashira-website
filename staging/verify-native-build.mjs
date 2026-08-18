import fs from "node:fs";

const expectedDirectory = "/var/www/tashira-staging";
if (process.cwd() !== expectedDirectory) {
  throw new Error(`Staging build verification refused outside ${expectedDirectory}`);
}

const source = fs.readFileSync("staging/.env", "utf8");
const line = source.split(/\r?\n/).find((entry) => entry.startsWith("VITE_STRIPE_PUBLISHABLE_KEY="));
const publishableKey = line?.slice("VITE_STRIPE_PUBLISHABLE_KEY=".length).trim() ?? "";
if (!publishableKey.startsWith("pk_test_")) {
  throw new Error("Staging build verification requires a Stripe TEST publishable key");
}

const html = fs.readFileSync("dist/public/index.html", "utf8");
const mainAsset = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/g)?.at(-1);
if (!mainAsset) throw new Error("Staging build verification could not find the current client entry");

const mainSource = fs.readFileSync(`dist/public/${mainAsset}`, "utf8");
const paymentAsset = mainSource.match(/PaymentPage-[A-Za-z0-9_-]+\.js/g)?.at(-1);
if (!paymentAsset) throw new Error("Staging build verification could not find the current payment chunk");

const paymentSource = fs.readFileSync(`dist/public/assets/${paymentAsset}`, "utf8");
if (!paymentSource.includes(publishableKey)) {
  throw new Error("Current staging payment chunk does not contain the configured Stripe TEST publishable key");
}

console.log("Staging client configuration verified.");
