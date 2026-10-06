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

/** A separate invoice for the verified additional payment; original invoice pointers stay unchanged. */
export async function issueVisaChangeInvoice(connection: PoolConnection, applicationId: number, paymentId: number,
  quoteId: string, input: Awaited<ReturnType<typeof preparePaidInvoice>>) {
  const [payments] = await connection.execute<RowDataPacket[]>(`SELECT p.amount,q.difference_minor FROM visa_change_quotes q
    JOIN payments p ON p.id=q.payment_id AND p.application_id=q.application_id
    WHERE q.id=? AND q.application_id=? AND p.id=? AND q.accepted_at IS NOT NULL
      AND q.state IN ('PAYMENT_PENDING','SETTLED') AND p.status='succeeded' AND UPPER(p.currency)=q.currency`, [quoteId, applicationId, paymentId]);
  const paid = payments[0];
  if (payments.length !== 1 || Number(paid.difference_minor) <= 0 || Math.round(Number(paid.amount) * 100) !== Number(paid.difference_minor)
    || input.amount !== Number(paid.amount).toFixed(2) || input.document.applicationId !== applicationId || input.document.paymentId !== paymentId) {
    throw new Error("Verified visa-change difference payment is required for its invoice");
  }
  const [existing] = await connection.execute<RowDataPacket[]>("SELECT invoice_number,amount FROM invoices WHERE application_id=? AND payment_id=?", [applicationId, paymentId]);
  if (existing.length > 1 || (existing[0] && Number(existing[0].amount) !== Number(paid.amount))) throw new Error("Visa-change invoice evidence does not match payment");
  if (existing[0]) return String(existing[0].invoice_number);
  const issued = await issueFinancialDocument(connection, input.document);
  await connection.execute("INSERT INTO invoices (invoice_number,application_id,payment_id,amount,vat_rate,pdf_path,business_settings_version) VALUES (?,?,?,?,?,?,?)",
    [issued.number, applicationId, paymentId, input.amount, input.vatRate, `archive:${issued.number}`, input.settingsVersion]);
  return issued.number;
}

export async function archivedDocumentApplicationId(number: string): Promise<number | null> {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(
    "SELECT application_id FROM financial_document_archives WHERE document_number=?", [number]);
  return rows[0] ? Number(rows[0].application_id) : null;
}
