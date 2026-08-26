import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createPool, type RowDataPacket } from "mysql2/promise";
import superjson from "superjson";
import type { AppRouter } from "../api/router";
import { env } from "../api/lib/env";
import { createCustomerApplicationCookie } from "../api/lib/customer-session";

const reference = "TSH-STG-DYN-FAMILY";
const otherReference = "TSH-STG-DYN-INDIVIDUAL";
const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_REQUIREMENT_DOCUMENT_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) {
  throw new Error("STAGING_REQUIREMENT_DOCUMENT_PATH_IDENTITY_FAILED");
}

function client(references: readonly string[]) {
  const base = new Headers({ host: "staging.tashiraev.com", "x-forwarded-proto": "https" });
  const cookie = references.reduce((current, item) => {
    const headers = new Headers(base); if (current) headers.set("cookie", current);
    return createCustomerApplicationCookie(headers, item).split(";", 1)[0];
  }, "");
  return createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: "http://127.0.0.1:3002/api/trpc", transformer: superjson,
    headers: () => cookie ? ({ cookie }) : ({}) })] });
}

async function expectDenied(operation: () => Promise<unknown>): Promise<void> {
  try { await operation(); throw new Error("STAGING_REQUIREMENT_DOCUMENT_EXPECTED_DENIAL_MISSING"); }
  catch (error) {
    if (!(error instanceof TRPCClientError) || !["UNAUTHORIZED", "FORBIDDEN"].includes(String(error.data?.code))) throw error;
  }
}

