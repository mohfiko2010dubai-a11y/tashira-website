const baseUrl = process.env.STAGING_BASE_URL ?? "http://127.0.0.1:3002";
let customerCookie = "";

async function mutation(path, input) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(customerCookie ? { cookie: customerCookie } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) customerCookie = setCookie.split(";", 1)[0];
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(payload)}`);
  return payload.result.data.json;
}

async function query(path, input) {
  const encodedInput = encodeURIComponent(JSON.stringify({ json: input }));
  const response = await fetch(`${baseUrl}/api/trpc/${path}?input=${encodedInput}`, {
    headers: customerCookie ? { cookie: customerCookie } : {},
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${JSON.stringify(payload)}`);
  return payload.result.data.json;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const referenceNumber = `TSH-UAT-${Date.now()}`;
const applicants = [0, 1].map((applicantIndex) => ({
  applicantIndex,
  fullName: `Synthetic Applicant ${applicantIndex + 1}`,
  nationality: "Synthetic",
  passportNumber: `UAT0000${applicantIndex + 1}`,
  passportExpiry: "2030-01-01",
  profession: "Tester",
  countryFrom: "Testland",
}));

const quote = await mutation("wizard.quoteApplication", {
  visaType: "14days-single",
  processingType: "Regular",
  applicantCount: 2,
});
assert(quote.applicantCount === 2 && quote.totalPrice === quote.unitPrice * 2, "Aggregate quote is not server-authoritative");

const started = await mutation("wizard.startApplication", {
  referenceNumber,
  whoTraveling: "Family",
  applicantCount: 2,
  residenceStatus: "Non-GCC Resident",
  visaType: "14days-single",
  processingType: "Regular",
  fullName: applicants[0].fullName,
  totalAmount: 1,
});
assert(started.applicationId > 0 && started.applicantId > 0, "Primary applicant did not return trusted ids");

const primary = await mutation("wizard.updateApplication", {
  referenceNumber,
  applicantIndex: 0,
  ...applicants[0],
  arrivalDate: "2027-01-01",
  email: "family-uat@example.test",
  phone: "+971500000000",
});
const secondary = await mutation("wizard.updateApplication", {
  referenceNumber,
  ...applicants[1],
});
const secondaryRepeat = await mutation("wizard.updateApplication", {
  referenceNumber,
  applicantIndex: 1,
  fullName: applicants[1].fullName,
});
assert(primary.applicantId === started.applicantId, "Primary applicant id changed");
assert(secondary.applicantId === secondaryRepeat.applicantId, "Applicant slot did not return a stable id");
assert(primary.applicantId !== secondary.applicantId, "Family applicants share one id");

const encodedFile = Buffer.from("synthetic-family-uat-document").toString("base64");
let crossApplicantRejected = false;
try {
  await mutation("wizard.uploadDocuments", {
    applicationId: started.applicationId,
    applicantId: secondary.applicantId,
    applicantIndex: 0,
    documentType: "passport",
    fileName: "must-be-rejected.pdf",
    mimeType: "application/pdf",
    fileSize: Buffer.byteLength("synthetic-family-uat-document"),
    base64Data: encodedFile,
  });
} catch (error) {
  crossApplicantRejected = String(error).includes("selected application slot");
}
assert(crossApplicantRejected, "Cross-applicant document upload was not rejected");

for (const applicant of [primary, secondary]) {
  for (const [documentType, fileName] of [
    ["passport", "passport-copy.pdf"],
    ["passport", "passport-cover.pdf"],
    ["photo", "passport-photo.jpg"],
  ]) {
    await mutation("wizard.uploadDocuments", {
      applicationId: started.applicationId,
      applicantId: applicant.applicantId,
      applicantIndex: applicant.applicantIndex,
      documentType,
      fileName,
      mimeType: documentType === "photo" ? "image/jpeg" : "application/pdf",
      fileSize: Buffer.byteLength("synthetic-family-uat-document"),
      base64Data: encodedFile,
    });
  }
}

const progress = await query("wizard.getProgress", { referenceNumber });
assert(progress.applicants.length === 2, "Resume payload does not contain both applicants");
assert(progress.documents.length === 6, "Resume payload does not contain six applicant documents");
assert(progress.documents.every((document) => document.applicantId === primary.applicantId || document.applicantId === secondary.applicantId), "Resume payload contains an unowned document");

const submitted = await mutation("wizard.submitApplication", {
  referenceNumber,
  ...applicants[0],
  arrivalDate: "2027-01-01",
  email: "family-uat@example.test",
  phone: "+971500000000",
  visaType: "14days-single",
  processingType: "Regular",
  residenceStatus: "Non-GCC Resident",
  whoTraveling: "Family",
  applicantCount: 2,
  totalAmount: 1,
  policyVersion: "terms-2026-08-11",
  applicants,
});
assert(submitted.quote.totalPrice === quote.totalPrice, "Submit did not preserve the server-authoritative aggregate quote");

console.log(JSON.stringify({
  referenceNumber,
  applicationId: started.applicationId,
  applicantIds: [primary.applicantId, secondary.applicantId],
  documentCount: progress.documents.length,
  crossApplicantRejected,
  totalPrice: submitted.quote.totalPrice,
  currency: submitted.quote.currency,
}));
