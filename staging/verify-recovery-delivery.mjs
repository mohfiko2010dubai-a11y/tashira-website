import fs from "node:fs";
import mysql from "mysql2/promise";

const expectedDirectory = "/var/www/tashira-staging";
if (process.cwd() !== expectedDirectory) throw new Error("Recovery UAT refused outside isolated staging");

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf("=");
    if (separator < 1) return [];
    return [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()]];
  }));
}

const runtime = parseEnv(fs.readFileSync(".env", "utf8"));
const staging = parseEnv(fs.readFileSync("staging/.env", "utf8"));
const recipients = (staging.STAGING_EMAIL_ALLOWED_RECIPIENTS ?? "")
  .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
if (staging.STAGING_EMAIL_MODE !== "resend" || recipients.length !== 1) {
  throw new Error("Recovery UAT requires exactly one approved staging recipient");
}

const connection = await mysql.createConnection(runtime.DATABASE_URL);
try {
  const [identityRows] = await connection.query(
    "SELECT DATABASE() database_name, SUBSTRING_INDEX(CURRENT_USER(), '@', 1) database_user",
  );
  const identity = identityRows[0];
  if (identity.database_name !== "tashira_staging" || identity.database_user !== "tashira_staging_app") {
    throw new Error("Recovery UAT staging database identity mismatch");
  }

  const recipient = recipients[0];
  let [applicationRows] = await connection.execute(
    "SELECT id FROM applications WHERE LOWER(contact_email)=? ORDER BY updated_at DESC LIMIT 1",
    [recipient],
  );
  let createdSyntheticApplication = false;
  if (!applicationRows[0]) {
    const referenceNumber = `TSH-RECOVERY-UAT-${Date.now()}`;
    const response = await fetch("http://127.0.0.1:3002/api/trpc/application.create", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.80" },
      body: JSON.stringify({ json: {
        referenceNumber,
        baseType: "single",
        residenceType: "non-gcc",
        visaType: "14days-single",
        processingType: "regular",
        contactEmail: recipient,
        contactPhone: "+971500000000",
        arrivalDate: "2027-01-01",
        policyVersion: "terms-2026-08-11",
        applicants: [{ fullName: "Synthetic Recovery UAT", nationality: "Testland" }],
      } }),
    });
    if (!response.ok) throw new Error(`Synthetic recovery application creation failed with HTTP ${response.status}`);
    createdSyntheticApplication = true;
    [applicationRows] = await connection.execute(
      "SELECT id FROM applications WHERE reference_number=? LIMIT 1",
      [referenceNumber],
    );
  }
  if (!applicationRows[0]) throw new Error("Synthetic recovery application was not persisted");
  const applicationId = applicationRows[0].id;
  const [beforeRows] = await connection.execute(
    "SELECT COUNT(*) count FROM outbound_email_events WHERE email_application_id=?",
    [applicationId],
  );
  const before = Number(beforeRows[0].count);

  for (const channel of ["MAGIC_LINK", "EMAIL_OTP"]) {
    const response = await fetch("http://127.0.0.1:3002/api/trpc/recovery.request", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.81" },
      body: JSON.stringify({ json: { email: recipient, channel } }),
    });
    if (!response.ok) throw new Error(`Recovery ${channel} request failed with HTTP ${response.status}`);
    const body = await response.json();
    if (body.result?.data?.json?.accepted !== true) throw new Error(`Recovery ${channel} response was not enumeration-safe`);
  }

  const [eventRows] = await connection.execute(
    "SELECT email_template template, email_status status FROM outbound_email_events "
      + "WHERE email_application_id=? ORDER BY created_at DESC LIMIT 2",
    [applicationId],
  );
  const templates = new Set(eventRows.map((row) => row.template));
  const [afterRows] = await connection.execute(
    "SELECT COUNT(*) count FROM outbound_email_events WHERE email_application_id=?",
    [applicationId],
  );
  console.log(JSON.stringify({
    database: identity.database_name,
    user: identity.database_user,
    requestsAccepted: 2,
    evidenceRowsAdded: Number(afterRows[0].count) - before,
    templatesRecorded: ["RESUME_LINK", "RECOVERY_OTP"].every((name) => templates.has(name)),
    providerAccepted: eventRows.length === 2 && eventRows.every((row) => row.status === "SENT"),
    createdSyntheticApplication,
    secretsPrinted: false,
  }));
} finally {
  await connection.end();
}
