import { createHash } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { documentNumber, type DocumentSeries } from "./financial-document-series";

const seriesNames: readonly DocumentSeries[] = ["TSH-INV", "TSH-CN", "TEST-INV", "TEST-CN"];

export function verifySeriesPosition(series: string, counter: number, sequences: readonly number[]) {
  if (!seriesNames.includes(series as DocumentSeries) || !Number.isSafeInteger(counter) || counter < 0 ||
      sequences.length !== counter || sequences.some((value, index) => value !== index + 1)) {
    throw new Error(`Financial series is inconsistent: ${series}`);
  }
}

export function verifyFinancialArchive(row: {
  series: DocumentSeries; sequence: number; number: string; pdf: Buffer; sha256: string;
}) {
  if (row.number !== documentNumber(row.series, row.sequence) || row.pdf.subarray(0, 4).toString() !== "%PDF" ||
      createHash("sha256").update(row.pdf).digest("hex") !== row.sha256) {
    throw new Error(`Financial archive is inconsistent: ${row.series}:${row.sequence}`);
  }
}

/** A consistent read snapshot; no locks, writes or document contents in logs. */
export async function assertFinancialDocumentIntegrity(pool: Pool, testRuntime = false) {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    const [counters] = await connection.query<RowDataPacket[]>("SELECT series,last_number FROM financial_document_counters");
    const [documents] = await connection.query<RowDataPacket[]>(
      "SELECT series,sequence_number,document_number FROM financial_document_archives ORDER BY series,sequence_number");
    for (const row of [...counters, ...documents]) {
      if (!seriesNames.includes(row.series)) throw new Error("Unknown financial series");
    }
    for (const series of seriesNames) {
      const entries = documents.filter(row => row.series === series);
      const counter = counters.find(row => row.series === series);
      if (!counter && entries.length) throw new Error(`Missing financial counter: ${series}`);
      verifySeriesPosition(series, Number(counter?.last_number ?? 0), entries.map(row => Number(row.sequence_number)));
      // Read one PDF at a time rather than loading the entire archive into memory.
      for (const entry of entries) {
        const [rows] = await connection.execute<RowDataPacket[]>(
          "SELECT pdf_bytes,pdf_sha256 FROM financial_document_archives WHERE document_number=?", [entry.document_number]);
        verifyFinancialArchive({ series, sequence: Number(entry.sequence_number), number: entry.document_number,
          pdf: Buffer.from(rows[0].pdf_bytes), sha256: rows[0].pdf_sha256 });
      }
    }
    const [orphaned] = await connection.query<RowDataPacket[]>(
      `SELECT i.id FROM invoices i LEFT JOIN financial_document_archives a ON a.document_number=i.invoice_number
       WHERE (${testRuntime ? "i.invoice_number LIKE 'TSH-INV-%' OR i.invoice_number LIKE 'TEST-INV-%'" : "1=1"})
       AND (a.document_number IS NULL OR a.application_id<>i.application_id OR a.payment_id<>i.payment_id) LIMIT 1`);
    if (orphaned.length) throw new Error("Invoice has no matching financial archive");
    const [missingInvoices] = await connection.query<RowDataPacket[]>(
      `SELECT a.document_number FROM financial_document_archives a LEFT JOIN invoices i ON i.invoice_number=a.document_number
       WHERE a.series IN ('TSH-INV','TEST-INV') AND (i.id IS NULL OR a.application_id<>i.application_id OR a.payment_id<>i.payment_id) LIMIT 1`);
    if (missingInvoices.length) throw new Error("Financial archive has no matching invoice");
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
