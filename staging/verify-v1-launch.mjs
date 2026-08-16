import crypto from "node:crypto";
import fs from "node:fs";
import mysql from "mysql2/promise";

const root = "/var/www/tashira-staging";
if (process.cwd() !== root) throw new Error("V1 verification refused outside isolated staging");

function readEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf("=");
    return separator > 0 ? [[line.slice(0, separator), line.slice(separator + 1)]] : [];
  }));
}

const runtime = readEnv(".env");
const staging = readEnv("staging/.env");
const recipients = (staging.STAGING_EMAIL_ALLOWED_RECIPIENTS || "").split(",").map((value) => value.trim()).filter(Boolean);
if (recipients.length !== 1 || staging.STAGING_EMAIL_MODE !== "resend") throw new Error("Exactly one approved staging email recipient is required");
const recipient = recipients[0];
const stripeKey = fs.readFileSync("staging/secrets/stripe_secret_key", "utf8").trim();
const webhookSecret = fs.readFileSync("staging/secrets/stripe_webhook_secret", "utf8").trim();
if (!stripeKey.startsWith("sk_test_") || !webhookSecret.startsWith("whsec_")) throw new Error("Stripe TEST credentials are required");

if (process.argv.includes("--report-resend")) {
  const resendKey = fs.readFileSync("staging/secrets/resend_api_key", "utf8").trim();
  const response = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${resendKey}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error("Resend domain status request failed");
  const domains = (payload.data || []).filter((domain) => domain.name === "tashiraev.com")
    .map((domain) => ({ name: domain.name, status: domain.status, region: domain.region }));
  console.log(JSON.stringify({ domains }));
  process.exit(0);
}

const baseUrl = "http://127.0.0.1:3002";
const cookies = new Map();
function rememberCookies(response) {
  const headers = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  for (const header of headers) {
    const pair = header.split(";", 1)[0];
    const separator = pair.indexOf("=");
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}
function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}
async function trpc(path, input, query = false) {
  const url = query
    ? `${baseUrl}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `${baseUrl}/api/trpc/${path}`;
  const response = await fetch(url, {
    method: query ? "GET" : "POST",
    headers: { "x-forwarded-for": "192.0.2.210", ...(cookieHeader() ? { cookie: cookieHeader() } : {}), ...(query ? {} : { "content-type": "application/json" }) },
    body: query ? undefined : JSON.stringify({ json: input }),
  });
  rememberCookies(response);
  const payload = await response.json();
  return { ok: response.ok, status: response.status, data: payload.result?.data?.json, payload };
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function stripeConfirm(paymentIntentId) {
  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ payment_method: "pm_card_visa" }),
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== "succeeded") throw new Error("Stripe TEST payment confirmation failed");
  return payload;
}
async function signedWebhook(intent, eventId) {
  const body = JSON.stringify({ id: eventId, object: "event", type: "payment_intent.succeeded", data: { object: intent } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch("https://staging.tashiraev.com/api/stripe/webhook", {
    method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${timestamp},v1=${signature}` }, body,
  });
  return { status: response.status, payload: await response.json() };
}

