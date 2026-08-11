const baseUrl = process.env.STAGING_BASE_URL ?? "http://127.0.0.1:3002";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function trpc(path, input, { cookie = "", staffToken = "", mutation = false } = {}) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  const response = await fetch(
    `${baseUrl}/api/trpc/${path}${mutation ? "" : `?input=${encoded}`}`,
    {
      method: mutation ? "POST" : "GET",
      headers: {
        ...(mutation ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(staffToken ? { "x-staff-token": staffToken } : {}),
      },
      ...(mutation ? { body: JSON.stringify({ json: input }) } : {}),
    },
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(payload)}`);
  return {
    data: payload.result.data.json,
    cookie: response.headers.get("set-cookie")?.split(";", 1)[0] ?? cookie,
  };
}

assert(process.env.ADMIN_PASSWORD, "ADMIN_PASSWORD is required for authentication UAT");

const anonymousAdmin = await trpc("auth.adminMe", undefined);
assert(anonymousAdmin.data.authenticated === false, "Anonymous request was treated as admin");

const adminLogin = await trpc("auth.adminLogin", { password: process.env.ADMIN_PASSWORD }, { mutation: true });
assert(adminLogin.cookie, "Admin login did not issue a session cookie");
const adminCookie = adminLogin.cookie;
const authenticatedAdmin = await trpc("auth.adminMe", undefined, { cookie: adminCookie });
assert(authenticatedAdmin.data.authenticated === true, "Admin session was not recognized");

const suffix = Date.now();
const username = `staging_uat_${suffix}`;
const password = `Synthetic-${suffix}-Only`;
let staffId;

try {
  const created = await trpc("staff.create", {
    username,
    password,
    name: "Synthetic Staging Staff",
    email: `${username}@example.test`,
  }, { cookie: adminCookie, mutation: true });
  staffId = created.data.id;
  assert(staffId > 0, "Synthetic staff user was not created");

  const login = await trpc("staff.login", { username, password }, { mutation: true });
  const staffToken = login.data.token;
  assert(staffToken && login.data.staff.id === staffId, "Staff login did not return a valid session");

  const verified = await trpc("staff.verify", { token: staffToken });
  assert(verified.data?.id === staffId, "Staff session verification failed");

  const protectedList = await trpc("application.list", {}, { staffToken });
  assert(Array.isArray(protectedList.data), "Staff session could not access a staff-protected API");

  await trpc("staff.logout", { token: staffToken }, { mutation: true });
  const afterLogout = await trpc("staff.verify", { token: staffToken });
  assert(afterLogout.data === null, "Staff token remained valid after logout");
} finally {
  if (staffId) {
    await trpc("staff.delete", { id: staffId }, { cookie: adminCookie, mutation: true });
  }
}

const adminLogout = await trpc("auth.adminLogout", undefined, { cookie: adminCookie, mutation: true });
const loggedOutAdmin = await trpc("auth.adminMe", undefined, { cookie: adminLogout.cookie });
assert(loggedOutAdmin.data.authenticated === false, "Admin session remained valid after logout");

console.log(JSON.stringify({
  anonymousAdminRejected: true,
  adminSessionVerified: true,
  staffLoginVerified: true,
  staffProtectedApiVerified: true,
  staffLogoutVerified: true,
  syntheticStaffRemoved: true,
  adminLogoutVerified: true,
}));