const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
try {
  const authorized = client([reference]);
  await expectDenied(() => client([]).dynamicInterview.current.query({ referenceNumber: reference }));
  let initial = await authorized.dynamicInterview.current.query({ referenceNumber: reference });
  if (!initial.partySetup?.requirementReadiness.some((item) => item.state === "MISSING")) {
    const nationality = initial.knownAnswers.filter((answer) => answer.code === "NATIONALITY" && answer.applicantId !== null).at(-1);
    if (!nationality || typeof nationality.answer !== "string") throw new Error("STAGING_REQUIREMENT_DOCUMENT_REEVALUATION_FIXTURE_MISSING");
    initial = await authorized.dynamicInterview.editAnswer.mutate({ referenceNumber: reference, applicantId: nationality.applicantId,
      questionCode: nationality.code, answer: nationality.answer === "PK" ? "EG" : "PK",
      changeReason: "STAGING_SYNTHETIC_REQUIREMENT_DOCUMENT_E2E" });
  }
  const partySetup = initial.partySetup;
  if (!partySetup) throw new Error("STAGING_REQUIREMENT_DOCUMENT_PARTY_SETUP_MISSING");
  const requirement = partySetup.requirementReadiness.find((item) => item.state === "MISSING");
  if (!requirement) throw new Error("STAGING_REQUIREMENT_DOCUMENT_MISSING_FIXTURE_REQUIRED");
  if (!partySetup.applicants.some((applicant) => applicant.applicantId === requirement.applicantId)) {
    throw new Error("STAGING_REQUIREMENT_DOCUMENT_APPLICANT_PROJECTION_INVALID");
  }

  const pdf = Buffer.from("%PDF-1.4\n% Synthetic applicant requirement document for isolated Staging E2E only\n%%EOF\n", "utf8");
  const uploaded = await authorized.storage.upload.mutate({ applicationId: partySetup.applicationId,
    applicantId: requirement.applicantId, documentType: "supporting", fileName: "synthetic-dynamic-requirement.pdf",
    mimeType: "application/pdf", fileSize: pdf.length, base64Data: pdf.toString("base64"),
    uploadedBy: "staging-system:requirement-document-e2e" });
  const document = await authorized.document.create.mutate({ applicationId: partySetup.applicationId,
    applicantId: requirement.applicantId, documentType: "supporting", originalFileName: "synthetic-dynamic-requirement.pdf",
    storedFileName: uploaded.storedFileName, mimeType: "application/pdf", fileSize: pdf.length, storagePath: uploaded.storagePath,
    uploadStatus: "uploaded", uploadedBy: "staging-system:requirement-document-e2e" });
  const idempotencyKey = `requirement-document-${requirement.applicantId}-${document.id}`;
  const linked = await authorized.dynamicInterview.linkRequirementDocument.mutate({ referenceNumber: reference,
    applicantId: requirement.applicantId, requirementCode: requirement.requirementCode, documentId: document.id, idempotencyKey });
  if (linked.replayed) throw new Error("STAGING_REQUIREMENT_DOCUMENT_FIRST_WRITE_REPLAYED");
  const replay = await authorized.dynamicInterview.linkRequirementDocument.mutate({ referenceNumber: reference,
    applicantId: requirement.applicantId, requirementCode: requirement.requirementCode, documentId: document.id, idempotencyKey });
  if (!replay.replayed || replay.requirementInstanceId !== linked.requirementInstanceId) {
    throw new Error("STAGING_REQUIREMENT_DOCUMENT_REPLAY_INVALID");
  }
  await expectDenied(() => authorized.dynamicInterview.linkRequirementDocument.mutate({ referenceNumber: otherReference,
    applicantId: requirement.applicantId, requirementCode: requirement.requirementCode, documentId: document.id,
    idempotencyKey: `${idempotencyKey}-cross` }));

  const current = await authorized.dynamicInterview.current.query({ referenceNumber: reference });
  const updated = current.partySetup?.requirementReadiness.find((item) => item.applicantId === requirement.applicantId
    && item.requirementCode === requirement.requirementCode);
  if (updated?.state !== "UPLOADED") throw new Error("STAGING_REQUIREMENT_DOCUMENT_READINESS_NOT_UPDATED");
  const serialized = JSON.stringify(current.partySetup).toLowerCase();
  if (["suppliercost", "internalcost", "margin", "profit", "stripe", "paymentintent"].some((field) => serialized.includes(field))) {
    throw new Error("STAGING_REQUIREMENT_DOCUMENT_FINANCE_FIELD_LEAK");
  }
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT
    (SELECT COUNT(*) FROM applicant_requirement_document_links WHERE application_id=? AND applicant_id=? AND document_id=?) AS ownedLinks,
    (SELECT COUNT(*) FROM applicant_requirement_document_links WHERE document_id=? AND applicant_id<>?) AS crossApplicantLinks,
    (SELECT COUNT(*) FROM customer_interview_command_events WHERE application_id=? AND command_type='LINK_REQUIREMENT_DOCUMENT'
      AND idempotency_key=?) AS commandEvents,
    (SELECT state FROM applicant_requirement_events WHERE requirement_instance_id=? ORDER BY occurred_at DESC,id DESC LIMIT 1) AS latestState`,
  [partySetup.applicationId, requirement.applicantId, document.id, document.id, requirement.applicantId,
    partySetup.applicationId, idempotencyKey, linked.requirementInstanceId]);
  if (Number(rows[0].ownedLinks) !== 1 || Number(rows[0].crossApplicantLinks) !== 0
    || Number(rows[0].commandEvents) !== 1 || String(rows[0].latestState) !== "UPLOADED") {
    throw new Error("STAGING_REQUIREMENT_DOCUMENT_PERSISTENCE_INVALID");
  }
  console.log("STAGING_REQUIREMENT_DOCUMENT_AUTHORIZATION=PASS");
  console.log("STAGING_REQUIREMENT_DOCUMENT_APPLICANT_ISOLATION=PASS");
  console.log("STAGING_REQUIREMENT_DOCUMENT_UPLOAD_LINK=PASS");
  console.log("STAGING_REQUIREMENT_DOCUMENT_READINESS=PASS");
  console.log("STAGING_REQUIREMENT_DOCUMENT_IDEMPOTENCY=PASS");
  console.log("STAGING_REQUIREMENT_DOCUMENT_CROSS_APPLICATION_DENIAL=PASS");
  console.log("STAGING_REQUIREMENT_DOCUMENT_FINANCE_ISOLATION=PASS");
} finally { await pool.end(); }
