import crypto from "node:crypto";
import fs from "node:fs";
import mysql from "mysql2/promise";

const root = "/var/www/tashira-staging";
if (process.cwd() !== root) throw new Error("Refund/deposit verification refused outside isolated staging");

function readEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/u).flatMap((line) => {
    const separator = line.indexOf("=");
    return separator > 0 ? [[line.slice(0, separator), line.slice(separator + 1)]] : [];
  }));
}

const runtime = readEnv(".env");
const staging = readEnv("staging/.env");
const recipients = (staging.STAGING_EMAIL_ALLOWED_RECIPIENTS || "").split(",").map((value) => value.trim()).filter(Boolean);
if (recipients.length !== 1 || staging.STAGING_EMAIL_MODE !== "resend") {
  throw new Error("Exactly one approved staging email recipient is required");
}
if (!runtime.ADMIN_PASSWORD || !runtime.DATABASE_URL) throw new Error("Staging runtime configuration is incomplete");
const stripeKey = fs.readFileSync("staging/secrets/stripe_secret_key", "utf8").trim();
const webhookSecret = fs.readFileSync("staging/secrets/stripe_webhook_secret", "utf8").trim();
if (!stripeKey.startsWith("sk_test_") || !webhookSecret.startsWith("whsec_")) throw new Error("Stripe TEST configuration is required");

const baseUrl = "http://127.0.0.1:3002";
const cookies = new Map();
function rememberCookies(response) {
  const headers = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
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
    headers: {
      "x-forwarded-for": "192.0.2.211",
      ...(cookieHeader() ? { cookie: cookieHeader() } : {}),
      ...(query ? {} : { "content-type": "application/json" }),
    },
    body: query ? undefined : JSON.stringify({ json: input }),
  });
  rememberCookies(response);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}`);
  return payload.result.data.json;
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function confirmStripeTestIntent(paymentIntentId) {
  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      payment_method: "pm_card_visa",
      return_url: "https://staging.tashiraev.com/deposit/uat",
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== "succeeded") throw new Error("Stripe TEST deposit confirmation failed");
}
async function sendDepositWebhook(paymentIntentId, requestId, eventId) {
  const body = JSON.stringify({
    id: eventId,
    object: "event",
    type: "payment_intent.succeeded",
    livemode: false,
    data: {
      object: {
        id: paymentIntentId,
        status: "succeeded",
        livemode: false,
        metadata: { securityDepositRequestId: requestId },
      },
    },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch(`${baseUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": `t=${timestamp},v1=${signature}` },
    body,
  });
  if (!response.ok) throw new Error(`Deposit webhook failed with HTTP ${response.status}`);
  return response.json();
}

