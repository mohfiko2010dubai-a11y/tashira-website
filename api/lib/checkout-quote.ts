import { createHash, randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { quoteApplicationPrice, type PriceQuote } from "./pricing-engine";
import { defaultOperationsPool } from "./operations/mysql-query-client";

export type CheckoutQuote = { id: string; revision: number; contextHash: string; quote: PriceQuote; createdAt: Date };

export function sameCheckoutPrice(left: PriceQuote, right: PriceQuote) {
  return Object.keys(right).every(key => Reflect.get(left, key) === Reflect.get(right, key));
}

export function checkoutContextHash(input: { visaType: string; processingType: string; applicantIds: readonly number[] }) {
  return createHash("sha256").update(JSON.stringify({ ...input, applicantIds: [...input.applicantIds].sort((a, b) => a - b) })).digest("hex");
}

export function assertDisplayedQuote(current: CheckoutQuote, displayedId: string | undefined) {
  if (current.id !== displayedId) throw new TRPCError({ code: "CONFLICT",
    message: "Your application price has changed. Refresh the price, review the new total, and select Pay again." });
}

export async function withCheckoutLock<T>(applicationId: number, work: (connection: PoolConnection) => Promise<T>, lockWaitSeconds?: number): Promise<T> {
  const connection = await defaultOperationsPool().getConnection();
  let originalTimeout: number | undefined;
  try {
    if (lockWaitSeconds !== undefined) {
      if (!Number.isInteger(lockWaitSeconds) || lockWaitSeconds < 1 || lockWaitSeconds > 5) throw new Error("Invalid bounded lock wait");
      const [settings] = await connection.query<RowDataPacket[]>("SELECT @@SESSION.innodb_lock_wait_timeout AS seconds");
      originalTimeout = Number(settings[0].seconds);
      await connection.query("SET SESSION innodb_lock_wait_timeout=?", [lockWaitSeconds]);
    }
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [applicationId]);
    if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found. Reopen your saved application." });
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) { await connection.rollback(); throw error; } finally {
    let reusable = true;
    if (originalTimeout !== undefined) {
      try { await connection.query("SET SESSION innodb_lock_wait_timeout=?", [originalTimeout]); }
      catch { reusable = false; connection.destroy(); }
    }
    if (reusable) connection.release();
  }
}

export async function latestCheckoutQuote(connection: PoolConnection, applicationId: number): Promise<CheckoutQuote | null> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT id,revision,context_hash,quote_json,created_at FROM checkout_quote_revisions WHERE application_id=? ORDER BY revision DESC LIMIT 1", [applicationId]);
  const row = rows[0];
  if (!row) return null;
  const quote = typeof row.quote_json === "string" ? JSON.parse(row.quote_json) : row.quote_json;
  return { id: String(row.id), revision: Number(row.revision), contextHash: String(row.context_hash), quote, createdAt: new Date(row.created_at) };
}

/** Caller holds the application row lock, including across price-affecting writes. */
export async function refreshCheckoutQuote(connection: PoolConnection, applicationId: number): Promise<CheckoutQuote> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT visa_type,processing_type,payment_status,stripe_payment_intent_id FROM applications WHERE id=? FOR UPDATE", [applicationId]);
  const app = rows[0];
  if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found. Reopen your saved application." });
  const current = await latestCheckoutQuote(connection, applicationId);
  if ((app.payment_status === "paid" || app.stripe_payment_intent_id) && current) return current;
  const [reserved] = await connection.execute<RowDataPacket[]>("SELECT quote_id FROM checkout_payment_attempts WHERE application_id=?", [applicationId]);
  if (reserved[0]) {
    if (!current || current.id !== reserved[0].quote_id) throw new Error("Reserved checkout quote is unavailable");
    return current;
  }
  const [applicants] = await connection.execute<RowDataPacket[]>("SELECT id FROM applicants WHERE application_id=? ORDER BY id", [applicationId]);
  const processingType = String(app.processing_type);
  if (processingType !== "regular" && processingType !== "express") throw new Error("Invalid stored processing type");
  const contextHash = checkoutContextHash({ visaType: String(app.visa_type), processingType, applicantIds: applicants.map(row => Number(row.id)) });
  const quote = await quoteApplicationPrice({ serviceCode: String(app.visa_type), processingType, applicantCount: applicants.length });
  if (quote.currency !== "USD") throw new Error("Checkout requires a USD pricing rule");
  if (current && current.contextHash === contextHash && sameCheckoutPrice(current.quote, quote)) return current;
  // Once an intent exists its product/count/price must stay frozen until it is resolved.
  if (app.payment_status === "paid" || app.stripe_payment_intent_id) throw new TRPCError({ code: "CONFLICT",
    message: "Payment has already started for this application. Reopen the payment page to check its status before changing the order." });
  const next: CheckoutQuote = { id: randomUUID(), revision: (current?.revision ?? 0) + 1, contextHash, quote, createdAt: new Date() };
  await connection.execute("INSERT INTO checkout_quote_revisions (id,application_id,revision,context_hash,quote_json) VALUES (?,?,?,?,?)",
    [next.id, applicationId, next.revision, contextHash, JSON.stringify(quote)]);
  await connection.execute("UPDATE applications SET total_amount_usd=?,total_amount_aed=?,exchange_rate=?,base_type=?,updated_at=NOW() WHERE id=?",
    [quote.totalPrice.toFixed(2), quote.totalInBaseCurrency.toFixed(2), quote.exchangeRateToBase.toFixed(4), quote.applicantCount > 1 ? "family" : "single", applicationId]);
  return next;
}

export async function assertCheckoutEditable(connection: PoolConnection, applicationId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>("SELECT payment_status,stripe_payment_intent_id FROM applications WHERE id=? FOR UPDATE", [applicationId]);
  if (!rows[0]) throw new Error("Application not found");
  const [reserved] = await connection.execute<RowDataPacket[]>("SELECT quote_id FROM checkout_payment_attempts WHERE application_id=?", [applicationId]);
  if (rows[0].payment_status === "paid" || rows[0].stripe_payment_intent_id || reserved.length > 0) throw new TRPCError({ code: "CONFLICT",
    message: "Payment has already started. Reopen the payment page to check its status before changing travellers or visa options." });
}
