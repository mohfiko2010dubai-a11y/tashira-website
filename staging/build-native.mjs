import fs from "node:fs";
import { spawnSync } from "node:child_process";

const source = fs.readFileSync("staging/.env", "utf8");
const line = source.split(/\r?\n/).find((entry) => entry.startsWith("VITE_STRIPE_PUBLISHABLE_KEY="));
const publishableKey = line?.slice("VITE_STRIPE_PUBLISHABLE_KEY=".length).trim() ?? "";
if (!publishableKey.startsWith("pk_test_")) {
  throw new Error("Staging build requires a Stripe TEST publishable key");
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["run", "build"], {
  env: { ...process.env, VITE_STRIPE_PUBLISHABLE_KEY: publishableKey },
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);

const verification = spawnSync(process.execPath, ["staging/verify-native-build.mjs"], {
  stdio: "inherit",
});
if (verification.status !== 0) process.exit(verification.status ?? 1);
