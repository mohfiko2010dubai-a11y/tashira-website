import { and, eq, ne } from "drizzle-orm";
import { applicants, applicationPriceSnapshots, applications, applicationTimelineEvents, documents } from "../../db/schema";
import { TERMS_POLICY_VERSION } from "../../contracts/constants";
import { getDb } from "../queries/connection";
import { validPassportExpiry } from "../../contracts/traveller-details";
import { runtimeFlagEnvironment } from "./operations/mysql-access-provider";

export type MissingItem = { code: string; label: string };
export type ApplicantReadiness = {
  applicantId: number;
  applicantIndex: number;
  label: string;
  missing: MissingItem[];
};
export type ApplicationReadiness = {
  status: "READY" | "INCOMPLETE";
  message: string;
  applicationMissing: MissingItem[];
  applicants: ApplicantReadiness[];
};

type ReadinessApplication = Pick<typeof applications.$inferSelect,
  "id" | "baseType" | "residenceType" | "visaType" | "processingType" | "contactEmail" | "contactPhone" | "arrivalDate">;
type ReadinessApplicant = Pick<typeof applicants.$inferSelect,
  "id" | "applicationId" | "applicantIndex" | "fullName" | "nationality" | "passportNumber" | "passportType" |
  "travelingFrom" | "passportExpiry" | "profession" | "gccResidenceNumber" | "gccResidenceCountry" | "sponsorName" | "sponsorRelation">;
type ReadinessDocument = Pick<typeof documents.$inferSelect, "applicationId" | "applicantId" | "documentType" | "uploadStatus">;

const present = (value: unknown) => typeof value === "string" && value.trim().length > 0;

export function requiredDocumentCounts(residenceType: ReadinessApplication["residenceType"]): Record<string, number> {
  const required: Record<string, number> = { passport: 2, photo: 1 };
  if (residenceType === "gcc-resident" || residenceType === "gcc-accompany") required.gcc_residence = 3;
  if (residenceType === "non-gcc-accompany" || residenceType === "gcc-accompany") required.sponsor_id = 1;
  return required;
}

export function evaluateApplicationReadiness(input: {
  application: ReadinessApplication;
  applicants: ReadinessApplicant[];
  documents: ReadinessDocument[];
  hasPriceSnapshot: boolean;
  acceptedPolicyVersion?: string;
}): ApplicationReadiness {
  const { application } = input;
  const applicationMissing: MissingItem[] = [];
  const requiredApplicationFields: Array<[keyof ReadinessApplication, string]> = [
    ["visaType", "Visa product"], ["contactEmail", "Contact email"], ["contactPhone", "Contact phone"],
    ["arrivalDate", "Arrival date"], ["processingType", "Processing type"],
  ];
  for (const [key, label] of requiredApplicationFields) {
    if (!present(application[key])) applicationMissing.push({ code: `application.${String(key)}`, label });
  }
  if (!input.hasPriceSnapshot) applicationMissing.push({ code: "application.valid_product", label: "Valid visa product and price" });
  if (input.acceptedPolicyVersion !== TERMS_POLICY_VERSION) {
    applicationMissing.push({ code: "application.policy", label: "Terms and policy acceptance" });
  }
  const expectedCount = application.baseType === "single" ? 1 : input.applicants.length;
  if (input.applicants.length < 1 || input.applicants.length > 20 || expectedCount !== input.applicants.length) {
    applicationMissing.push({ code: "application.applicant_count", label: "Valid applicant count" });
  }

  const requiredDocuments = requiredDocumentCounts(application.residenceType);
  const applicantResults = [...input.applicants]
    .sort((a, b) => a.applicantIndex - b.applicantIndex)
    .map((applicant, position) => {
      const missing: MissingItem[] = [];
      if (applicant.applicationId !== application.id || applicant.applicantIndex !== position) {
        missing.push({ code: "applicant.invalid_state", label: "Valid applicant record" });
      }
      const fields: Array<[keyof ReadinessApplicant, string]> = [
        ["fullName", "Full name"], ["nationality", "Nationality"], ["passportNumber", "Passport number"],
        ["passportType", "Passport type"], ["travelingFrom", "Traveling from"],
        ["passportExpiry", "Passport expiry"], ["profession", "Profession"],
      ];
      if (application.residenceType === "gcc-resident" || application.residenceType === "gcc-accompany") {
        fields.push(["gccResidenceNumber", "GCC residence number"], ["gccResidenceCountry", "GCC residence country"]);
      }
      if (application.residenceType === "non-gcc-accompany" || application.residenceType === "gcc-accompany") {
        fields.push(["sponsorName", "Sponsor name"], ["sponsorRelation", "Sponsor relationship"]);
      }
      for (const [key, label] of fields) if (!present(applicant[key])) missing.push({ code: `applicant.${String(key)}`, label });

      const owned = input.documents.filter((document) => document.applicationId === application.id
        && document.applicantId === applicant.id && document.uploadStatus === "uploaded");
      for (const [type, count] of Object.entries(requiredDocuments)) {
        if (owned.filter((document) => document.documentType === type).length < count) {
          const labels: Record<string, string> = { passport: "Passport copy and cover", photo: "Personal photo", gcc_residence: "GCC residence documents", sponsor_id: "Sponsor ID or passport" };
          missing.push({ code: `document.${type}`, label: labels[type] ?? type });
        }
      }
      return { applicantId: applicant.id, applicantIndex: applicant.applicantIndex, label: `Applicant ${applicant.applicantIndex + 1}`, missing };
    });

  const ready = applicationMissing.length === 0 && applicantResults.length > 0 && applicantResults.every((item) => item.missing.length === 0);
  return {
    status: ready ? "READY" : "INCOMPLETE",
    message: ready ? "Application is ready for payment" : "Please complete the required information and upload all required documents before proceeding to payment.",
    applicationMissing,
    applicants: applicantResults,
  };
}

