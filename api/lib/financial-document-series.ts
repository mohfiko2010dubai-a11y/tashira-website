import { createHash } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export type DocumentSeries = "TSH-INV" | "TSH-CN" | "TEST-INV" | "TEST-CN";

export function documentSeries(kind: "invoice" | "credit-note", isTest: boolean): DocumentSeries {
  return `${isTest ? "TEST" : "TSH"}-${kind === "credit-note" ? "CN" : "INV"}`;
}

export function documentNumber(series: DocumentSeries, sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("Invalid financial document sequence");
  const result = `${series}-${String(sequence).padStart(5, "0")}`;
  if (result.length > 21) throw new Error("Financial document series exhausted");
  return result;
}

/** Run inside one transaction before enabling issuance. Original issued documents stay unchanged. */
export async function registerLegacyInvoices(connection: PoolConnection, invoices: readonly {
  applicationId: number; paymentId: number; orderReference: string; number: string;
  issuedAt: Date; pdf: Buffer;
}[]) {
  if (invoices.length !== 2 || new Set(invoices.map(x => x.applicationId)).size !== 2 ||
      new Set(invoices.map(x => x.paymentId)).size !== 2 || new Set(invoices.map(x => x.number)).size !== 2) {
    throw new Error("Exactly two distinct approved legacy invoices are required");
  }
  for (const invoice of invoices) {
    if (!Number.isSafeInteger(invoice.applicationId) || invoice.applicationId < 1 ||
        !Number.isSafeInteger(invoice.paymentId) || invoice.paymentId < 1 ||
        !invoice.orderReference || !invoice.number || invoice.number.length > 50 ||
        !Number.isFinite(invoice.issuedAt.getTime()) || invoice.pdf.subarray(0, 4).toString() !== "%PDF" ||
        invoice.pdf.length > 20 * 1024 * 1024) throw new Error("Invalid legacy invoice evidence");
  }
  await connection.execute("INSERT INTO financial_document_counters (series,last_number) VALUES ('TSH-INV',0) ON DUPLICATE KEY UPDATE last_number=last_number");
  const [counter] = await connection.execute<RowDataPacket[]>("SELECT last_number FROM financial_document_counters WHERE series='TSH-INV' FOR UPDATE");
  const [existing] = await connection.execute<RowDataPacket[]>("SELECT document_number,application_id,payment_id,issuance_key,sequence_number,pdf_sha256,snapshot_json FROM financial_document_archives WHERE series='TSH-INV' AND sequence_number<=2 ORDER BY sequence_number");
  if (existing.length) {
    if (existing.length !== 2 || Number(counter[0].last_number) < 2) throw new Error("Incomplete legacy invoice mapping");
    invoices.forEach((invoice, index) => {
      const row = existing[index];
      const snapshot = JSON.parse(String(row.snapshot_json));
      if (row.document_number !== invoice.number || Number(row.application_id) !== invoice.applicationId ||
          Number(row.payment_id) !== invoice.paymentId || row.issuance_key !== `payment:${invoice.paymentId}` ||
          Number(row.sequence_number) !== index + 1 || snapshot.origin !== "legacy-issued-before-series" ||
          snapshot.orderReference !== invoice.orderReference || snapshot.originalIssuedAt !== invoice.issuedAt.toISOString() ||
          row.pdf_sha256 !== createHash("sha256").update(invoice.pdf).digest("hex")) throw new Error("Legacy invoice mapping differs from approved evidence");
    });
    return { replay: true };
  }
  if (Number(counter[0].last_number) !== 0) throw new Error("Cannot import legacy invoices after numbering has started");
  for (const [index, invoice] of invoices.entries()) {
    const snapshot = { origin: "legacy-issued-before-series", originalInvoiceNumber: invoice.number,
      orderReference: invoice.orderReference, originalIssuedAt: invoice.issuedAt.toISOString(), seriesPosition: index + 1 };
    await connection.execute("INSERT INTO financial_document_archives (document_number,issuance_key,application_id,payment_id,series,sequence_number,issued_at,snapshot_json,pdf_bytes,pdf_sha256) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [invoice.number, `payment:${invoice.paymentId}`, invoice.applicationId, invoice.paymentId, "TSH-INV", index + 1,
        invoice.issuedAt, JSON.stringify(snapshot), invoice.pdf, createHash("sha256").update(invoice.pdf).digest("hex")]);
  }
  await connection.execute("UPDATE financial_document_counters SET last_number=2 WHERE series='TSH-INV'");
  return { replay: false };
}

