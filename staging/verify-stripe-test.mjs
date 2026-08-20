import crypto from "node:crypto";
import fs from "node:fs";
import mysql from "mysql2/promise";

const root = "/var/www/tashira-staging";
if (process.cwd() !== root) throw new Error("Stripe UAT refused outside isolated staging");
const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index), line.slice(index + 1)];
}));
const stripeKey = fs.readFileSync("staging/secrets/stripe_secret_key", "utf8").trim();
const webhookSecret = fs.readFileSync("staging/secrets/stripe_webhook_secret", "utf8").trim();
if (!stripeKey.startsWith("sk_test_") || !webhookSecret.startsWith("whsec_")) throw new Error("TEST-only Stripe credentials required");

const db = await mysql.createConnection(env.DATABASE_URL);
async function stripe(path, fields) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const data = await response.json();
  return { ok: response.ok, data };
}
async function signedWebhook(type, intent, eventId = `evt_tashira_uat_${crypto.randomUUID().replaceAll("-", "")}`) {
  const body = JSON.stringify({ id: eventId, object: "event", type, data: { object: intent } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch("https://staging.tashiraev.com/api/stripe/webhook", {
    method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${timestamp},v1=${signature}` }, body,
  });
  return { status: response.status, body: await response.json(), eventId };
}
async function seed(label) {
  const [identity] = await db.query("SELECT DATABASE() database_name, SUBSTRING_INDEX(CURRENT_USER(), '@', 1) database_user");
  if (identity[0].database_name !== "tashira_staging" || identity[0].database_user !== "tashira_staging_app") throw new Error("Staging DB identity mismatch");
  const [rules] = await db.query("SELECT * FROM pricing_rules WHERE pricing_currency='USD' ORDER BY effective_at DESC, version DESC LIMIT 1");
  if (!rules[0]) throw new Error("No staging USD pricing rule");
  const rule = rules[0];
  const reference = `STRIPE-UAT-${label}-${Date.now()}-${crypto.randomInt(1000, 9999)}`;
  const amount = Number(rule.promotional_price ?? rule.selling_price);
  const [appResult] = await db.execute("INSERT INTO applications (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,total_amount_usd,status,payment_status) VALUES (?,'single','non-gcc',?,?,'stripe-uat@example.invalid','+971000000000',?, ?, ?,'submitted','pending')", [reference, rule.service_code, rule.pricing_processing_type, 1, amount, amount]);
  const appId = appResult.insertId;
  await db.execute("INSERT INTO applicants (application_id,applicant_index,full_name) VALUES (?,0,'Synthetic Stripe UAT')", [appId]);
  await db.execute("INSERT INTO application_price_snapshots (id,application_id,pricing_rule_id,pricing_version,applicant_count,unit_price,total_price,snapshot_supplier_cost,snapshot_internal_cost,snapshot_markup,snapshot_minimum_selling_price,snapshot_currency,exchange_rate_to_base,snapshot_base_currency,total_in_base_currency) VALUES (?,?,?,?,1,?,?,?,?,?,?,'USD',1,'USD',?)", [crypto.randomUUID(), appId, rule.id, rule.version, amount, amount, rule.supplier_cost, rule.internal_cost, rule.markup, rule.minimum_selling_price, amount]);
  for (const [eventName, summary] of [["APPLICATION_CREATED","Synthetic application created"],["POLICY_ACCEPTED","Terms policy accepted"],["APPLICATION_SUBMITTED","Synthetic application submitted"]]) await db.execute("INSERT INTO application_timeline_events (id,application_id,event_name,event_source,actor_type,policy_version,summary) VALUES (?, ?, ?, 'STAGING_UAT', 'SYSTEM', ?, ?)", [crypto.randomUUID(), appId, eventName, eventName === "POLICY_ACCEPTED" ? "2026-08-11" : null, summary]);
  const created = await stripe("payment_intents", { amount: String(Math.round(amount * 100)), currency: "usd", "automatic_payment_methods[enabled]": "true", "automatic_payment_methods[allow_redirects]": "never", "metadata[referenceNumber]": reference });
  if (!created.ok) throw new Error("Stripe PaymentIntent creation failed");
  const intent = created.data;
  const [paymentResult] = await db.execute("INSERT INTO payments (application_id,stripe_payment_intent_id,amount,currency,status) VALUES (?,?,?,'usd','pending')", [appId, intent.id, amount]);
  await db.execute("UPDATE applications SET stripe_payment_intent_id=?,stripe_amount_usd=? WHERE id=?", [intent.id, amount, appId]);
  return { appId, paymentId: paymentResult.insertId, reference, amount, intent };
}

try {
  const success = await seed("SUCCESS");
  const confirmed = await stripe(`payment_intents/${success.intent.id}/confirm`, { payment_method: "pm_card_visa" });
  if (!confirmed.ok || confirmed.data.status !== "succeeded") throw new Error("TEST success confirmation failed");
  const delivered = await signedWebhook("payment_intent.succeeded", confirmed.data);
  const duplicate = await signedWebhook("payment_intent.succeeded", confirmed.data, delivered.eventId);

  const retry = await seed("RETRY");
  const declined = await stripe(`payment_intents/${retry.intent.id}/confirm`, { payment_method: "pm_card_chargeDeclined" });
  const failedIntent = declined.data.payment_intent ?? declined.data.error?.payment_intent;
  if (!failedIntent || failedIntent.status !== "requires_payment_method") throw new Error("TEST decline did not fail as expected");
  const failedDelivery = await signedWebhook("payment_intent.payment_failed", failedIntent);
  const retried = await stripe(`payment_intents/${retry.intent.id}/confirm`, { payment_method: "pm_card_visa" });
  if (!retried.ok || retried.data.status !== "succeeded") throw new Error("TEST retry did not succeed");
  const retryDelivery = await signedWebhook("payment_intent.succeeded", retried.data);

  const threeDs = await seed("3DS");
  const action = await stripe(`payment_intents/${threeDs.intent.id}/confirm`, { payment_method: "pm_card_threeDSecure2Required", return_url: "https://staging.tashiraev.com/payment-return" });
  if (!action.data || action.data.status !== "requires_action") throw new Error("TEST 3DS did not require action");
  const actionDelivery = await signedWebhook("payment_intent.requires_action", action.data);

  const abandoned = await seed("ABANDONED");
  await db.execute("INSERT INTO application_timeline_events (id,application_id,payment_id,event_name,event_source,actor_type,actor_reference,resulting_state,summary) VALUES (?, ?, ?, 'CHECKOUT_ABANDONED','STAGING_UAT','CUSTOMER',?,'pending','Synthetic checkout abandoned before payment')", [crypto.randomUUID(), abandoned.appId, abandoned.paymentId, abandoned.intent.id]);

  const [successRows] = await db.execute("SELECT a.payment_status application_payment_status,a.total_amount_usd,a.stripe_amount_usd,p.amount payment_amount,p.status payment_record_status,i.amount invoice_amount,a.invoice_number,a.invoice_pdf_path,(SELECT COUNT(*) FROM application_timeline_events t WHERE t.application_id=a.id AND t.event_name='PAYMENT_CONFIRMED') confirmed_events,(SELECT COUNT(*) FROM application_timeline_events t WHERE t.application_id=a.id AND t.event_name='INVOICE_GENERATED') invoice_events,(SELECT COUNT(*) FROM application_timeline_events t WHERE t.application_id=a.id AND t.event_name='POLICY_ACCEPTED') policy_events FROM applications a JOIN payments p ON p.application_id=a.id LEFT JOIN invoices i ON i.application_id=a.id WHERE a.id=?", [success.appId]);
  const row = successRows[0];
  console.log(JSON.stringify({
    mode: "TEST", success_webhook: delivered.status, duplicate_webhook: duplicate.body.duplicate === true,
    failure_webhook: failedDelivery.status, retry_webhook: retryDelivery.status, requires_action_webhook: actionDelivery.status,
    success_state: row.application_payment_status, payment_record_state: row.payment_record_status, amounts_equal: Number(row.total_amount_usd) === success.amount && Number(row.stripe_amount_usd) === success.amount && Number(row.payment_amount) === success.amount && Number(row.invoice_amount) === success.amount,
    invoice_linked: Boolean(row.invoice_number && row.invoice_pdf_path), confirmed_event_once: Number(row.confirmed_events) === 1, invoice_event_once: Number(row.invoice_events) === 1, policy_linked: Number(row.policy_events) === 1,
    retry_succeeded: retried.data.status === "succeeded", three_ds_required: action.data.status === "requires_action", abandoned_pending: abandoned.intent.status === "requires_payment_method",
  }));
} finally { await db.end(); }