export async function getApplicationReadiness(applicationId: number): Promise<ApplicationReadiness> {
  const db = getDb();
  const [application] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!application) throw new Error("Application not found");
  const applicantList = await db.select().from(applicants).where(eq(applicants.applicationId, applicationId));
  const documentList = await db.select().from(documents).where(and(eq(documents.applicationId, applicationId), ne(documents.uploadStatus, "replaced")));
  const [snapshot] = await db.select({ id: applicationPriceSnapshots.id }).from(applicationPriceSnapshots)
    .where(eq(applicationPriceSnapshots.applicationId, applicationId)).limit(1);
  const [policy] = await db.select({ policyVersion: applicationTimelineEvents.policyVersion }).from(applicationTimelineEvents)
    .where(and(eq(applicationTimelineEvents.applicationId, applicationId), eq(applicationTimelineEvents.eventName, "POLICY_ACCEPTED"), eq(applicationTimelineEvents.policyVersion, TERMS_POLICY_VERSION))).limit(1);
  const legacy = evaluateApplicationReadiness({ application, applicants: applicantList, documents: documentList, hasPriceSnapshot: Boolean(snapshot), acceptedPolicyVersion: policy?.policyVersion ?? undefined });
  // The owner-reviewed wizard is staging-only. Legacy and production checkout retain their existing gate.
  if (runtimeFlagEnvironment() !== "STAGING") return legacy;
  const { defaultOperationsSqlClient } = await import("./operations/mysql-query-client");
  const sql = defaultOperationsSqlClient();
  const started = await sql.query("SELECT id FROM dynamic_interview_answer_events WHERE application_id=? LIMIT 1", [applicationId]);
  if (!started.length) return legacy;
  const { MysqlOperationsCaseReadProvider } = await import("./operations/mysql-case-read-provider");
  const bundle = await new MysqlOperationsCaseReadProvider(sql).load(application.referenceNumber);
  const links = await sql.query(`SELECT DISTINCT l.requirement_instance_id AS instanceId FROM applicant_requirement_document_links l
    JOIN documents d ON d.id=l.document_id AND d.application_id=l.application_id AND d.applicant_id=l.applicant_id
    WHERE l.application_id=? AND d.upload_status='uploaded'`, [applicationId]);
  const liveDocumentInstances = new Set(links.map(row => String(Reflect.get(row, "instanceId"))));
  const evidence = applicantList.map(applicant => {
    const evaluation = bundle?.snapshots.current(applicationId, applicant.id);
    return { applicantId: applicant.id, route: evaluation?.selectedRoute, eligibility: evaluation?.eligibilityState,
      expected: evaluation ? [...evaluation.requiredDocuments, ...evaluation.conditionalDocuments.map(item => item.code)] : [],
      documents: evaluation && bundle ? bundle.family.requirements(applicationId, applicant.id, evaluation.evaluationId)
        .filter(item => item.instance.kind === "DOCUMENT").map(item => ({ code: item.instance.code,
          state: item.currentState === "WAIVED" ? "WAIVED" : liveDocumentInstances.has(item.instance.id) ? item.currentState ?? "MISSING" : "MISSING" })) : [] };
  });
  return evaluateInterviewReadiness({ legacy, application, applicants: applicantList, evidence,
    relationshipsComplete: applicantList.length === 1 || Boolean(bundle && applicantList.every(applicant => applicant.applicantIndex === 0 ||
      bundle.family.currentRelationships(applicationId).some(item => item.fromApplicantId === applicantList[0].id && item.toApplicantId === applicant.id || item.toApplicantId === applicantList[0].id && item.fromApplicantId === applicant.id))) });
}

