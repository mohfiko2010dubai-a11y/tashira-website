import { randomUUID } from "node:crypto";
import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import { MysqlCustomerInterviewWriteRepository } from "./mysql-customer-interview-write-repository";

const databaseUrl = process.env.CUSTOMER_WRITE_REHEARSAL_DATABASE_URL;

describe.skipIf(!databaseUrl)("MySQL customer interview applicant writes", () => {
  it("preserves ownership, optimistic concurrency, history and idempotency atomically", async () => {
    if (!databaseUrl) throw new Error("CUSTOMER_WRITE_REHEARSAL_DATABASE_URL_REQUIRED");
    const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2 }); const runId = randomUUID();
    try {
      const [application] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
        (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status)
        VALUES (?,'family','non-gcc','ROUTE_TEST','regular','synthetic@example.invalid','000',1,100,'submitted','pending')`, [`WRITE-${runId}`]);
      const [otherApplication] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
        (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status)
        VALUES (?,'family','non-gcc','ROUTE_TEST','regular','synthetic@example.invalid','000',1,100,'submitted','pending')`, [`WRITE-OTHER-${runId}`]);
      const repository = new MysqlCustomerInterviewWriteRepository(pool); const profile = { fullName: "Synthetic Applicant", nationality: "EG", residenceCountry: null };
      const created = await repository.addApplicant({ applicationId: Number(application.insertId), profile, reason: "Synthetic creation",
        actorReference: "customer:synthetic", idempotencyKey: `add-${runId}`, occurredAt: new Date() });
      expect(created).toMatchObject({ applicantIndex: 0, profileVersion: 1, replayed: false });
      expect(await repository.addApplicant({ applicationId: Number(application.insertId), profile, reason: "Synthetic creation",
        actorReference: "customer:synthetic", idempotencyKey: `add-${runId}`, occurredAt: new Date() })).toMatchObject({ applicantId: created.applicantId, replayed: true });
      await expect(repository.addApplicant({ applicationId: Number(application.insertId), profile: { ...profile, fullName: "Conflict" }, reason: "Synthetic creation",
        actorReference: "customer:synthetic", idempotencyKey: `add-${runId}`, occurredAt: new Date() })).rejects.toThrow("CUSTOMER_INTERVIEW_IDEMPOTENCY_CONFLICT");
      const edited = await repository.editApplicant({ applicationId: Number(application.insertId), applicantId: created.applicantId, expectedVersion: 1,
        profile: { ...profile, fullName: "Synthetic Applicant Updated" }, reason: "Synthetic correction", actorReference: "customer:synthetic",
        idempotencyKey: `edit-${runId}`, occurredAt: new Date() });
      expect(edited).toMatchObject({ profileVersion: 2, replayed: false });
      await expect(repository.editApplicant({ applicationId: Number(application.insertId), applicantId: created.applicantId, expectedVersion: 1,
        profile, reason: "Stale", actorReference: "customer:synthetic", idempotencyKey: `stale-${runId}`, occurredAt: new Date() }))
        .rejects.toThrow("CUSTOMER_APPLICANT_VERSION_CONFLICT");
      await expect(repository.editApplicant({ applicationId: Number(otherApplication.insertId), applicantId: created.applicantId, expectedVersion: 2,
        profile, reason: "Cross application", actorReference: "customer:synthetic", idempotencyKey: `cross-${runId}`, occurredAt: new Date() }))
        .rejects.toThrow("CUSTOMER_APPLICANT_OWNERSHIP_INVALID");
      const child = await repository.addApplicant({ applicationId: Number(application.insertId),
        profile: { fullName: "Synthetic Child", nationality: "EG", residenceCountry: null }, reason: "Synthetic child",
        actorReference: "customer:synthetic", idempotencyKey: `child-${runId}`, occurredAt: new Date() });
      const relationship = await repository.defineRelationship({ applicationId: Number(application.insertId), fromApplicantId: created.applicantId,
        toApplicantId: child.applicantId, relationship: "GUARDIAN", reason: "Synthetic guardian", actorReference: "customer:synthetic",
        idempotencyKey: `relationship-${runId}`, occurredAt: new Date() });
      expect(relationship.replayed).toBe(false);
      expect(await repository.defineRelationship({ applicationId: Number(application.insertId), fromApplicantId: created.applicantId,
        toApplicantId: child.applicantId, relationship: "GUARDIAN", reason: "Synthetic guardian", actorReference: "customer:synthetic",
        idempotencyKey: `relationship-${runId}`, occurredAt: new Date() })).toEqual({ ...relationship, replayed: true });
      await expect(repository.defineRelationship({ applicationId: Number(otherApplication.insertId), fromApplicantId: created.applicantId,
        toApplicantId: child.applicantId, relationship: "GUARDIAN", reason: "Cross application", actorReference: "customer:synthetic",
        idempotencyKey: `relationship-cross-${runId}`, occurredAt: new Date() })).rejects.toThrow("CUSTOMER_RELATIONSHIP_OWNERSHIP_INVALID");
      const groupInput = { reference: "Trip A", applicantIds: [created.applicantId, child.applicantId], primaryTravellerId: created.applicantId,
        accompanyingAdultId: created.applicantId, arrangement: "TOGETHER" as const, origin: "CAI", destination: "DXB",
        plannedArrivalDate: "2027-01-20", plannedDepartureDate: "2027-02-01", ticketStatus: "CONFIRMED" as const };
      const group = await repository.createTravelGroup({ applicationId: Number(application.insertId), group: groupInput, reason: "Synthetic trip",
        actorReference: "customer:synthetic", idempotencyKey: `group-${runId}`, occurredAt: new Date() });
      expect(group).toMatchObject({ version: 1, replayed: false });
      expect(await repository.createTravelGroup({ applicationId: Number(application.insertId), group: groupInput, reason: "Synthetic trip",
        actorReference: "customer:synthetic", idempotencyKey: `group-${runId}`, occurredAt: new Date() })).toEqual({ ...group, replayed: true });
      const updatedGroup = await repository.updateTravelGroup({ applicationId: Number(application.insertId), travelGroupId: group.travelGroupId,
        expectedVersion: 1, group: { ...groupInput, arrangement: "SEPARATELY", reference: "Trip B" }, reason: "Synthetic update",
        actorReference: "customer:synthetic", idempotencyKey: `group-update-${runId}`, occurredAt: new Date() });
      expect(updatedGroup).toMatchObject({ version: 2, replayed: false });
      await expect(repository.updateTravelGroup({ applicationId: Number(application.insertId), travelGroupId: group.travelGroupId,
        expectedVersion: 1, group: groupInput, reason: "Stale", actorReference: "customer:synthetic",
        idempotencyKey: `group-stale-${runId}`, occurredAt: new Date() })).rejects.toThrow("CUSTOMER_TRAVEL_GROUP_VERSION_CONFLICT");
      await expect(repository.createTravelGroup({ applicationId: Number(otherApplication.insertId), group: groupInput, reason: "Cross application",
        actorReference: "customer:synthetic", idempotencyKey: `group-cross-${runId}`, occurredAt: new Date() }))
        .rejects.toThrow("CUSTOMER_TRAVEL_GROUP_APPLICANT_OWNERSHIP_INVALID");
      const [document] = await pool.execute<ResultSetHeader>(`INSERT INTO documents
        (application_id,applicant_id,document_type,original_file_name,stored_file_name,mime_type,file_size,storage_path,upload_status)
        VALUES (?,?,'supporting','synthetic.pdf','synthetic.pdf','application/pdf',10,'synthetic/write/path','uploaded')`,
      [application.insertId, created.applicantId]);
      const linked = await repository.linkSharedDocument({ applicationId: Number(application.insertId), documentId: Number(document.insertId),
        documentType: "FAMILY_BOOKING", applicantIds: [created.applicantId, child.applicantId], actorReference: "customer:synthetic",
        idempotencyKey: `document-${runId}`, occurredAt: new Date() });
      expect(linked).toMatchObject({ linkedApplicantIds: [created.applicantId, child.applicantId], replayed: false });
      expect(await repository.linkSharedDocument({ applicationId: Number(application.insertId), documentId: Number(document.insertId),
        documentType: "FAMILY_BOOKING", applicantIds: [created.applicantId, child.applicantId], actorReference: "customer:synthetic",
        idempotencyKey: `document-${runId}`, occurredAt: new Date() })).toEqual({ ...linked, replayed: true });
      await expect(repository.linkSharedDocument({ applicationId: Number(otherApplication.insertId), documentId: Number(document.insertId),
        documentType: "FAMILY_BOOKING", applicantIds: [created.applicantId], actorReference: "customer:synthetic",
        idempotencyKey: `document-cross-${runId}`, occurredAt: new Date() })).rejects.toThrow("CUSTOMER_SHARED_DOCUMENT_OWNERSHIP_INVALID");
      const [evidence] = await pool.execute<RowDataPacket[]>("SELECT event_type AS eventType,profile_version AS profileVersion FROM customer_interview_profile_events WHERE application_id=? ORDER BY profile_version", [application.insertId]);
      expect(evidence).toHaveLength(3);
    } finally { await pool.end(); }
  });
});
