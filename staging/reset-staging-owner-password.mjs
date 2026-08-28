import fs from "node:fs";
import path from "node:path";

const expectedDirectory = "/var/www/tashira-staging";
const username = "staging-owner";

if (path.resolve(process.cwd()) !== expectedDirectory) {
  throw new Error(`Refusing to run outside ${expectedDirectory}`);
}

const password = fs.readFileSync(0, "utf8").replace(/[\r\n]+$/, "");
if (password.length < 16) throw new Error("Password must contain at least 16 characters");
if (/\s/.test(password)) throw new Error("Password must not contain whitespace");

const adminPassword = fs.readFileSync(
  path.join(expectedDirectory, "staging", "secrets", "admin_password"),
  "utf8",
).trim();
if (!adminPassword) throw new Error("Staging admin secret is unavailable");

let cookie = "";
async function mutation(procedure, input) {
  const response = await fetch(`http://127.0.0.1:3002/api/trpc/${procedure}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  cookie = response.headers.get("set-cookie")?.split(";", 1)[0] ?? cookie;
  const payload = await response.json();
  if (!response.ok) throw new Error(`${procedure} failed safely (${response.status})`);
  return payload.result.data.json;
}

async function query(procedure) {
  const input = encodeURIComponent(JSON.stringify({ json: null }));
  const response = await fetch(`http://127.0.0.1:3002/api/trpc/${procedure}?input=${input}`, {
    headers: cookie ? { cookie } : {},
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${procedure} failed safely (${response.status})`);
  return payload.result.data.json;
}

await mutation("auth.adminLogin", { password: adminPassword });
const staff = await query("staff.list");
const owner = staff.find((entry) => entry.username === username);
if (!owner || owner.isActive !== "active") throw new Error("Active staging owner account was not found");

await mutation("staff.update", { id: owner.id, password });
console.log("STAGING_OWNER_PASSWORD_UPDATED");