const db = await mysql.createConnection(runtime.DATABASE_URL);
if (process.argv.includes("--report-latest")) {
  const [rows] = await db.query("SELECT reference_number,payment_status,status,(SELECT COUNT(*) FROM documents WHERE application_id=applications.id) document_count FROM applications WHERE reference_number LIKE 'TSH-V1-%' AND reference_number NOT LIKE 'TSH-V1-UNPAID-%' ORDER BY id DESC LIMIT 1");
  console.log(JSON.stringify(rows[0] || null));
  await db.end();
  process.exit(0);
}
try {
  const [identity] = await db.query("SELECT DATABASE() database_name, SUBSTRING_INDEX(CURRENT_USER(), '@', 1) database_user");
  assert(identity[0].database_name === "tashira_staging" && identity[0].database_user === "tashira_staging_app", "Staging database identity mismatch");

  const referenceNumber = `TSH-V1-${Date.now()}`;
  const applicant = {
    fullName: "Synthetic V1 Applicant", nationality: "Testland", passportNumber: `V1${Date.now()}`,
    passportType: "ordinary", travelingFrom: "Testland", passportExpiry: "2030-01-01", profession: "Tester",
  };
  const created = await trpc("application.create", {
    referenceNumber, baseType: "single", residenceType: "non-gcc", visaType: "14days-single",
    processingType: "regular", contactEmail: recipient, contactPhone: "+971500000000",
    arrivalDate: "2027-01-01", policyVersion: "terms-2026-08-11", applicants: [applicant],
  });
  assert(created.ok, "Synthetic V1 application creation failed");

  const documentIds = [];
  for (const [documentType, suffix, mimeType] of [["passport", "copy", "application/pdf"], ["passport", "cover", "application/pdf"], ["photo", "personal", "image/jpeg"]]) {
    const contents = Buffer.from(`synthetic-v1-${suffix}`);
    const fileName = `${suffix}.${mimeType === "image/jpeg" ? "jpg" : "pdf"}`;
    const stored = await trpc("storage.upload", {
      applicationId: created.data.id, applicantId: created.data.applicantIds[0], documentType, fileName, mimeType,
      fileSize: contents.length, base64Data: contents.toString("base64"), uploadedBy: "staging-v1-uat",
    });
    assert(stored.ok, `Synthetic ${suffix} storage upload failed`);
    const document = await trpc("document.create", {
      applicationId: created.data.id, applicantId: created.data.applicantIds[0], documentType,
      originalFileName: fileName, storedFileName: stored.data.storedFileName, mimeType, fileSize: contents.length,
      storagePath: stored.data.storagePath, uploadStatus: "uploaded", uploadedBy: "staging-v1-uat",
    });
    assert(document.ok, `Synthetic ${suffix} metadata creation failed`);
    documentIds.push(document.data.id);
  }

  const readiness = await trpc("payment.readiness", { referenceNumber }, true);
  assert(readiness.ok && readiness.data.status === "READY", "Complete application did not reach READY");
  const intent = await trpc("payment.createIntent", { referenceNumber });
  assert(intent.ok && intent.data.clientSecret, "READY application did not create a PaymentIntent");
  const paymentIntentId = intent.data.clientSecret.split("_secret_", 1)[0];
  const confirmedIntent = await stripeConfirm(paymentIntentId);
  const eventId = `evt_tashira_v1_${crypto.randomUUID().replaceAll("-", "")}`;
  const webhook = await signedWebhook(confirmedIntent, eventId);
  const replay = await signedWebhook(confirmedIntent, eventId);
  assert(webhook.status === 200 && replay.payload.duplicate === true, "Webhook verification or replay idempotency failed");

  const [financial] = await db.execute(
    "SELECT a.payment_status,a.status,a.invoice_number,p.amount payment_amount,p.currency,i.amount invoice_amount,s.total_price snapshot_amount,s.snapshot_currency,(SELECT COUNT(*) FROM outbound_email_events e WHERE e.email_application_id=a.id AND e.email_template='PAYMENT_SUCCESS' AND e.email_status='SENT') payment_emails FROM applications a JOIN payments p ON p.application_id=a.id JOIN invoices i ON i.application_id=a.id JOIN application_price_snapshots s ON s.application_id=a.id WHERE a.id=?",
    [created.data.id],
  );
  const money = financial[0];
  assert(money.payment_status === "paid" && money.status === "payment_received", "Paid application state mismatch");
  assert(Number(money.payment_amount) === Number(money.invoice_amount) && Number(money.invoice_amount) === Number(money.snapshot_amount), "Snapshot/payment/invoice mismatch");
  assert(money.payment_emails === 1, "Payment Successful email was not recorded exactly once");

  const login = await trpc("auth.adminLogin", { password: runtime.ADMIN_PASSWORD });
  assert(login.ok, "Staging admin login failed");
  const applications = await trpc("application.list", { search: referenceNumber, limit: 100, offset: 0 }, true);
  assert(applications.ok && applications.data.some((application) => application.referenceNumber === referenceNumber), "Admin did not receive the synthetic application");
  const adminDocuments = await trpc("document.listByApplication", { applicationId: created.data.id }, true);
  assert(adminDocuments.ok && adminDocuments.data.length === 3, "Admin did not receive all required documents");
  for (const document of adminDocuments.data) {
    assert(document.applicantId === created.data.applicantIds[0], "Admin document applicant ownership mismatch");
    const signed = await trpc("storage.getSignedUrl", { documentId: document.id }, true);
    assert(signed.ok && (await fetch(new URL(signed.data.signedUrl, baseUrl))).ok, "Admin document could not be opened");
  }

  const unpaidReference = `TSH-V1-UNPAID-${Date.now()}`;
  const unpaid = await trpc("application.create", {
    referenceNumber: unpaidReference, baseType: "single", residenceType: "non-gcc", visaType: "14days-single",
    processingType: "regular", contactEmail: recipient, contactPhone: "+971500000000",
    policyVersion: "terms-2026-08-11", applicants: [applicant],
  });
  assert(unpaid.ok, "Unpaid gate fixture creation failed");
  const blockedProcessing = await trpc("application.updateStatus", { id: unpaid.data.id, status: "under_review" });
  assert(!blockedProcessing.ok && blockedProcessing.status === 409, "Unpaid application entered operational processing");

  const recovery = await trpc("recovery.request", { email: recipient, channel: "MAGIC_LINK" });
  assert(recovery.ok, "Magic Link request failed");

  console.log(JSON.stringify({
    referenceNumber,
    applicationIntake: "PASS",
    readiness: "PASS",
    documents: documentIds.length,
    adminDocumentsOpened: adminDocuments.data.length,
    payment: "PASS",
    invoice: "PASS",
    amountsEqual: true,
    webhookReplay: "PASS",
    paymentEmailCount: Number(money.payment_emails),
    magicLinkRequested: true,
    unpaidProcessingBlocked: true,
  }));
} finally {
  await db.end();
}
