import { createHash } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { defaultOperationsPool } from "./operations/mysql-query-client";
import { generateInvoicePDF, type InvoiceData } from "./invoice-pdf";
import { issueFinancialDocument, prepareFinancialDocument, type PreparedFinancialDocument } from "./financial-document-series";

export type InvoiceIssueData = { data: Omit<InvoiceData, "invoiceNumber" | "createdAt">; isTest: boolean; vatRate: string };

export async function preparePaidInvoice(applicationId: number, paymentId: number, input: InvoiceIssueData) {
  const document = await prepareFinancialDocument(defaultOperationsPool(), { applicationId, paymentId, issuanceKey: `payment:${paymentId}`,
    kind: "invoice", isTest: input.isTest, issuedAt: new Date(), snapshot: { ...input.data, vatRate: input.vatRate },
    render: (invoiceNumber, date) => Buffer.from(generateInvoicePDF({ ...input.data, invoiceNumber, createdAt: date.toISOString() }).output("arraybuffer")),
  });
  return { document, settingsVersion: input.data.company.version, amount: input.data.totalAmount.toFixed(2), vatRate: input.vatRate };
}

export async function issuePaidInvoice(connection: PoolConnection, applicationId: number, paymentId: number,
  input?: { document: PreparedFinancialDocument; settingsVersion: number; amount: string; vatRate: string }) {
  const [existing] = await connection.execute<RowDataPacket[]>("SELECT invoice_number,payment_id FROM invoices WHERE application_id=? ORDER BY id LIMIT 1", [applicationId]);
  if (existing[0]) {
    if (Number(existing[0].payment_id) !== paymentId) throw new Error("Issued invoice belongs to another payment");
    return String(existing[0].invoice_number); // Preserve already-issued legacy documents.
  }
  if (!input) throw new Error("Verified invoice snapshot is required before confirming payment");
  if (input.document.applicationId !== applicationId || input.document.paymentId !== paymentId) throw new Error("Prepared invoice identity mismatch");
  const issued = await issueFinancialDocument(connection, input.document);
  await connection.execute("INSERT INTO invoices (invoice_number,application_id,payment_id,amount,vat_rate,pdf_path,business_settings_version) VALUES (?,?,?,?,?,?,?)",
    [issued.number, applicationId, paymentId, input.amount, input.vatRate, `archive:${issued.number}`, input.settingsVersion]);
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

export async function archivedDocumentApplicationId(number: string): Promise<number | null> {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(
    "SELECT application_id FROM financial_document_archives WHERE document_number=?", [number]);
  return rows[0] ? Number(rows[0].application_id) : null;
}
