import mysql from "mysql2/promise";

const expectedDirectory = "/var/www/tashira-staging";
if (process.cwd() !== expectedDirectory) {
  throw new Error(`14-day multiple-entry verification refused outside ${expectedDirectory}`);
}

const baseUrl = process.env.STAGING_BASE_URL ?? "http://127.0.0.1:3002";
const databaseUrl = new URL(process.env.DATABASE_URL);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") {
  throw new Error("14-day multiple-entry verification requires tashira_staging");
}

let cookie = "";
async function call(path, input) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "192.0.2.214",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} failed safely (${response.status}): ${payload.error?.json?.message ?? "unknown"}`);
  return payload.result?.data?.json;
}

async function upload(applicationId, applicantId, documentType, suffix) {
  const contents = Buffer.from(`synthetic-14day-multiple-${documentType}-${suffix}`);
  const isPhoto = documentType === "photo";
  const fileName = `${documentType}-${suffix}.${isPhoto ? "jpg" : "pdf"}`;
  const mimeType = isPhoto ? "image/jpeg" : "application/pdf";
  const stored = await call("storage.upload", {
    applicationId,
    applicantId,
    documentType,
    fileName,
    mimeType,
    fileSize: contents.length,
    base64Data: contents.toString("base64"),
    uploadedBy: "14day-multiple-uat@example.invalid",
  });
  await call("document.create", {
    applicationId,
    applicantId,
    documentType,
    originalFileName: fileName,
    storedFileName: stored.storedFileName,
    mimeType,
    fileSize: contents.length,
    storagePath: stored.storagePath,
    uploadStatus: "uploaded",
    uploadedBy: "14day-multiple-uat@example.invalid",
  });
}

const referenceNumber = `TSH-14M-${Date.now()}`;
const created = await call("application.create", {
  referenceNumber,
  baseType: "single",
  residenceType: "non-gcc",
  visaType: "14days-multiple",
  processingType: "regular",
  contactEmail: "14day-multiple-uat@example.invalid",
  contactPhone: "+971500000214",
  arrivalDate: "2027-01-14",
  policyVersion: "legal-bundle-2026-08-19-v2",
  applicants: [{
    fullName: "Synthetic Multiple Entry Applicant",
    nationality: "Testland",
    passportNumber: `M14${Date.now()}`,
    passportType: "ordinary",
    travelingFrom: "Testland",
    passportExpiry: "2031-01-14",
    profession: "Synthetic Tester",
  }],
});

const applicantId = created.applicantIds[0];
await upload(created.id, applicantId, "passport", "copy");
await upload(created.id, applicantId, "photo", "face");
await upload(created.id, applicantId, "passport", "cover");
const intent = await call("payment.createIntent", {
  referenceNumber,
  payerName: "Synthetic Multiple Entry Applicant",
  payerRelationship: "Self",
  payerAuthorizationAccepted: true,
  payerAuthorizationVersion: "payer-authorization-2026-08-19-v1",
});
if (!intent.clientSecret) throw new Error("Stripe TEST PaymentIntent client secret was not created");

const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await db.execute(
    `SELECT a.visa_type, a.processing_type, a.stripe_amount_usd,
            s.pricing_version, s.applicant_count, s.unit_price, s.total_price,
            s.snapshot_currency, p.amount payment_amount, p.currency payment_currency,
            p.status payment_status
       FROM applications a
       JOIN application_price_snapshots s ON s.application_id = a.id
       JOIN payments p ON p.application_id = a.id
      WHERE a.id = ?`,
    [created.id],
  );
  const row = rows[0];
  const valid = row
    && row.visa_type === "14days-multiple"
    && row.processing_type === "regular"
    && Number(row.unit_price) === 265
    && Number(row.total_price) === 265
    && Number(row.stripe_amount_usd) === 265
    && Number(row.payment_amount) === 265
    && row.snapshot_currency === "USD"
    && row.payment_currency.toLowerCase() === "usd"
    && row.payment_status === "pending";
  if (!valid) throw new Error("14-day multiple-entry quote/snapshot/PaymentIntent amount mismatch");
  console.log(JSON.stringify({
    referenceNumber,
    visaType: row.visa_type,
    processingType: row.processing_type,
    pricingVersion: Number(row.pricing_version),
    applicantCount: Number(row.applicant_count),
    snapshotAmountUsd: Number(row.total_price),
    paymentIntentAmountUsd: Number(row.payment_amount),
    paymentStatus: row.payment_status,
    stripeMode: "TEST",
  }));
} finally {
  await db.end();
}
