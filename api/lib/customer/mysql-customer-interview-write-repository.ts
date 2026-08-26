import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { validateTravelGroup, type TicketStatus, type TravelArrangement } from "../travel/travel-party";

export type CustomerApplicantProfile = {
  fullName: string;
  nationality: string | null;
  residenceCountry: string | null;
};

export type CustomerApplicantWriteResult = {
  applicantId: number;
  applicantIndex: number;
  profileVersion: number;
  profile: CustomerApplicantProfile;
  replayed: boolean;
};

export type CustomerTravelGroupInput = { reference: string; applicantIds: readonly number[]; primaryTravellerId: number;
  accompanyingAdultId: number | null; arrangement: TravelArrangement; origin: string; destination: string;
  plannedArrivalDate: string; plannedDepartureDate: string | null; ticketStatus: TicketStatus };

async function commandReplay(connection: PoolConnection, input: { applicationId: number; idempotencyKey: string; commandSha256: string }) {
  const [rows] = await connection.execute<RowDataPacket[]>(`SELECT entity_reference AS entityReference,entity_version AS entityVersion,
    command_sha256 AS commandSha256 FROM customer_interview_command_events WHERE application_id=? AND idempotency_key=? LIMIT 1`,
  [input.applicationId, input.idempotencyKey]);
  if (!rows[0]) return null;
  if (String(rows[0].commandSha256) !== input.commandSha256) throw new Error("CUSTOMER_INTERVIEW_IDEMPOTENCY_CONFLICT");
  return { entityReference: String(rows[0].entityReference), entityVersion: Number(rows[0].entityVersion), replayed: true as const };
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseProfile(value: unknown): CustomerApplicantProfile {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (typeof parsed !== "object" || parsed === null) throw new Error("CUSTOMER_PROFILE_EVIDENCE_INVALID");
  const fullName = Reflect.get(parsed, "fullName");
  const nationality = Reflect.get(parsed, "nationality");
  const residenceCountry = Reflect.get(parsed, "residenceCountry");
  if (typeof fullName !== "string" || !fullName.trim()
    || (nationality !== null && typeof nationality !== "string")
    || (residenceCountry !== null && typeof residenceCountry !== "string")) throw new Error("CUSTOMER_PROFILE_EVIDENCE_INVALID");
  return { fullName, nationality, residenceCountry };
}

async function transaction<T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

async function replay(connection: PoolConnection, input: { applicationId: number; idempotencyKey: string; commandSha256: string }): Promise<CustomerApplicantWriteResult | null> {
  const [rows] = await connection.execute<RowDataPacket[]>(`SELECT e.applicant_id AS applicantId,a.applicant_index AS applicantIndex,
    e.profile_version AS profileVersion,e.profile_json AS profile,e.command_sha256 AS commandSha256
    FROM customer_interview_profile_events e JOIN applicants a ON a.id=e.applicant_id AND a.application_id=e.application_id
    WHERE e.application_id=? AND e.idempotency_key=? LIMIT 1`, [input.applicationId, input.idempotencyKey]);
  const row = rows[0]; if (!row) return null;
  if (String(row.commandSha256) !== input.commandSha256) throw new Error("CUSTOMER_INTERVIEW_IDEMPOTENCY_CONFLICT");
  return { applicantId: Number(row.applicantId), applicantIndex: Number(row.applicantIndex), profileVersion: Number(row.profileVersion),
    profile: parseProfile(row.profile), replayed: true };
}

export class MysqlCustomerInterviewWriteRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) { this.pool = pool; }

  async addApplicant(input: { applicationId: number; profile: CustomerApplicantProfile; reason: string; actorReference: string;
    idempotencyKey: string; occurredAt: Date }): Promise<CustomerApplicantWriteResult> {
    const commandSha256 = digest({ type: "ADD_APPLICANT", applicationId: input.applicationId, profile: input.profile, reason: input.reason });
    return transaction(this.pool, async (connection) => {
      const [applications] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("CUSTOMER_APPLICATION_NOT_FOUND");
      const existing = await replay(connection, { ...input, commandSha256 }); if (existing) return existing;
      const [applicants] = await connection.execute<RowDataPacket[]>("SELECT applicant_index AS applicantIndex FROM applicants WHERE application_id=? ORDER BY applicant_index FOR UPDATE", [input.applicationId]);
      const applicantIndex = applicants.length ? Math.max(...applicants.map((row) => Number(row.applicantIndex))) + 1 : 0;
      const [insert] = await connection.execute<ResultSetHeader>(`INSERT INTO applicants
        (application_id,applicant_index,full_name,nationality,gcc_residence_country,profile_version) VALUES (?,?,?,?,?,1)`,
      [input.applicationId, applicantIndex, input.profile.fullName, input.profile.nationality, input.profile.residenceCountry]);
      const applicantId = Number(insert.insertId); const eventId = randomUUID();
      await connection.execute(`INSERT INTO customer_interview_profile_events
        (id,application_id,applicant_id,profile_version,event_type,profile_json,reason,actor_reference,command_sha256,idempotency_key,occurred_at)
        VALUES (?,?,?,1,'CREATED',?,?,?,?,?,?)`, [eventId, input.applicationId, applicantId, JSON.stringify(input.profile), input.reason,
        input.actorReference, commandSha256, input.idempotencyKey, input.occurredAt]);
      return { applicantId, applicantIndex, profileVersion: 1, profile: structuredClone(input.profile), replayed: false };
    });
  }

  async editApplicant(input: { applicationId: number; applicantId: number; expectedVersion: number; profile: CustomerApplicantProfile;
    reason: string; actorReference: string; idempotencyKey: string; occurredAt: Date }): Promise<CustomerApplicantWriteResult> {
    const commandSha256 = digest({ type: "EDIT_APPLICANT", applicationId: input.applicationId, applicantId: input.applicantId,
      expectedVersion: input.expectedVersion, profile: input.profile, reason: input.reason });
    return transaction(this.pool, async (connection) => {
      const [applications] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("CUSTOMER_APPLICATION_NOT_FOUND");
      const existing = await replay(connection, { ...input, commandSha256 }); if (existing) return existing;
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT applicant_index AS applicantIndex,profile_version AS profileVersion FROM applicants WHERE id=? AND application_id=? FOR UPDATE",
        [input.applicantId, input.applicationId]);
      const row = rows[0]; if (!row) throw new Error("CUSTOMER_APPLICANT_OWNERSHIP_INVALID");
      if (Number(row.profileVersion) !== input.expectedVersion) throw new Error("CUSTOMER_APPLICANT_VERSION_CONFLICT");
      const nextVersion = input.expectedVersion + 1;
      const [updated] = await connection.execute<ResultSetHeader>(`UPDATE applicants SET full_name=?,nationality=?,gcc_residence_country=?,profile_version=?
        WHERE id=? AND application_id=? AND profile_version=?`, [input.profile.fullName, input.profile.nationality, input.profile.residenceCountry,
        nextVersion, input.applicantId, input.applicationId, input.expectedVersion]);
      if (updated.affectedRows !== 1) throw new Error("CUSTOMER_APPLICANT_VERSION_CONFLICT");
      await connection.execute(`INSERT INTO customer_interview_profile_events
        (id,application_id,applicant_id,profile_version,event_type,profile_json,reason,actor_reference,command_sha256,idempotency_key,occurred_at)
        VALUES (?,?,?,?, 'UPDATED',?,?,?,?,?,?)`, [randomUUID(), input.applicationId, input.applicantId, nextVersion, JSON.stringify(input.profile),
        input.reason, input.actorReference, commandSha256, input.idempotencyKey, input.occurredAt]);
      return { applicantId: input.applicantId, applicantIndex: Number(row.applicantIndex), profileVersion: nextVersion,
        profile: structuredClone(input.profile), replayed: false };
    });
  }

  async defineRelationship(input: { applicationId: number; fromApplicantId: number; toApplicantId: number;
    relationship: "SPOUSE" | "PARENT" | "CHILD" | "GUARDIAN" | "DEPENDENT"; reason: string; actorReference: string;
    idempotencyKey: string; occurredAt: Date }): Promise<{ relationshipEventId: string; replayed: boolean }> {
    if (input.fromApplicantId === input.toApplicantId) throw new Error("CUSTOMER_RELATIONSHIP_SELF_REFERENCE");
    const commandSha256 = digest({ type: "DEFINE_RELATIONSHIP", applicationId: input.applicationId, fromApplicantId: input.fromApplicantId,
      toApplicantId: input.toApplicantId, relationship: input.relationship, reason: input.reason });
    return transaction(this.pool, async (connection) => {
      const [applications] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("CUSTOMER_APPLICATION_NOT_FOUND");
      const [commands] = await connection.execute<RowDataPacket[]>(`SELECT entity_reference AS entityReference,command_sha256 AS commandSha256
        FROM customer_interview_command_events WHERE application_id=? AND idempotency_key=? LIMIT 1`, [input.applicationId, input.idempotencyKey]);
      if (commands[0]) {
        if (String(commands[0].commandSha256) !== commandSha256) throw new Error("CUSTOMER_INTERVIEW_IDEMPOTENCY_CONFLICT");
        return { relationshipEventId: String(commands[0].entityReference), replayed: true };
      }
      const [applicants] = await connection.execute<RowDataPacket[]>("SELECT id FROM applicants WHERE application_id=? AND id IN (?,?) FOR UPDATE",
        [input.applicationId, input.fromApplicantId, input.toApplicantId]);
      if (applicants.length !== 2) throw new Error("CUSTOMER_RELATIONSHIP_OWNERSHIP_INVALID");
      const [current] = await connection.execute<RowDataPacket[]>(`SELECT event_type AS eventType FROM family_relationship_events
        WHERE application_id=? AND from_applicant_id=? AND to_applicant_id=? AND relationship_type=? ORDER BY occurred_at DESC,id DESC LIMIT 1`,
      [input.applicationId, input.fromApplicantId, input.toApplicantId, input.relationship]);
      if (String(current[0]?.eventType ?? "") === "ESTABLISHED") throw new Error("CUSTOMER_RELATIONSHIP_ALREADY_ACTIVE");
      const relationshipEventId = randomUUID();
      await connection.execute(`INSERT INTO family_relationship_events
        (id,application_id,from_applicant_id,to_applicant_id,relationship_type,event_type,reason,actor_reference,occurred_at)
        VALUES (?,?,?,?,?,'ESTABLISHED',?,?,?)`, [relationshipEventId, input.applicationId, input.fromApplicantId, input.toApplicantId,
        input.relationship, input.reason, input.actorReference, input.occurredAt]);
      await connection.execute(`INSERT INTO customer_interview_command_events
        (id,application_id,command_type,entity_reference,entity_version,command_sha256,evidence_json,idempotency_key,actor_reference,occurred_at)
        VALUES (?,?,'DEFINE_RELATIONSHIP',?,1,?,?,?,?,?)`, [randomUUID(), input.applicationId, relationshipEventId, commandSha256,
        JSON.stringify({ fromApplicantId: input.fromApplicantId, toApplicantId: input.toApplicantId, relationship: input.relationship }),
        input.idempotencyKey, input.actorReference, input.occurredAt]);
      return { relationshipEventId, replayed: false };
    });
  }

  async createTravelGroup(input: { applicationId: number; group: CustomerTravelGroupInput; reason: string; actorReference: string;
    idempotencyKey: string; occurredAt: Date }): Promise<{ travelGroupId: string; version: number; replayed: boolean }> {
    const travelGroupId = randomUUID();
    const commandSha256 = digest({ type: "DEFINE_TRAVEL_GROUP", applicationId: input.applicationId, group: input.group, reason: input.reason });
    return transaction(this.pool, async (connection) => {
      const [applications] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("CUSTOMER_APPLICATION_NOT_FOUND");
      const prior = await commandReplay(connection, { ...input, commandSha256 });
      if (prior) return { travelGroupId: prior.entityReference, version: prior.entityVersion, replayed: true };
      await this.validateTravelGroupOwnership(connection, input.applicationId, travelGroupId, input.group);
      await connection.execute(`INSERT INTO travel_groups (id,application_id,travel_group_reference,arrangement,primary_traveller_id,
        accompanying_adult_id,origin,destination,planned_arrival_date,planned_departure_date,ticket_status,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
      [travelGroupId, input.applicationId, input.group.reference, input.group.arrangement, input.group.primaryTravellerId,
        input.group.accompanyingAdultId, input.group.origin, input.group.destination, input.group.plannedArrivalDate,
        input.group.plannedDepartureDate, input.group.ticketStatus]);
      await this.replaceTravelMembers(connection, input.applicationId, travelGroupId, input.group);
      await this.appendCommand(connection, { applicationId: input.applicationId, type: "DEFINE_TRAVEL_GROUP", entityReference: travelGroupId,
        version: 1, commandSha256, evidence: input.group, idempotencyKey: input.idempotencyKey, actorReference: input.actorReference, occurredAt: input.occurredAt });
      return { travelGroupId, version: 1, replayed: false };
    });
  }

  async updateTravelGroup(input: { applicationId: number; travelGroupId: string; expectedVersion: number; group: CustomerTravelGroupInput;
    reason: string; actorReference: string; idempotencyKey: string; occurredAt: Date }): Promise<{ travelGroupId: string; version: number; replayed: boolean }> {
    const commandSha256 = digest({ type: "UPDATE_TRAVEL_GROUP", applicationId: input.applicationId, travelGroupId: input.travelGroupId,
      expectedVersion: input.expectedVersion, group: input.group, reason: input.reason });
    return transaction(this.pool, async (connection) => {
      const [applications] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("CUSTOMER_APPLICATION_NOT_FOUND");
      const prior = await commandReplay(connection, { ...input, commandSha256 });
      if (prior) return { travelGroupId: prior.entityReference, version: prior.entityVersion, replayed: true };
      const [groups] = await connection.execute<RowDataPacket[]>("SELECT version FROM travel_groups WHERE id=? AND application_id=? FOR UPDATE",
        [input.travelGroupId, input.applicationId]);
      if (!groups[0]) throw new Error("CUSTOMER_TRAVEL_GROUP_OWNERSHIP_INVALID");
      if (Number(groups[0].version) !== input.expectedVersion) throw new Error("CUSTOMER_TRAVEL_GROUP_VERSION_CONFLICT");
      await this.validateTravelGroupOwnership(connection, input.applicationId, input.travelGroupId, input.group);
      const version = input.expectedVersion + 1;
      const [updated] = await connection.execute<ResultSetHeader>(`UPDATE travel_groups SET travel_group_reference=?,arrangement=?,primary_traveller_id=?,
        accompanying_adult_id=?,origin=?,destination=?,planned_arrival_date=?,planned_departure_date=?,ticket_status=?,version=?
        WHERE id=? AND application_id=? AND version=?`, [input.group.reference, input.group.arrangement, input.group.primaryTravellerId,
        input.group.accompanyingAdultId, input.group.origin, input.group.destination, input.group.plannedArrivalDate,
        input.group.plannedDepartureDate, input.group.ticketStatus, version, input.travelGroupId, input.applicationId, input.expectedVersion]);
      if (updated.affectedRows !== 1) throw new Error("CUSTOMER_TRAVEL_GROUP_VERSION_CONFLICT");
      await this.replaceTravelMembers(connection, input.applicationId, input.travelGroupId, input.group);
      await this.appendCommand(connection, { applicationId: input.applicationId, type: "UPDATE_TRAVEL_GROUP", entityReference: input.travelGroupId,
        version, commandSha256, evidence: input.group, idempotencyKey: input.idempotencyKey, actorReference: input.actorReference, occurredAt: input.occurredAt });
      return { travelGroupId: input.travelGroupId, version, replayed: false };
    });
  }

  async linkSharedDocument(input: { applicationId: number; documentId: number; documentType: "OUTBOUND_TICKET" | "RETURN_TICKET" |
    "ONWARD_TICKET" | "ROUND_TRIP_TICKET" | "FAMILY_BOOKING"; applicantIds: readonly number[]; actorReference: string;
    idempotencyKey: string; occurredAt: Date }): Promise<{ documentId: number; linkedApplicantIds: readonly number[]; replayed: boolean }> {
    const applicantIds = [...new Set(input.applicantIds)].sort((left, right) => left - right);
    if (!applicantIds.length) throw new Error("CUSTOMER_SHARED_DOCUMENT_HAS_NO_APPLICANTS");
    const commandSha256 = digest({ type: "LINK_SHARED_DOCUMENT", applicationId: input.applicationId, documentId: input.documentId,
      documentType: input.documentType, applicantIds });
    return transaction(this.pool, async (connection) => {
      const [applications] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("CUSTOMER_APPLICATION_NOT_FOUND");
      const prior = await commandReplay(connection, { ...input, commandSha256 });
      if (prior) return { documentId: Number(prior.entityReference), linkedApplicantIds: applicantIds, replayed: true };
      const [documents] = await connection.execute<RowDataPacket[]>("SELECT id FROM documents WHERE id=? AND application_id=? FOR UPDATE",
        [input.documentId, input.applicationId]);
      if (!documents[0]) throw new Error("CUSTOMER_SHARED_DOCUMENT_OWNERSHIP_INVALID");
      const placeholders = applicantIds.map(() => "?").join(",");
      const [owned] = await connection.execute<RowDataPacket[]>(`SELECT id FROM applicants WHERE application_id=? AND id IN (${placeholders}) FOR UPDATE`,
        [input.applicationId, ...applicantIds]);
      if (owned.length !== applicantIds.length) throw new Error("CUSTOMER_SHARED_DOCUMENT_APPLICANT_OWNERSHIP_INVALID");
      const [existing] = await connection.execute<RowDataPacket[]>(`SELECT applicant_id AS applicantId,document_type AS documentType
        FROM travel_document_applicant_links WHERE document_id=? FOR UPDATE`, [input.documentId]);
      if (existing.some((row) => String(row.documentType) !== input.documentType)) throw new Error("CUSTOMER_SHARED_DOCUMENT_TYPE_CONFLICT");
      const linked = new Set(existing.map((row) => Number(row.applicantId)));
      for (const applicantId of applicantIds) if (!linked.has(applicantId)) await connection.execute(`INSERT INTO travel_document_applicant_links
        (id,application_id,document_id,applicant_id,document_type,linked_at,actor_reference) VALUES (?,?,?,?,?,?,?)`,
      [randomUUID(), input.applicationId, input.documentId, applicantId, input.documentType, input.occurredAt, input.actorReference]);
      await connection.execute(`INSERT INTO customer_interview_command_events
        (id,application_id,command_type,entity_reference,entity_version,command_sha256,evidence_json,idempotency_key,actor_reference,occurred_at)
        VALUES (?,?,'LINK_SHARED_DOCUMENT',?,NULL,?,?,?,?,?)`, [randomUUID(), input.applicationId, String(input.documentId), commandSha256,
        JSON.stringify({ documentType: input.documentType, applicantIds }), input.idempotencyKey, input.actorReference, input.occurredAt]);
      return { documentId: input.documentId, linkedApplicantIds: applicantIds, replayed: false };
    });
  }

  private async validateTravelGroupOwnership(connection: PoolConnection, applicationId: number, id: string, group: CustomerTravelGroupInput) {
    const validation = validateTravelGroup({ id, applicationId, ...group });
    if (!validation.valid) throw new Error(`CUSTOMER_TRAVEL_GROUP_INVALID:${validation.errors.join(",")}`);
    const ids = [...new Set(group.applicantIds)];
    const placeholders = ids.map(() => "?").join(",");
    const [owned] = await connection.execute<RowDataPacket[]>(`SELECT id FROM applicants WHERE application_id=? AND id IN (${placeholders}) FOR UPDATE`,
      [applicationId, ...ids]);
    if (owned.length !== ids.length) throw new Error("CUSTOMER_TRAVEL_GROUP_APPLICANT_OWNERSHIP_INVALID");
  }

  private async replaceTravelMembers(connection: PoolConnection, applicationId: number, travelGroupId: string, group: CustomerTravelGroupInput) {
    await connection.execute("DELETE FROM travel_group_applicants WHERE travel_group_id=? AND application_id=?", [travelGroupId, applicationId]);
    for (const applicantId of group.applicantIds) {
      const role = applicantId === group.primaryTravellerId ? "PRIMARY_TRAVELLER"
        : applicantId === group.accompanyingAdultId ? "ACCOMPANYING_ADULT" : "TRAVELLER";
      await connection.execute(`INSERT INTO travel_group_applicants (travel_group_id,application_id,applicant_id,role) VALUES (?,?,?,?)`,
        [travelGroupId, applicationId, applicantId, role]);
    }
  }

  private async appendCommand(connection: PoolConnection, input: { applicationId: number; type: "DEFINE_TRAVEL_GROUP" | "UPDATE_TRAVEL_GROUP";
    entityReference: string; version: number; commandSha256: string; evidence: unknown; idempotencyKey: string;
    actorReference: string; occurredAt: Date }) {
    await connection.execute(`INSERT INTO customer_interview_command_events
      (id,application_id,command_type,entity_reference,entity_version,command_sha256,evidence_json,idempotency_key,actor_reference,occurred_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, [randomUUID(), input.applicationId, input.type, input.entityReference, input.version,
      input.commandSha256, JSON.stringify(input.evidence), input.idempotencyKey, input.actorReference, input.occurredAt]);
  }
}
