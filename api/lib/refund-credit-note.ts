import { jsPDF } from "jspdf";
import type { RowDataPacket } from "mysql2/promise";
import { defaultOperationsPool } from "./operations/mysql-query-client";
import { withCheckoutLock } from "./checkout-quote";
import { prepareFinancialDocument, issueFinancialDocument, retryableFinancialConflict, FinancialFinalizationPending } from "./financial-document-series";
import { stripeRuntimeMode } from "./stripe-runtime";
import type { StripeRefundResult } from "./stripe";

export function validateConfirmedRefund(refund: StripeRefundResult, expected: { intent: string; amount: string; currency: string }) {
  if (refund.status !== "succeeded" || refund.payment_intent !== expected.intent ||
      refund.amount !== Math.round(Number(expected.amount) * 100) || refund.currency.toUpperCase() !== expected.currency.toUpperCase()) {
    throw new Error("Confirmed refund does not match its stored payment, amount and currency");
  }
}

/** Called only after Stripe verification. Rendering is outside the SQL transaction. */
export async function completeVisaRefundWithCreditNote(itemId: string, refund: StripeRefundResult) {
  const pool = defaultOperationsPool();
  for (let attempt = 0; ; attempt++) {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT r.refund_amount,r.currency,r.payment_id,c.application_id,
      p.stripe_payment_intent_id,a.is_test,a.reference_number,i.invoice_number
      FROM refund_items r JOIN refund_cases c ON c.id=r.refund_case_id
      JOIN payments p ON p.id=r.payment_id AND p.application_id=c.application_id
      JOIN applications a ON a.id=c.application_id JOIN invoices i ON i.application_id=a.id AND i.payment_id=p.id
      WHERE r.id=? AND r.refund_source_type='VISA_SERVICE'`, [itemId]);
    if (rows.length !== 1) throw new Error("Issued invoice is required for the refund credit note");
    const row = rows[0];
    validateConfirmedRefund(refund, { intent: String(row.stripe_payment_intent_id), amount: String(row.refund_amount), currency: String(row.currency) });
    const prepared = await prepareFinancialDocument(pool, {
      applicationId: Number(row.application_id), paymentId: Number(row.payment_id), issuanceKey: `refund:${refund.id}`,
      kind: "credit-note", isTest: Boolean(row.is_test) || stripeRuntimeMode() === "TEST", issuedAt: new Date(),
      snapshot: { originalInvoiceNumber: row.invoice_number, referenceNumber: row.reference_number, refundItemId: itemId,
        stripeRefundId: refund.id, amount: row.refund_amount, currency: row.currency, reason: "Confirmed service refund" },
      render: (number, date) => {
        const pdf = new jsPDF();
        pdf.setFontSize(20); pdf.text("TASHIRA - Credit Note", 20, 25);
        pdf.setFontSize(11);
        const lines = [`Credit note: ${number}`, `Issued: ${date.toISOString()}`, `Original invoice: ${row.invoice_number}`,
          `Application: ${row.reference_number}`, `Refunded: ${row.currency} ${Number(row.refund_amount).toFixed(2)}`,
          `Stripe refund: ${refund.id}`, "This credit note records a confirmed refund against the original invoice."];
        lines.forEach((line, index) => pdf.text(line, 20, 45 + index * 10));
        return Buffer.from(pdf.output("arraybuffer"));
      },
    });
    try {
      return await withCheckoutLock(Number(row.application_id), async connection => {
        const [locked] = await connection.execute<RowDataPacket[]>(`SELECT refund_item_status,stripe_refund_id,refund_amount,currency,payment_id
          FROM refund_items WHERE id=? FOR UPDATE`, [itemId]);
        const current = locked[0];
        if (!current || !["PROCESSING", "SUCCEEDED"].includes(String(current.refund_item_status)) ||
            Number(current.payment_id) !== Number(row.payment_id) || String(current.refund_amount) !== String(row.refund_amount) ||
            String(current.currency) !== String(row.currency) || (current.stripe_refund_id && current.stripe_refund_id !== refund.id)) {
          throw new Error("Refund changed while preparing its credit note");
        }
        const note = await issueFinancialDocument(connection, prepared);
        await connection.execute("UPDATE refund_items SET refund_item_status='SUCCEEDED',stripe_refund_id=?,failure_category=NULL WHERE id=?", [refund.id, itemId]);
        return { number: note.number, changed: current.refund_item_status !== "SUCCEEDED" };
      }, 2);
    } catch (error) {
      if (!retryableFinancialConflict(error)) throw error;
      if (attempt >= 31) throw new FinancialFinalizationPending("Refund credit note is awaiting accounting confirmation");
      await new Promise(resolve => setTimeout(resolve, Math.min(500, 25 * (attempt + 1)) + Math.random() * 50));
    }
  }
}
