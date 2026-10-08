import type { RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { withCheckoutLock } from "./checkout-quote";
import { prepareVisaChangeQuote, acceptVisaChangeQuote } from "./visa-change-quotes";

/** All writers use the application lock. A new proposal always invalidates old consent. */
export async function proposeSubmittedProduct(applicationId: number, product: string, actor: string, reason: string, requiredOwnerId?: number) {
  if (!reason.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Explain why the filing product must change." });
  return withCheckoutLock(applicationId, async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT status,visa_type,substitution_version FROM applications WHERE id=?", [applicationId]);
    if (!rows[0] || ["visa_processing", "visa_received", "completed", "cancelled", "rejected"].includes(rows[0].status)) throw new TRPCError({ code: "CONFLICT", message: "Cannot substitute a filed or closed product. Review the order status first." });
    if (requiredOwnerId !== undefined) {
      // Match the controlled writer's application -> assignment lock order. A
      // reassignment between middleware authorization and this write must fail.
      const [owners] = await connection.execute<RowDataPacket[]>("SELECT assigned_staff_user_id FROM operations_case_controls WHERE application_id=? FOR UPDATE", [applicationId]);
      if (Number(owners[0]?.assigned_staff_user_id) !== requiredOwnerId) throw new TRPCError({ code: 'FORBIDDEN', message: 'This request is no longer assigned to you. Refresh your work list.' });
    }
    const [products] = await connection.execute<RowDataPacket[]>("SELECT service_code FROM visa_product_availability WHERE service_code=? AND is_active=1", [product]);
    if (!products.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active catalogue product." });
    const version = Number(rows[0].substitution_version) + 1;
    await prepareVisaChangeQuote(connection, applicationId, version, product);
    await connection.execute("UPDATE applications SET submitted_product=?,submitted_reason=?,substitution_version=?,substitution_acknowledged_version=NULL,substitution_acknowledged_at=NULL WHERE id=?", [product, reason.trim(), version, applicationId]);
    await connection.execute("INSERT INTO product_substitution_events (application_id,version,product,action,actor,reason) VALUES (?,?,?,'PROPOSED',?,?)", [applicationId, version, product, actor, reason.trim()]);
    return { version };
  });
}

export async function acknowledgeSubmittedProduct(applicationId: number, version: number, quoteId?: string) {
  return withCheckoutLock(applicationId, async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT submitted_product,substitution_version,substitution_acknowledged_version FROM applications WHERE id=?", [applicationId]);
    if (!rows[0]?.submitted_product || Number(rows[0].substitution_version) !== version) throw new TRPCError({ code: "CONFLICT", message: "The proposal changed. Reload and review the current product before acknowledging." });
    await acceptVisaChangeQuote(connection, applicationId, version, quoteId);
    if (Number(rows[0].substitution_acknowledged_version) === version) return { acknowledged: true };
    await connection.execute("UPDATE applications SET substitution_acknowledged_version=?,substitution_acknowledged_at=NOW(3) WHERE id=?", [version, applicationId]);
    await connection.execute("INSERT INTO product_substitution_events (application_id,version,product,action,actor) VALUES (?,?,?,'ACKNOWLEDGED','CUSTOMER')", [applicationId, version, rows[0].submitted_product]);
    return { acknowledged: true };
  });
}
