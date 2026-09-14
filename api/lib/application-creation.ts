import { createHash, randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../context";
import { defaultOperationsPool } from "./operations/mysql-query-client";
import { creationDeviceOwner, issueCreationDevice } from "./creation-device";
import { createCustomerApplicationCookie } from "./customer-session";

export type CreationFlow = "FORM" | "CHAT" | "LEGACY";
export async function prepareApplicationCreation(ctx: TrpcContext, flow: CreationFlow, startNew: boolean) {
  let owner = creationDeviceOwner(ctx.req.headers);
  if (!owner) { const issued = issueCreationDevice(ctx.req.headers); owner = issued.owner; ctx.resHeaders.append("set-cookie", issued.cookie); }
  const connection = await defaultOperationsPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("INSERT IGNORE INTO application_creation_devices (owner_hash) VALUES (?)", [owner]);
    await connection.execute("SELECT owner_hash FROM application_creation_devices WHERE owner_hash=? FOR UPDATE", [owner]);
    const [previous] = await connection.execute<RowDataPacket[]>("SELECT id,reference_number,application_id FROM application_creation_requests WHERE owner_hash=? AND flow=? ORDER BY sequence DESC LIMIT 1", [owner, flow]);
    if (!startNew && previous[0]) {
      await connection.commit();
      if (previous[0].application_id) ctx.resHeaders.append("set-cookie", createCustomerApplicationCookie(ctx.req.headers, String(previous[0].reference_number)));
      return { requestKey: String(previous[0].id), referenceNumber: previous[0].application_id ? String(previous[0].reference_number) : null };
    }
    const requestKey = randomUUID();
    const referenceNumber = "TSH-" + randomUUID().replaceAll("-", "").toUpperCase();
    await connection.execute("INSERT INTO application_creation_requests (id,owner_hash,flow,reference_number) VALUES (?,?,?,?)", [requestKey, owner, flow, referenceNumber]);
    await connection.commit();
    return { requestKey, referenceNumber: null };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function withApplicationCreation(ctx: TrpcContext, requestKey: string, flows: readonly CreationFlow[], payload: unknown,
  create: (connection: PoolConnection, referenceNumber: string) => Promise<{ applicationId: number; applicantIds: number[] }>) {
  const owner = creationDeviceOwner(ctx.req.headers);
  if (!owner) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your creation session is unavailable. Reopen the form and try again." });
  const connection = await defaultOperationsPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT owner_hash,flow,reference_number,application_id,payload_hash FROM application_creation_requests WHERE id=? FOR UPDATE", [requestKey]);
    const request = rows[0];
    if (!request || request.owner_hash !== owner || !flows.includes(request.flow)) throw new TRPCError({ code: "FORBIDDEN", message: "This creation request is not available. Reopen your application form." });
    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    if (request.payload_hash && request.payload_hash !== payloadHash) throw new TRPCError({ code: "CONFLICT", message: "This action already started an application. Resume it or select Start another application." });
    const referenceNumber = String(request.reference_number);
    if (request.application_id) {
      const [members] = await connection.execute<RowDataPacket[]>("SELECT id FROM applicants WHERE application_id=? ORDER BY applicant_index", [request.application_id]);
      await connection.commit();
      return { applicationId: Number(request.application_id), referenceNumber, applicantIds: members.map(row => Number(row.id)) };
    }
    const result = await create(connection, referenceNumber);
    await connection.execute("UPDATE application_creation_requests SET application_id=?,payload_hash=? WHERE id=?", [result.applicationId, payloadHash, requestKey]);
    await connection.commit();
    return { ...result, referenceNumber };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
