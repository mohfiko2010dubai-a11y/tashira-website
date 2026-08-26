import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createPool, type RowDataPacket } from "mysql2/promise";
import superjson from "superjson";
import type { AppRouter } from "../api/router";
import { env } from "../api/lib/env";
import { createCustomerApplicationCookie } from "../api/lib/customer-session";

const reference = "TSH-STG-DYN-FAMILY";
const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_PARTY_E2E_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_PARTY_E2E_PATH_IDENTITY_FAILED");

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
  try { await operation(); throw new Error("STAGING_PARTY_E2E_EXPECTED_DENIAL_MISSING"); }
  catch (error) { if (!(error instanceof TRPCClientError) || !["UNAUTHORIZED", "FORBIDDEN"].includes(String(error.data?.code))) throw error; }
}

const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
try {
  const authorized = client([reference]);
  await expectDenied(() => client([]).dynamicInterview.current.query({ referenceNumber: reference }));
  await expectDenied(() => authorized.dynamicInterview.addApplicant.mutate({ referenceNumber: "TSH-STG-DYN-INDIVIDUAL",
    profile: { fullName: "Cross Application Attempt", nationality: "EG", residenceCountry: "AE" }, reason: "Expected denial",
    idempotencyKey: "party-cross-application-denial" }));
  let state = await authorized.dynamicInterview.current.query({ referenceNumber: reference });
  if (!state.partySetup || state.partySetup.applicants.length < 2) throw new Error("STAGING_PARTY_E2E_SETUP_MISSING");
  const lead = state.partySetup.applicants[0];
  const added = await authorized.dynamicInterview.addApplicant.mutate({ referenceNumber: reference,
    profile: { fullName: "Synthetic Added Applicant", nationality: "EG", residenceCountry: "AE" },
    reason: "Synthetic Staging party setup E2E", idempotencyKey: "party-add-applicant-v1" });
  state = await authorized.dynamicInterview.current.query({ referenceNumber: reference });
  let applicant = state.partySetup?.applicants.find((item) => item.applicantId === added.applicantId);
  if (!applicant) throw new Error("STAGING_PARTY_E2E_ADDED_APPLICANT_MISSING");
  if (applicant.fullName === "Synthetic Added Applicant") {
    await authorized.dynamicInterview.editApplicant.mutate({ referenceNumber: reference, applicantId: applicant.applicantId,
      expectedVersion: applicant.profileVersion, profile: { fullName: "Synthetic Updated Applicant", nationality: "EG", residenceCountry: "AE" },
      reason: "Synthetic Staging profile correction", idempotencyKey: "party-edit-applicant-v1" });
  }
  await authorized.dynamicInterview.defineRelationship.mutate({ referenceNumber: reference, fromApplicantId: lead.applicantId,
    toApplicantId: applicant.applicantId, relationship: "DEPENDENT", reason: "Synthetic Staging relationship",
    idempotencyKey: "party-relationship-v1" });
  const created = await authorized.dynamicInterview.createTravelGroup.mutate({ referenceNumber: reference, group: { reference: "Synthetic secondary trip",
    applicantIds: [lead.applicantId, applicant.applicantId], primaryTravellerId: lead.applicantId, accompanyingAdultId: lead.applicantId,
    arrangement: "TOGETHER", origin: "CAI", destination: "DXB", plannedArrivalDate: "2027-03-20", plannedDepartureDate: "2027-03-30",
    ticketStatus: "NOT_BOOKED" }, reason: "Synthetic Staging travel group", idempotencyKey: "party-travel-create-v1" });
  state = await authorized.dynamicInterview.current.query({ referenceNumber: reference });
  const currentGroup = state.partySetup?.travelGroups.find((group) => group.travelGroupId === created.travelGroupId);
  if (!currentGroup) throw new Error("STAGING_PARTY_E2E_TRAVEL_GROUP_MISSING");
  if (currentGroup.arrangement === "TOGETHER") await authorized.dynamicInterview.updateTravelGroup.mutate({ referenceNumber: reference,
    travelGroupId: currentGroup.travelGroupId, expectedVersion: currentGroup.version, group: { reference: currentGroup.reference,
      applicantIds: [...currentGroup.applicantIds], primaryTravellerId: currentGroup.primaryTravellerId,
      accompanyingAdultId: currentGroup.accompanyingAdultId, arrangement: "SEPARATELY", origin: currentGroup.origin,
      destination: currentGroup.destination, plannedArrivalDate: currentGroup.plannedArrivalDate,
      plannedDepartureDate: currentGroup.plannedDepartureDate, ticketStatus: currentGroup.ticketStatus },
    reason: "Synthetic Staging travel correction", idempotencyKey: "party-travel-update-v1" });
  state = await authorized.dynamicInterview.current.query({ referenceNumber: reference });
  applicant = state.partySetup?.applicants.find((item) => item.applicantId === added.applicantId);
  const relationship = state.partySetup?.relationships.find((item) => item.fromApplicantId === lead.applicantId && item.toApplicantId === added.applicantId);
  const travelGroup = state.partySetup?.travelGroups.find((group) => group.travelGroupId === created.travelGroupId);
  if (applicant?.fullName !== "Synthetic Updated Applicant" || applicant.profileVersion < 2) throw new Error("STAGING_PARTY_E2E_PROFILE_UPDATE_INVALID");
  if (relationship?.relationship !== "DEPENDENT") throw new Error("STAGING_PARTY_E2E_RELATIONSHIP_INVALID");
  if (travelGroup?.arrangement !== "SEPARATELY" || travelGroup.version < 2 || !travelGroup.applicantIds.includes(added.applicantId)) {
    throw new Error("STAGING_PARTY_E2E_TRAVEL_UPDATE_INVALID");
  }
  const serialized = JSON.stringify(state.partySetup).toLowerCase();
  if (["suppliercost", "internalcost", "margin", "profit", "stripe", "paymentintent"].some((field) => serialized.includes(field))) {
    throw new Error("STAGING_PARTY_E2E_FINANCE_FIELD_LEAK");
  }
  const [ownership] = await pool.execute<RowDataPacket[]>(`SELECT
    (SELECT COUNT(*) FROM applicants p JOIN applications a ON a.id=p.application_id WHERE a.reference_number=? AND p.id=?) AS applicantOwned,
    (SELECT COUNT(*) FROM travel_group_applicants tga JOIN travel_groups tg ON tg.id=tga.travel_group_id
      JOIN applications a ON a.id=tg.application_id WHERE a.reference_number=? AND tg.id=? AND tga.applicant_id=?) AS memberOwned`,
  [reference, added.applicantId, reference, created.travelGroupId, added.applicantId]);
  if (Number(ownership[0].applicantOwned) !== 1 || Number(ownership[0].memberOwned) !== 1) throw new Error("STAGING_PARTY_E2E_OWNERSHIP_INVALID");
  console.log("STAGING_PARTY_SETUP_AUTHORIZATION=PASS");
  console.log("STAGING_PARTY_SETUP_APPLICANT_ADD_EDIT=PASS");
  console.log("STAGING_PARTY_SETUP_RELATIONSHIP=PASS");
  console.log("STAGING_PARTY_SETUP_TRAVEL_VERSIONING=PASS");
  console.log("STAGING_PARTY_SETUP_OWNERSHIP_ISOLATION=PASS");
  console.log("STAGING_PARTY_SETUP_FINANCE_ISOLATION=PASS");
} finally { await pool.end(); }
