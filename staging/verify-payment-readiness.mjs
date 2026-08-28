const baseUrl = process.env.STAGING_BASE_URL ?? "http://127.0.0.1:3002";
let cookie = "";
let syntheticClient = 10;
async function call(path, input, query = false) {
  const url = query ? `${baseUrl}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `${baseUrl}/api/trpc/${path}`;
  const response = await fetch(url, { method: query ? "GET" : "POST", headers: { "x-forwarded-for": `192.0.2.${syntheticClient}`, ...(cookie ? { cookie } : {}), ...(query ? {} : { "content-type": "application/json" }) }, body: query ? undefined : JSON.stringify({ json: input }) });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const payload = await response.json();
  return { ok: response.ok, status: response.status, data: payload.result?.data?.json, payload };
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function businessCode(result) {
  const message = result.payload?.error?.json?.message;
  if (typeof message !== "string") return null;
  try { return JSON.parse(message).code ?? null; } catch { return null; }
}
async function create(applicantCount) {
  const referenceNumber = `TSH-READY-${Date.now()}-${applicantCount}`;
  const applicants = Array.from({ length: applicantCount }, (_, index) => ({ fullName: `Synthetic Ready ${index + 1}`, nationality: "Testland", passportNumber: `READY${Date.now()}${index}`, passportType: "ordinary", travelingFrom: "Testland", passportExpiry: "2030-01-01", profession: "Tester" }));
  const result = await call("application.create", { referenceNumber, baseType: applicantCount > 1 ? "family" : "single", residenceType: "non-gcc", visaType: "14days-single", processingType: "regular", contactEmail: "readiness-uat@example.test", contactPhone: "+971500000000", arrivalDate: "2027-01-01", policyVersion: "legal-bundle-2026-08-19-v2", applicants });
  assert(result.ok, `Application creation failed: ${JSON.stringify(result.payload)}`);
  return { ...result.data, applicants };
}
async function upload(applicationId, applicantId, documentType, suffix) {
  const contents = Buffer.from(`synthetic-${documentType}-${suffix}`);
  const fileName = `${documentType}-${suffix}.${documentType === "photo" ? "jpg" : "pdf"}`;
  const mimeType = documentType === "photo" ? "image/jpeg" : "application/pdf";
  const stored = await call("storage.upload", { applicationId, applicantId, documentType, fileName, mimeType, fileSize: contents.length, base64Data: contents.toString("base64"), uploadedBy: "readiness-uat@example.test" });
  assert(stored.ok, `Storage upload failed: ${JSON.stringify(stored.payload)}`);
  const created = await call("document.create", { applicationId, applicantId, documentType, originalFileName: fileName, storedFileName: stored.data.storedFileName, mimeType, fileSize: contents.length, storagePath: stored.data.storagePath, uploadStatus: "uploaded", uploadedBy: "readiness-uat@example.test" });
  assert(created.ok, `Document record failed: ${JSON.stringify(created.payload)}`);
}
async function intent(referenceNumber) { return call("payment.createIntent", {
  referenceNumber,
  payerName: "Synthetic Ready 1",
  payerRelationship: "Self",
  payerAuthorizationAccepted: true,
  payerAuthorizationVersion: "payer-authorization-2026-08-19-v1",
}); }

const single = await create(1);
const missingAll = await intent(single.referenceNumber);
assert(!missingAll.ok && businessCode(missingAll) === "APPLICATION_INCOMPLETE",
  `Incomplete direct payment API call was not rejected safely (${missingAll.status}/${missingAll.payload?.error?.json?.data?.code ?? "UNKNOWN"}/${businessCode(missingAll) ?? "NO_BUSINESS_CODE"})`);
await upload(single.id, single.applicantIds[0], "passport", "copy");
await upload(single.id, single.applicantIds[0], "photo", "face");
const partial = await intent(single.referenceNumber);
assert(!partial.ok && JSON.stringify(partial.payload).includes("document.passport"), "Partial documents did not remain blocked");
await upload(single.id, single.applicantIds[0], "passport", "cover");
const complete = await intent(single.referenceNumber);
assert(complete.ok && complete.data.clientSecret, "Complete application did not permit payment");

cookie = "";
syntheticClient++;
const family = await create(2);
for (const suffix of ["copy", "cover"]) await upload(family.id, family.applicantIds[0], "passport", suffix);
await upload(family.id, family.applicantIds[0], "photo", "face");
const familyBlocked = await intent(family.referenceNumber);
assert(!familyBlocked.ok && JSON.stringify(familyBlocked.payload).includes("Applicant 2"), "Incomplete family member did not block aggregate payment");
assert(!JSON.stringify(familyBlocked.payload).includes(single.applicants[0].passportNumber), "Missing response leaked another application applicant data");

console.log(JSON.stringify({ single: single.referenceNumber, incompleteBlocked: missingAll.status, partialBlocked: partial.status, completeAllowed: true, family: family.referenceNumber, familyBlocked: familyBlocked.status, ownershipLeak: false }));