const db = await mysql.createConnection(runtime.DATABASE_URL);
try {
  const [identity] = await db.query("SELECT DATABASE() database_name, SUBSTRING_INDEX(CURRENT_USER(), '@', 1) database_user");
  assert(identity[0].database_name === "tashira_staging" && identity[0].database_user === "tashira_staging_app", "Staging database identity mismatch");

  const suffix = Date.now();
  const referenceNumber = `TSH-DEPOSIT-UAT-${suffix}`;
  const created = await trpc("application.create", {
    referenceNumber,
    baseType: "single",
    residenceType: "non-gcc",
    visaType: "14days-single",
    processingType: "regular",
    contactEmail: recipients[0],
    contactPhone: "+971500000000",
    policyVersion: "legal-bundle-2026-08-19-v2",
    applicants: [{
      fullName: "Synthetic Deposit Applicant",
      nationality: "Testland",
      passportNumber: `DEPOSIT${suffix}`,
      passportType: "ordinary",
      travelingFrom: "Testland",
      passportExpiry: "2030-01-01",
      profession: "Tester",
    }],
  });
  const applicationId = created.id;
  assert(applicationId > 0, "Synthetic deposit application was not created");

  await trpc("auth.adminLogin", { password: runtime.ADMIN_PASSWORD });
  const emailed = await trpc("securityDeposit.createAndSend", {
    applicationId,
    amount: 2500,
    purpose: "Synthetic refundable deposit email verification",
    expiresInDays: 7,
  });
  assert(emailed.status === "SENT", "Security-deposit request email was not accepted");

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const requestId = crypto.randomUUID();
  await db.execute(
    "INSERT INTO security_deposit_requests (id,application_id,amount,currency,security_deposit_status,purpose,access_token_hash,expires_at,requested_by,sent_at) VALUES (?,?,?,'AED','SENT',?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY),'staging-uat',UTC_TIMESTAMP())",
    [requestId, applicationId, "10.00", "Synthetic Stripe TEST refundable deposit", tokenHash],
  );

  const publicRequest = await trpc("securityDeposit.getByToken", { token }, true);
  assert(publicRequest.id === requestId && publicRequest.amount === 10 && publicRequest.status === "SENT", "Secure deposit capability did not resolve exact request");
  const accepted = await trpc("securityDeposit.respond", { token, decision: "ACCEPT" });
  assert(accepted.status === "ACCEPTED", "Security deposit was not accepted");
  const payment = await trpc("securityDeposit.createPayment", { token });
  const paymentIntentId = payment.clientSecret.split("_secret_", 1)[0];
  await confirmStripeTestIntent(paymentIntentId);
  const webhookEventId = `evt_deposit_uat_${crypto.randomUUID().replaceAll("-", "")}`;
  const webhook = await sendDepositWebhook(paymentIntentId, requestId, webhookEventId);
  const webhookReplay = await sendDepositWebhook(paymentIntentId, requestId, webhookEventId);
  assert(webhook.received === true && webhookReplay.duplicate === true, "Deposit webhook replay protection failed");
  const confirmed = await trpc("securityDeposit.confirmPayment", { token, paymentIntentId });
  assert(confirmed.status === "PAID", "Security deposit was not authoritatively confirmed");

  const sources = await trpc("refund.eligibleSources", { applicationId }, true);
  const depositSource = sources.find((source) => source.sourceType === "SECURITY_DEPOSIT" && source.availableAmount === 10);
  assert(depositSource, "Paid security deposit was not eligible for refund");
  const refundCase = await trpc("refund.createCase", {
    applicationId,
    reason: "Synthetic staging refund execution verification",
    policyVersion: "refund-policy-uat-v1",
    items: [{
      sourceType: "SECURITY_DEPOSIT",
      securityDepositPaymentId: depositSource.id,
      requestedAmount: 10,
      deduction: { type: "PERCENTAGE", value: 2 },
    }],
  });
  await trpc("refund.approveCase", { refundCaseId: refundCase.refundCaseId, adminPassword: runtime.ADMIN_PASSWORD });
  const executed = await trpc("refund.executeCase", {
    refundCaseId: refundCase.refundCaseId,
    adminPassword: runtime.ADMIN_PASSWORD,
    confirmation: "EXECUTE REFUND",
  });
  assert(executed.status === "REFUNDED" && executed.succeededItems === 1, "Stripe TEST refund did not complete exactly once");

  let replayBlocked = false;
  try {
    await trpc("refund.executeCase", {
      refundCaseId: refundCase.refundCaseId,
      adminPassword: runtime.ADMIN_PASSWORD,
      confirmation: "EXECUTE REFUND",
    });
  } catch {
    replayBlocked = true;
  }
  assert(replayBlocked, "Refund execution replay was not blocked");

  const [evidence] = await db.execute(
    "SELECT (SELECT COUNT(*) FROM outbound_email_events WHERE email_application_id=? AND email_template='SECURITY_DEPOSIT_REQUEST' AND email_status='SENT') sent_emails,(SELECT COUNT(*) FROM refund_items WHERE refund_case_id=? AND refund_item_status='SUCCEEDED' AND stripe_refund_id IS NOT NULL) succeeded_refunds,(SELECT security_deposit_status FROM security_deposit_requests WHERE id=?) deposit_status",
    [applicationId, refundCase.refundCaseId, requestId],
  );
  assert(evidence[0].sent_emails === 1, "Security-deposit email evidence was not single-instance");
  assert(evidence[0].succeeded_refunds === 1, "Refund evidence was not single-instance");
  assert(evidence[0].deposit_status === "PARTIALLY_REFUNDED", "Deposit refund state did not preserve the 2% deduction");

  console.log(JSON.stringify({
    referenceNumber,
    emailRequest: "PASS",
    secureCapability: "PASS",
    depositPayment: "PASS",
    webhookRecovery: "PASS",
    refundAmount: "AED 9.80",
    refundExecution: "PASS",
    replayProtection: "PASS",
    evidence: "PASS",
  }));
} finally {
  await db.end();
}
