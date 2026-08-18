import { spawnSync } from "node:child_process";

const expectedDirectory = "/var/www/tashira-staging";
if (process.cwd() !== expectedDirectory) {
  throw new Error(`Native staging deployment refused outside ${expectedDirectory}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, ["staging/build-native.mjs"]);
run("pm2", ["restart", "tashira-staging", "--update-env"]);

const response = await fetch("http://127.0.0.1:3002/api/health");
if (!response.ok) throw new Error(`Staging health check failed with HTTP ${response.status}`);
console.log("Native staging deployment completed and health check passed.");
