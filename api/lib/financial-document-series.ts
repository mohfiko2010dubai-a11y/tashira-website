import { createHash } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export type DocumentSeries = "TSH" | "TSH-CN" | "TEST" | "TEST-CN";

export function documentSeries(kind: "invoice" | "credit-note", isTest: boolean): DocumentSeries {
  return `${isTest ? "TEST" : "TSH"}${kind === "credit-note" ? "-CN" : ""}`;
}

export function documentYear(issuedAt: Date): number {
  if (!Number.isFinite(issuedAt.getTime())) throw new Error("Invalid document issue date");
  return Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Dubai" }).format(issuedAt));
}

export function documentNumber(series: DocumentSeries, year: number, sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 99999) throw new Error("Financial document series exhausted");
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new Error("Invalid document year");
  return `${series}-${year}-${String(sequence).padStart(5, "0")}`;
}

/** Caller holds the application's row lock in the SAME transaction as payment confirmation.
 * Rendered bytes are committed with the counter and snapshot; a failure consumes no number.
 * Credit notes require their own confirmed-refund issuance key, never the invoice key.
 */
export async function issueFinancialDocument(connection: PoolConnection, input: {
  applicationId: number; paymentId: number; issuanceKey: string; kind: "invoice" | "credit-note";
  isTest: boolean; issuedAt: Date; snapshot: Record<string, unknown>;
  render: (number: string, issuedAt: Date) => Buffer;
}) {
  const [prior] = await connection.execute<RowDataPacket[]>(
    "SELECT document_number, application_id, payment_id, pdf_sha256 FROM financial_document_archives WHERE issuance_key=?", [input.issuanceKey]);
  if (prior[0]) {
    if (Number(prior[0].application_id) !== input.applicationId || Number(prior[0].payment_id) !== input.paymentId) throw new Error("Document issuance identity mismatch");
    return { number: String(prior[0].document_number), sha256: String(prior[0].pdf_sha256), replay: true };
  }
  const series = documentSeries(input.kind, input.isTest), year = documentYear(input.issuedAt);
  await connection.execute("INSERT INTO financial_document_counters (series,document_year,last_number) VALUES (?,?,0) ON DUPLICATE KEY UPDATE last_number=last_number", [series, year]);
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT last_number FROM financial_document_counters WHERE series=? AND document_year=? FOR UPDATE", [series, year]);
  const sequence = Number(rows[0].last_number) + 1;
  const number = documentNumber(series, year, sequence);
  const pdf = input.render(number, input.issuedAt);
  if (pdf.subarray(0, 4).toString() !== "%PDF" || pdf.length > 20 * 1024 * 1024) throw new Error("Invalid financial document archive");
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  await connection.execute("INSERT INTO financial_document_archives (document_number,issuance_key,application_id,payment_id,series,document_year,sequence_number,issued_at,snapshot_json,pdf_bytes,pdf_sha256) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [number, input.issuanceKey, input.applicationId, input.paymentId, series, year, sequence, input.issuedAt, JSON.stringify(input.snapshot), pdf, sha256]);
  await connection.execute("UPDATE financial_document_counters SET last_number=? WHERE series=? AND document_year=?", [sequence, series, year]);
  return { number, sha256, replay: false };
}
