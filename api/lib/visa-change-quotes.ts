import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { visaChangeAmount } from "../../contracts/visa-change-money";
import { quoteApplicationPrice } from "./pricing-engine";
import { defaultOperationsPool } from "./operations/mysql-query-client";

/** Caller owns the application transaction. Never backfill historical wait intervals. */
export async function supersedeUnansweredQuotes(connection: PoolConnection, applicationId: number, replacementQuoteId: string) {
  const [old] = await connection.execute<RowDataPacket[]>("SELECT id FROM visa_change_quotes WHERE application_id=? AND state='PROPOSED' FOR UPDATE", [applicationId]);
  await connection.execute("UPDATE visa_change_quotes SET state='SUPERSEDED' WHERE application_id=? AND state='PROPOSED'", [applicationId]);
  for (const row of old) {
    // A late email for the replaced proposal must not restart its waiting clock.
    await connection.execute(`INSERT IGNORE INTO customer_wait_events(id,application_id,wait_key,event_kind,reason,occurred_at,source_reference,actor_reference)
      SELECT SHA2(CONCAT('quote-superseded:',?),256),?,CONCAT('quote:',?),'RESUME','AMENDMENT_SENT',UTC_TIMESTAMP(3),?,'SYSTEM:SUPERSEDED_PROPOSAL'
      FROM customer_wait_policy WHERE singleton=1 AND enabled_at IS NOT NULL AND enabled_at<=UTC_TIMESTAMP(3)`, [row.id, applicationId, row.id, replacementQuoteId]);
  }
}

/** Caller owns the application transaction. Never modifies the original paid quote. */
export async function prepareVisaChangeQuote(connection: PoolConnection, applicationId: number, version: number, product: string) {
  const [apps] = await connection.execute<RowDataPacket[]>("SELECT visa_type,processing_type,payment_status FROM applications WHERE id=?", [applicationId]);
  const app = apps[0];
  if (app?.payment_status !== "paid") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Use the application form to change an unpaid order. A paid visa change requires its confirmed original payment." });
  const [active] = await connection.execute<RowDataPacket[]>("SELECT q.state FROM visa_change_quotes q WHERE q.application_id=? AND (q.state IN ('ACCEPTED','PAYMENT_PENDING','REFUND_PENDING') OR (q.state='REFUSED' AND NOT EXISTS(SELECT 1 FROM visa_change_decisions d WHERE d.quote_id=q.id AND d.state='APPROVED' AND d.outcome='TRY_ANOTHER_PRODUCT')))", [applicationId]);
  if (active.length) throw new TRPCError({ code: "CONFLICT", message: "Finish the accepted visa change before proposing another one." });
  const [previous] = await connection.execute<RowDataPacket[]>("SELECT new_total_minor,replacement_product,currency FROM visa_change_quotes WHERE application_id=? AND state='SETTLED' ORDER BY version DESC LIMIT 1", [applicationId]);
  const [paid] = await connection.execute<RowDataPacket[]>(`SELECT p.amount,p.currency,q.quote_json FROM checkout_payment_attempts c
    JOIN payments p ON p.application_id=c.application_id AND p.stripe_payment_intent_id=c.stripe_payment_intent_id
    JOIN checkout_quote_revisions q ON q.id=c.quote_id AND q.application_id=c.application_id
    WHERE c.application_id=? AND p.status='succeeded'`, [applicationId]);
  if (paid.length !== 1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The original paid quote is unavailable. Ask the administrator to review the payment before changing the visa." });
  const original = typeof paid[0].quote_json === "string" ? JSON.parse(paid[0].quote_json) : paid[0].quote_json;
  if (!original || Number(paid[0].amount) !== Number(original.totalPrice) || String(paid[0].currency).toUpperCase() !== String(original.currency).toUpperCase()) throw new Error("Original paid quote does not match the verified payment");
  const processingType = String(app.processing_type);
  if (processingType !== "regular" && processingType !== "express") throw new Error("Invalid processing speed");
  const quote = await quoteApplicationPrice({ serviceCode: product, processingType, applicantCount: Number(original.applicantCount) });
  const basis = previous[0];
  const amounts = visaChangeAmount(basis ? Number(basis.new_total_minor) / 100 : Number(original.totalPrice), quote.totalPrice,
    basis ? String(basis.currency) : String(original.currency), quote.currency);
  const previousProduct = basis ? String(basis.replacement_product) : String(app.visa_type);
  if (product === previousProduct) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a different visa product to propose a change." });
  const id = randomUUID();
  await supersedeUnansweredQuotes(connection, applicationId, id);
  await connection.execute(`INSERT INTO visa_change_quotes(id,application_id,version,previous_product,replacement_product,old_total_minor,new_total_minor,difference_minor,currency,quote_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`, [id, applicationId, version, previousProduct, product, amounts.oldTotalMinor, amounts.newTotalMinor, amounts.differenceMinor, amounts.currency, JSON.stringify(quote)]);
  return { id, ...amounts };
}

export async function acceptVisaChangeQuote(connection: PoolConnection, applicationId: number, version: number, quoteId?: string) {
  const [rows] = await connection.execute<RowDataPacket[]>("SELECT id,state,difference_minor FROM visa_change_quotes WHERE application_id=? AND version=?", [applicationId, version]);
  const quote = rows[0];
  if (!quote || quote.id !== quoteId || ["SUPERSEDED", "REFUSED"].includes(quote.state)) throw new TRPCError({ code: "CONFLICT", message: "Reload the proposal and review its current price before agreeing." });
  if (quote.state !== "PROPOSED") return;
  await connection.execute("UPDATE visa_change_quotes SET state=?,accepted_at=NOW(3) WHERE id=? AND state='PROPOSED'", [Number(quote.difference_minor) === 0 ? "SETTLED" : "ACCEPTED", quote.id]);
}

export async function currentVisaChangeQuote(applicationId: number) {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT q.id,q.version,q.previous_product,q.replacement_product,q.old_total_minor,q.new_total_minor,q.difference_minor,q.currency,q.state,
    (SELECT e.reason FROM product_substitution_events e WHERE e.application_id=q.application_id AND e.version=q.version AND e.action='PAYMENT_LINK_ISSUED' ORDER BY e.id DESC LIMIT 1) payment_link
    FROM visa_change_quotes q JOIN applications a ON a.id=q.application_id AND a.substitution_version=q.version WHERE a.id=?`, [applicationId]);
  const row = rows[0];
  return row ? { id: String(row.id), version: Number(row.version), previousProduct: String(row.previous_product), replacementProduct: String(row.replacement_product),
    oldTotalMinor: Number(row.old_total_minor), newTotalMinor: Number(row.new_total_minor), differenceMinor: Number(row.difference_minor), currency: String(row.currency), state: String(row.state), paymentLink: row.payment_link ? String(row.payment_link) : null } : null;
}
