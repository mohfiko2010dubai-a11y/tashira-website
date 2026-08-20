const baseUrl = process.env.STAGING_BASE_URL ?? "http://127.0.0.1:3002";
const action = process.env.STAGING_UAT_ACTION;
const username = process.env.STAGING_UAT_STAFF_USERNAME ?? "";
const password = process.env.STAGING_UAT_STAFF_PASSWORD ?? "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(process.env.ADMIN_PASSWORD, "ADMIN_PASSWORD is required");
assert(action === "create" || action === "delete", "STAGING_UAT_ACTION must be create or delete");
assert(/^staging_browser_uat_[0-9]+$/.test(username), "Synthetic username is outside the staging UAT namespace");
if (action === "create") assert(password.length >= 16, "Synthetic password must be at least 16 characters");

let adminCookie = "";

async function mutation(path, input) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(adminCookie ? { cookie: adminCookie } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  adminCookie = response.headers.get("set-cookie")?.split(";", 1)[0] ?? adminCookie;
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(payload)}`);
  return payload.result.data.json;
}

async function query(path, input) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  const response = await fetch(`${baseUrl}/api/trpc/${path}?input=${encoded}`, {
    headers: adminCookie ? { cookie: adminCookie } : {},
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(payload)}`);
  return payload.result.data.json;
}

await mutation("auth.adminLogin", { password: process.env.ADMIN_PASSWORD });
const staff = await query("staff.list", undefined);
const existing = staff.find((entry) => entry.username === username);

if (action === "create") {
  assert(!existing, "Synthetic browser staff already exists");
  const created = await mutation("staff.create", {
    username,
    password,
    name: "Synthetic Browser UAT Staff",
    email: `${username}@example.test`,
  });
  console.log(JSON.stringify({ action, staffId: created.id }));
} else {
  if (existing) await mutation("staff.delete", { id: existing.id });
  console.log(JSON.stringify({ action, removed: Boolean(existing) }));
}
