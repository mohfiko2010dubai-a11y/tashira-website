import { createHash } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { defaultOperationsPool } from "./operations/mysql-query-client";
import { generateInvoicePDF, type InvoiceData } from "./invoice-pdf";
import { issueFinancialDocument } from "./financial-document-series";

export type InvoiceIssueData = { data: Omit<InvoiceData, "invoiceNumber" | "createdAt">; isTest: boolean; vatRate: string };

export async function issuePaidInvoice(connection: PoolConnection, applicationId: number, paymentId: number, input?: InvoiceIssueData) {
  const [existing] = await connection.execute<RowDataPacket[]>("SELECT invoice_number,payment_id FROM invoices WHERE application_id=? ORDER BY id LIMIT 1", [applicationId]);
  if (existing[0]) {
    if (Number(existing[0].payment_id) !== paymentId) throw new Error("Issued invoice belongs to another payment");
    return String(existing[0].invoice_number); // Preserve already-issued legacy documents.
  }
  if (!input) throw new Error("Verified invoice snapshot is required before confirming payment");
  const issuedAt = new Date();
  const issued = await issueFinancialDocument(connection, { applicationId, paymentId, issuanceKey: `payment:${paymentId}`,
    kind: "invoice", isTest: input.isTest, issuedAt, snapshot: { ...input.data, vatRate: input.vatRate },
    render: (invoiceNumber, date) => Buffer.from(generateInvoicePDF({ ...input.data, invoiceNumber, createdAt: date.toISOString() }).output("arraybuffer")),
  });
  await connection.execute("INSERT INTO invoices (invoice_number,application_id,payment_id,amount,vat_rate,pdf_path) VALUES (?,?,?,?,?,?)",
    [issued.number, applicationId, paymentId, input.data.totalAmount.toFixed(2), input.vatRate, `archive:${issued.number}`]);
  await connection.execute("UPDATE applications SET invoice_number=?,invoice_pdf_path=?,invoice_pdf_url=? WHERE id=?",
    [issued.number, `archive:${issued.number}`, `/invoices/${issued.number}/view`, applicationId]);
  return issued.number;
}

export async function readArchivedInvoice(number: string): Promise<Buffer | null> {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(
    "SELECT pdf_bytes,pdf_sha256 FROM financial_document_archives WHERE document_number=?", [number]);
  if (!rows[0]) return null;
  const bytes = Buffer.from(rows[0].pdf_bytes);
  if (createHash("sha256").update(bytes).digest("hex") !== rows[0].pdf_sha256) throw new Error("Financial archive integrity check failed");
  return bytes;
}
