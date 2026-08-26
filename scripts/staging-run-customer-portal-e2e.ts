import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../api/router";
import { env } from "../api/lib/env";
import { createCustomerApplicationCookie } from "../api/lib/customer-session";

const reference = "TSH-STG-DYN-FAMILY";
const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_PORTAL_E2E_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_PORTAL_E2E_PATH_IDENTITY_FAILED");

function client(references: readonly string[]) {
  const base = new Headers({ host: "staging.tashiraev.com", "x-forwarded-proto": "https" });
  const cookie = references.reduce((current, item) => { const headers = new Headers(base); if (current) headers.set("cookie", current);
    return createCustomerApplicationCookie(headers, item).split(";", 1)[0]; }, "");
  return createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: "http://127.0.0.1:3002/api/trpc", transformer: superjson,
    headers: () => cookie ? ({ cookie }) : ({}) })] });
}
async function expectDenied(operation: () => Promise<unknown>): Promise<void> {
  try { await operation(); throw new Error("STAGING_PORTAL_E2E_EXPECTED_DENIAL_MISSING"); }
  catch (error) { if (!(error instanceof TRPCClientError) || !["UNAUTHORIZED", "FORBIDDEN"].includes(String(error.data?.code))) throw error; }
}

await expectDenied(() => client([]).customerOperations.portal.query({ referenceNumber: reference }));
await expectDenied(() => client([reference]).customerOperations.portal.query({ referenceNumber: "TSH-STG-DYN-INDIVIDUAL" }));
const portal = await client([reference]).customerOperations.portal.query({ referenceNumber: reference });
if (portal.applicationReference !== reference || portal.applicants.length < 2 || portal.timeline.length < 1) throw new Error("STAGING_PORTAL_E2E_PROJECTION_INCOMPLETE");
const serialized = JSON.stringify(portal).toLowerCase();
if (["supplier", "suppliercost", "internalcost", "margin", "profit", "stripe", "storagepath", "staff"].some((field) => serialized.includes(field))) {
  throw new Error("STAGING_PORTAL_E2E_INTERNAL_FIELD_LEAK");
}
console.log("STAGING_CUSTOMER_PORTAL_AUTHORIZATION=PASS");
console.log("STAGING_CUSTOMER_PORTAL_CROSS_APPLICATION_DENIAL=PASS");
console.log("STAGING_CUSTOMER_PORTAL_APPLICANT_PROJECTION=PASS");
console.log("STAGING_CUSTOMER_PORTAL_TIMELINE=PASS");
console.log("STAGING_CUSTOMER_PORTAL_FINANCE_ISOLATION=PASS");
