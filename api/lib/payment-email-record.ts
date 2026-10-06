import type { RowDataPacket } from "mysql2/promise";
import { defaultOperationsPool } from "./operations/mysql-query-client";

/** Resolve financial facts and recipient together; never accept a caller's email or total. */
export async function paymentEmailRecord(applicationId: number, paymentId: number) {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(`
    SELECT a.contact_email,a.reference_number,a.preferred_language,
      i.invoice_number,i.amount,i.pdf_path,p.currency,
      EXISTS(SELECT 1 FROM outbound_email_events e WHERE e.application_id=a.id
        AND e.template='PAYMENT_SUCCESS' AND e.status='SENT'
        AND (e.source_reference=CONCAT('payment:',p.id) OR
          (e.source_reference IS NULL AND i.id=(SELECT MIN(first_invoice.id)
            FROM invoices first_invoice WHERE first_invoice.application_id=a.id)))) AS already_sent
    FROM applications a JOIN payments p ON p.application_id=a.id
    JOIN invoices i ON i.payment_id=p.id AND i.application_id=a.id
    WHERE a.id=? AND p.id=? AND p.status='succeeded' AND i.amount=p.amount`, [applicationId, paymentId]);
  if (rows.length !== 1) throw new Error("A verified payment and its unique invoice are required before emailing");
  const row = rows[0];
  return {
    recipient: String(row.contact_email), referenceNumber: String(row.reference_number),
    language: row.preferred_language === "ar" ? "ar" : "en",
    invoiceNumber: String(row.invoice_number), amountPaid: Number(row.amount),
    currency: String(row.currency), invoicePdfPath: row.pdf_path ? String(row.pdf_path) : "",
    alreadySent: Number(row.already_sent) === 1,
  };
}