type DocumentInput = {
  applicationId: number; paymentId: number; issuanceKey: string; kind: "invoice" | "credit-note";
  isTest: boolean; issuedAt: Date; snapshot: Record<string, unknown>;
  render: (number: string, issuedAt: Date) => Buffer;
};
export class DocumentNumberChanged extends Error {}
export class FinancialFinalizationPending extends Error {}

export function retryableFinancialConflict(error: unknown): boolean {
  let cause = error;
  for (let depth = 0; depth < 5 && cause && typeof cause === "object"; depth++) {
    if (cause instanceof DocumentNumberChanged) return true;
    if ("code" in cause && (cause.code === "ER_LOCK_DEADLOCK" || cause.code === "ER_LOCK_WAIT_TIMEOUT")) return true;
    cause = "cause" in cause ? cause.cause : undefined;
  }
  return false;
}

/** No transaction or lock: the candidate number is advisory until commit validates it. */
export async function prepareFinancialDocument(pool: Pick<Pool, "execute">, input: DocumentInput) {
  if (!Number.isFinite(input.issuedAt.getTime())) throw new Error("Invalid document issue date");
  const series = documentSeries(input.kind, input.isTest);
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT last_number FROM financial_document_counters WHERE series=?", [series]);
  const sequence = Number(rows[0]?.last_number ?? 0) + 1;
  const number = documentNumber(series, sequence);
  const pdf = input.render(number, input.issuedAt);
  if (pdf.subarray(0, 4).toString() !== "%PDF" || pdf.length > 20 * 1024 * 1024) throw new Error("Invalid financial document archive");
  return { applicationId: input.applicationId, paymentId: input.paymentId, issuanceKey: input.issuanceKey,
    issuedAt: input.issuedAt, series, sequence, number, pdf,
    sha256: createHash("sha256").update(pdf).digest("hex"), snapshotJson: JSON.stringify(input.snapshot) };
}
export type PreparedFinancialDocument = Awaited<ReturnType<typeof prepareFinancialDocument>>;

/** SQL only. Caller owns the application's lock and transaction; stale candidates roll back. */
export async function issueFinancialDocument(connection: PoolConnection, input: PreparedFinancialDocument) {
  const [prior] = await connection.execute<RowDataPacket[]>(
    "SELECT document_number, application_id, payment_id, pdf_sha256 FROM financial_document_archives WHERE issuance_key=?", [input.issuanceKey]);
  if (prior[0]) {
    if (Number(prior[0].application_id) !== input.applicationId || Number(prior[0].payment_id) !== input.paymentId) throw new Error("Document issuance identity mismatch");
    return { number: String(prior[0].document_number), sha256: String(prior[0].pdf_sha256), replay: true };
  }
  const { series, sequence, number, pdf, sha256 } = input;
  await connection.execute("INSERT INTO financial_document_counters (series,last_number) VALUES (?,0) ON DUPLICATE KEY UPDATE last_number=last_number", [series]);
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT last_number FROM financial_document_counters WHERE series=? FOR UPDATE", [series]);
  if (Number(rows[0].last_number) + 1 !== sequence) throw new DocumentNumberChanged("Financial document candidate changed; retry outside transaction");
  await connection.execute("INSERT INTO financial_document_archives (document_number,issuance_key,application_id,payment_id,series,sequence_number,issued_at,snapshot_json,pdf_bytes,pdf_sha256) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [number, input.issuanceKey, input.applicationId, input.paymentId, series, sequence, input.issuedAt, input.snapshotJson, pdf, sha256]);
  await connection.execute("UPDATE financial_document_counters SET last_number=? WHERE series=?", [sequence, series]);
  return { number, sha256, replay: false };
}