type InterviewReadinessEvidence = { applicantId: number; route?: string; eligibility?: string; expected: readonly string[]; documents: readonly { code: string; state: string }[] };
export function evaluateInterviewReadiness(input: { legacy: ApplicationReadiness; application: ReadinessApplication; applicants: ReadinessApplicant[];
  evidence: readonly InterviewReadinessEvidence[]; relationshipsComplete: boolean }): ApplicationReadiness {
  const applicationMissing = input.legacy.applicationMissing.filter(item => item.code !== "application.arrivalDate");
  if (!input.relationshipsComplete) applicationMissing.push({ code: "application.relationships", label: "Family relationships" });
  const results = input.applicants.map(applicant => {
    const missing: MissingItem[] = [];
    for (const [key, label] of [["fullName", "Full name"], ["nationality", "Nationality"], ["passportNumber", "Passport number"], ["profession", "Profession"], ["gccResidenceCountry", "Country of residence"]] as const) {
      if (!present(applicant[key])) missing.push({ code: `applicant.${key}`, label });
    }
    if (!validPassportExpiry(applicant.passportExpiry ?? "", input.application.arrivalDate)) missing.push({ code: "applicant.passportExpiry", label: "Passport valid for at least six months" });
    const old = input.legacy.applicants.find(item => item.applicantId === applicant.id);
    missing.push(...(old?.missing.filter(item => item.code === "applicant.invalid_state") ?? []));
    const evidence = input.evidence.find(item => item.applicantId === applicant.id);
    if (!evidence?.eligibility || evidence.route !== input.application.visaType) missing.push({ code: "applicant.evaluation", label: "Save traveller details to complete the application review" });
    else if (evidence.eligibility !== "ELIGIBLE") missing.push({ code: "applicant.eligibility", label: "TASHIRA eligibility review required before payment" });
    const codes = new Set(["PASSPORT", "PERSONAL_PHOTO", ...(evidence?.expected ?? []), ...(evidence?.documents.map(item => item.code) ?? [])]);
    for (const code of codes) {
      if (!evidence?.documents.some(item => item.code === code && ["UPLOADED", "VALIDATED", "WAIVED"].includes(item.state))) {
        missing.push({ code: `document.${code}`, label: code.replaceAll("_", " ") });
      }
    }
    return { applicantId: applicant.id, applicantIndex: applicant.applicantIndex, label: applicant.fullName ?? `Applicant ${applicant.applicantIndex + 1}`, missing };
  });
  const ready = applicationMissing.length === 0 && results.length > 0 && results.every(item => !item.missing.length);
  return { status: ready ? "READY" : "INCOMPLETE", message: ready ? "Application is ready for payment" : "Complete the listed requirements before payment.", applicationMissing, applicants: results };
}
