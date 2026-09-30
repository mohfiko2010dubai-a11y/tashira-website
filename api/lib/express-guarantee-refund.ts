import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { applicationTimelineEvents, financialEvents, refundCases, refundItems } from "../../db/schema";
import { PROCESSING_GUARANTEE_VERSION, submissionBreached, submissionDeadline } from "../../contracts/processing-guarantee";
import { withCheckoutLock } from "./checkout-quote";
import { defaultOperationsPool } from "./operations/mysql-query-client";

const date = (value: unknown) => value === null || value === undefined ? null : new Date(Number(value) * 1000);
const guaranteeSelect = `SELECT a.id,a.reference_number,a.processing_type,a.payment_status,
  UNIX_TIMESTAMP(c.documents_completed_at) AS documents_completed_at,UNIX_TIMESTAMP(c.authority_submitted_at) AS authority_submitted_at,c.express_refund_case_id,
  q.quote_json FROM applications a LEFT JOIN application_service_clocks c ON c.application_id=a.id
  LEFT JOIN checkout_payment_attempts attempt ON attempt.application_id=a.id
  LEFT JOIN checkout_quote_revisions q ON q.id=attempt.quote_id`;

export async function processingGuarantees(applicationId?: number) {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(guaranteeSelect + (applicationId ? " WHERE a.id=?" : " WHERE a.payment_status='paid' AND a.processing_type='express'") + " ORDER BY c.documents_completed_at,a.id", applicationId ? [applicationId] : []);
  return rows.map(row => {
    const quote = typeof row.quote_json === "string" ? JSON.parse(row.quote_json) : row.quote_json;
    const completed = date(row.documents_completed_at), submitted = date(row.authority_submitted_at);
    const express = row.processing_type === "express";
    const covered = quote?.processingGuaranteeVersion === PROCESSING_GUARANTEE_VERSION;
    return { applicationId: Number(row.id), referenceNumber: String(row.reference_number), express, covered,
      documentsCompletedAt: completed?.toISOString() ?? null, submittedAt: submitted?.toISOString() ?? null,
      deadline: completed ? submissionDeadline(completed, express).toISOString() : null,
      breached: covered && submissionBreached(completed, submitted, express),
      expressFee: covered ? Number(quote.expressFeeTotal ?? 0) : null, currency: String(quote?.currency ?? "USD"),
      paid: row.payment_status === "paid", refundCaseId: row.express_refund_case_id ? String(row.express_refund_case_id) : null };
  });
}

/** No editable amount/deduction: refund precisely the frozen paid Express component. */
export async function createExpressGuaranteeRefund(applicationId: number, actor: string) {
  return withCheckoutLock(applicationId, connection => prepareExpressGuaranteeRefund(connection, applicationId, actor));
}

/** Transactional command; caller holds the application lock. */
export async function prepareExpressGuaranteeRefund(connection: PoolConnection, applicationId: number, actor: string) {
    const [rows] = await connection.execute<RowDataPacket[]>(guaranteeSelect + " WHERE a.id=?", [applicationId]);
    const row = rows[0];
    if (row?.express_refund_case_id) return { refundCaseId: String(row.express_refund_case_id), replayed: true };
    const quote = typeof row?.quote_json === "string" ? JSON.parse(row.quote_json) : row?.quote_json;
    const fee = Number(quote?.expressFeeTotal);
    if (row?.payment_status !== "paid" || row.processing_type !== "express" || quote?.processingGuaranteeVersion !== PROCESSING_GUARANTEE_VERSION || !Number.isFinite(fee) || fee <= 0 || !submissionBreached(date(row.documents_completed_at), date(row.authority_submitted_at), true)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This order has no overdue paid Express guarantee. Check its timestamps and payment before requesting a refund." });
    }
    const [paid] = await connection.execute<RowDataPacket[]>(`SELECT p.id,p.amount,p.currency FROM payments p JOIN checkout_payment_attempts a
      ON a.application_id=p.application_id AND a.stripe_payment_intent_id=p.stripe_payment_intent_id
      WHERE p.application_id=? AND p.status='succeeded' FOR UPDATE`, [applicationId]);
    if (paid.length !== 1 || String(paid[0].currency).toUpperCase() !== String(quote.currency).toUpperCase() || Math.round(Number(paid[0].amount) * 100) !== Math.round(Number(quote.totalPrice) * 100)) throw new Error("Paid quote is unavailable for Express refund");
    const payment = paid[0];
    const [reserved] = await connection.execute<RowDataPacket[]>("SELECT COALESCE(SUM(refund_amount),0) total FROM refund_items WHERE payment_id=? AND refund_item_status IN ('PENDING','PROCESSING','SUCCEEDED')", [payment.id]);
    if (Math.round((Number(payment.amount) - Number(reserved[0].total)) * 100) < Math.round(fee * 100)) throw new TRPCError({ code: "CONFLICT", message: "An existing refund already reserves these funds. Review that refund before continuing." });
    const id = randomUUID(), db = drizzle(connection), amount = fee.toFixed(2), currency = String(payment.currency).toUpperCase();
    await db.insert(refundCases).values({ id, applicationId, status: "PENDING_APPROVAL", reason: "Express submission exceeded 24 continuous hours; refund the full paid Express component.", policyVersion: PROCESSING_GUARANTEE_VERSION, requestedBy: actor });
    await db.insert(refundItems).values({ id: randomUUID(), refundCaseId: id, sourceType: "VISA_SERVICE", paymentId: Number(payment.id), originalAmount: String(payment.amount), requestedAmount: amount,
      deductionType: "NONE", deductionValue: "0", refundAmount: amount, currency, idempotencyKey: `express-guarantee-${applicationId}-${PROCESSING_GUARANTEE_VERSION}` });
    await db.insert(financialEvents).values({ id: randomUUID(), applicationId, paymentId: Number(payment.id), eventType: "REFUND_REQUESTED", amount, currency, sourceReference: id, actorReference: actor });
    await db.insert(applicationTimelineEvents).values({ id: randomUUID(), applicationId, eventName: "REFUND_REQUESTED", eventSource: "EXPRESS_GUARANTEE", actorType: "ADMIN", actorReference: actor, resultingState: "PENDING_APPROVAL", summary: "Full Express fee refund requested after the submission guarantee deadline" });
    await connection.execute("UPDATE application_service_clocks SET express_refund_case_id=? WHERE application_id=?", [id, applicationId]);
    return { refundCaseId: id, replayed: false };
}
