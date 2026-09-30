import { TRPCError } from "@trpc/server";
import type { RowDataPacket } from "mysql2/promise";
import { defaultOperationsPool } from "./operations/mysql-query-client";

export type ProductAvailability = { serviceCode: string; isActive: boolean; lastVerifiedAt: string | null; verificationSource: string | null; version: number; verificationDue: boolean };
export function verificationDue(lastVerifiedAt: Date | null, now = new Date()) {
  return !lastVerifiedAt || now.getTime() - lastVerifiedAt.getTime() > 90 * 24 * 60 * 60 * 1000;
}
export async function productAvailability(): Promise<ProductAvailability[]> {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>("SELECT service_code,is_active,last_verified_at,verification_source,version FROM visa_product_availability ORDER BY service_code");
  return rows.map(row => ({ serviceCode: String(row.service_code), isActive: Boolean(row.is_active),
    lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at).toISOString() : null,
    verificationSource: row.verification_source ? String(row.verification_source) : null,
    version: Number(row.version), verificationDue: verificationDue(row.last_verified_at ? new Date(row.last_verified_at) : null) }));
}
export async function assertProductAvailable(serviceCode: string) {
  const product = (await productAvailability()).find(row => row.serviceCode === serviceCode);
  if (!product?.isActive) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "We are not offering this visa at the moment. Choose an available visa or contact us. / هذه التأشيرة غير متاحة لدينا حاليًا. اختر تأشيرة متاحة أو تواصل معنا." });
}
export async function updateProductAvailability(input: { serviceCode: string; expectedVersion: number; isActive: boolean; verificationSource?: string }, actor: string) {
  const connection = await defaultOperationsPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT version,last_verified_at,verification_source FROM visa_product_availability WHERE service_code=? FOR UPDATE", [input.serviceCode]);
    if (!rows[0] || Number(rows[0].version) !== input.expectedVersion) throw new TRPCError({ code: "CONFLICT", message: "Product changed. Refresh the catalog and try again." });
    const verifiedAt = input.verificationSource ? new Date() : rows[0].last_verified_at;
    const source = input.verificationSource ?? rows[0].verification_source;
    await connection.execute("UPDATE visa_product_availability SET is_active=?,last_verified_at=?,verification_source=?,version=version+1,updated_at=NOW(3) WHERE service_code=?", [input.isActive, verifiedAt, source, input.serviceCode]);
    await connection.execute("INSERT INTO visa_product_availability_audit (service_code,is_active,last_verified_at,verification_source,actor) VALUES (?,?,?,?,?)", [input.serviceCode, input.isActive, verifiedAt, source, actor]);
    await connection.commit();
    return { updated: true };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
