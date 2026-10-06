import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { withCheckoutLock } from "./checkout-quote";
import { defaultOperationsPool } from "./operations/mysql-query-client";

export const refusalOutcomes = ["FULL_REFUND_CANCEL", "REFUND_LESS_FEE", "TRY_ANOTHER_PRODUCT", "ORIGINAL_AT_CUSTOMER_REQUEST"] as const;
export type ManualChangeRequest = {
  quoteId: string; version: number; kind: "SETTLEMENT" | "REFUSAL_OUTCOME";
  outcome?: typeof refusalOutcomes[number]; direction?: "TOP_UP" | "REFUND";
  amountMinor?: number; currency?: "USD"; stripeReference?: string;
  reason: string; writtenInsistence?: string; riskRecord?: string;
};
function conflict(message: string): never { throw new TRPCError({ code: "CONFLICT", message }); }
async function quoteFor(connection: PoolConnection, applicationId: number, quoteId: string, version: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(`SELECT q.* FROM visa_change_quotes q JOIN applications a
    ON a.id=q.application_id AND a.substitution_version=q.version WHERE q.id=? AND q.application_id=? AND q.version=?`, [quoteId, applicationId, version]);
  if (!rows[0]) conflict("This proposal is no longer current. Refresh the order before continuing.");
  return rows[0];
}
async function event(connection: PoolConnection, quote: RowDataPacket, action: string, actor: string, reason: string) {
  await connection.execute("INSERT INTO product_substitution_events(application_id,version,product,action,actor,reason) VALUES(?,?,?,?,?,?)",
    [quote.application_id, quote.version, quote.replacement_product, action, actor, reason]);
  await connection.execute("INSERT INTO application_timeline_events(id,application_id,event_name,event_source,actor_type,actor_reference,resulting_state,summary) VALUES(UUID(),?,?,'VISA_CHANGE',?,?,?,?)",
    [quote.application_id, `AMENDMENT_${action}`, actor === "CUSTOMER" ? "CUSTOMER" : "STAFF", actor, action, reason]);
}
export async function refuseVisaChange(applicationId: number, quoteId: string, version: number, reason: string) {
  return withCheckoutLock(applicationId, async connection => {
    const quote = await quoteFor(connection, applicationId, quoteId, version);
    if (quote.state === "REFUSED") return { refused: true };
    if (quote.state !== "PROPOSED") conflict("This proposal was already answered. Contact support to review it.");
    if (!reason.trim()) conflict("Explain why you refuse the change so the team can review your request.");
    await connection.execute("UPDATE visa_change_quotes SET state='REFUSED' WHERE id=?", [quoteId]);
    await event(connection, quote, "REFUSED", "CUSTOMER", reason);
    return { refused: true };
  });
}

export async function recordDifferenceLink(applicationId: number, quoteId: string, version: number, actorId: number, url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "buy.stripe.com" || parsed.username || parsed.password || parsed.port || url.length > 450) conflict("Use the HTTPS payment link created in your Stripe dashboard.");
  return withCheckoutLock(applicationId, async connection => {
    const quote = await quoteFor(connection, applicationId, quoteId, version);
    if (quote.state !== "ACCEPTED" || Number(quote.difference_minor) <= 0) conflict("Issue the link only after the customer accepts a positive price difference.");
    const [prior] = await connection.execute<RowDataPacket[]>("SELECT reason FROM product_substitution_events WHERE application_id=? AND version=? AND action='PAYMENT_LINK_ISSUED'", [applicationId, version]);
    if (prior.length) {
      if (prior[0].reason !== url) conflict("A payment link is already recorded. Review its Stripe result before replacing it.");
      return { recorded: true };
    }
    await event(connection, quote, "PAYMENT_LINK_ISSUED", `staff:${actorId}`, url);
    await connection.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
      SELECT ?,a.id,'STATUS_CHANGED',JSON_OBJECT('statusLabel',IF(a.preferred_language='ar','رابط دفع فرق تعديل التأشيرة جاهز. افتح طلبك لإكمال الدفع.','Your visa-change payment link is ready. Open your application to pay the difference.'),'sourceEvent','adjustment_payment_requested')
      FROM applications a WHERE a.id=?`, [`adjustment-link:${quote.id}`, applicationId]);
    return { recorded: true };
  });
}

export function validateManualChange(quote: { state: string; difference_minor: number; old_total_minor: number }, input: ManualChangeRequest) {
  if (input.reason.trim().length < 5) conflict("Record a reason of at least five characters.");
  if (input.kind === "SETTLEMENT") {
    if (!["ACCEPTED", "PAYMENT_PENDING", "REFUND_PENDING"].includes(quote.state)) conflict("The customer must accept this price before settlement.");
    if (!quote.difference_minor || input.amountMinor !== Math.abs(quote.difference_minor) || input.currency !== "USD"
      || input.direction !== (quote.difference_minor > 0 ? "TOP_UP" : "REFUND")) conflict("Record the exact direction, amount and currency of the accepted difference.");
  } else {
    if (quote.state !== "REFUSED" || !input.outcome) conflict("Choose an outcome for the refused proposal.");
    if (input.outcome === "ORIGINAL_AT_CUSTOMER_REQUEST" && (!input.writtenInsistence?.trim() || !input.riskRecord?.trim())) conflict("Record the customer's written insistence and the specific risk before requesting approval.");
    if (input.outcome === "FULL_REFUND_CANCEL" && input.amountMinor !== quote.old_total_minor) conflict("A full refund must match the previous order total.");
    if (input.outcome === "REFUND_LESS_FEE" && (!input.amountMinor || input.amountMinor >= quote.old_total_minor)) conflict("Record the actual partial refund and explain the processing fee.");
  }
  const moneyMovement = input.kind === "SETTLEMENT" || input.outcome === "FULL_REFUND_CANCEL" || input.outcome === "REFUND_LESS_FEE";
  if (moneyMovement && (!Number.isSafeInteger(input.amountMinor) || Number(input.amountMinor) <= 0 || input.currency !== "USD"
    || !/^(pi_|ch_|re_)[A-Za-z0-9_]+$/.test(input.stripeReference || ""))) conflict("Record the completed Stripe payment (pi_/ch_) or refund (re_) reference, amount and currency. A payment link alone is not a receipt.");
  if (moneyMovement && ((input.direction === "TOP_UP" && !/^(pi_|ch_)/.test(input.stripeReference || ""))
    || (input.direction === "REFUND" && !input.stripeReference?.startsWith("re_")))) conflict("The Stripe reference does not match the movement direction.");
  if (input.kind === "REFUSAL_OUTCOME" && moneyMovement && input.direction !== "REFUND") conflict("This outcome requires a refund reference.");
}

export async function requestManualChange(applicationId: number, actorId: number, input: ManualChangeRequest) {
  return withCheckoutLock(applicationId, async connection => {
    const quote = await quoteFor(connection, applicationId, input.quoteId, input.version);
    validateManualChange({ state: String(quote.state), difference_minor: Number(quote.difference_minor), old_total_minor: Number(quote.old_total_minor) }, input);
    if (input.kind === "REFUSAL_OUTCOME") {
      const [resolved] = await connection.execute<RowDataPacket[]>("SELECT id FROM visa_change_decisions WHERE quote_id=? AND kind='REFUSAL_OUTCOME' AND state='APPROVED'", [input.quoteId]);
      if (resolved.length) conflict("This refusal already has an approved outcome. Review the order before requesting another change.");
    }
    const [pending] = await connection.execute<RowDataPacket[]>("SELECT id FROM visa_change_decisions WHERE quote_id=? AND state='PENDING'", [input.quoteId]);
    if (pending.length) conflict("A decision is already queued for this proposal. Review it before creating another.");
    const id = randomUUID();
    await connection.execute(`INSERT INTO visa_change_decisions(id,application_id,quote_id,quote_version,kind,outcome,direction,amount_minor,currency,stripe_reference,reason,written_insistence,risk_record,requested_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, applicationId, input.quoteId, input.version, input.kind, input.outcome ?? null, input.direction ?? null,
      input.amountMinor ?? null, input.currency ?? null, input.stripeReference ?? null, input.reason, input.writtenInsistence ?? null, input.riskRecord ?? null, actorId]);
    await event(connection, quote, "DECISION_REQUESTED", `staff:${actorId}`, input.reason);
    return { id };
  });
}

export async function manualChangeQueue() {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT d.*,a.reference_number,s.name requester_name FROM visa_change_decisions d
    JOIN applications a ON a.id=d.application_id JOIN staff_users s ON s.id=d.requested_by WHERE d.state='PENDING' ORDER BY d.created_at,d.id`);
  return rows.map(row => ({ id: String(row.id), applicationId: Number(row.application_id), referenceNumber: String(row.reference_number),
    quoteId: String(row.quote_id), version: Number(row.quote_version), kind: String(row.kind), outcome: row.outcome ? String(row.outcome) : null,
    direction: row.direction ? String(row.direction) : null, amountMinor: row.amount_minor === null ? null : Number(row.amount_minor), currency: row.currency ? String(row.currency) : null,
    stripeReference: row.stripe_reference ? String(row.stripe_reference) : null, reason: String(row.reason), writtenInsistence: row.written_insistence ? String(row.written_insistence) : null,
    riskRecord: row.risk_record ? String(row.risk_record) : null, requester: String(row.requester_name), createdAt: new Date(row.created_at).toISOString() }));
}

export async function decideManualChange(id: string, actorId: number, approve: boolean, reason: string) {
  const [owners] = await defaultOperationsPool().execute<RowDataPacket[]>("SELECT application_id FROM visa_change_decisions WHERE id=?", [id]);
  if (!owners[0]) conflict("Decision not found. Refresh the approvals queue.");
  return withCheckoutLock(Number(owners[0].application_id), async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT * FROM visa_change_decisions WHERE id=?", [id]);
    const decision = rows[0];
    if (decision.state !== "PENDING") conflict("This decision was already processed. Refresh the queue.");
    if (reason.trim().length < 5) conflict("Record an approval or rejection reason of at least five characters.");
    const quote = await quoteFor(connection, Number(decision.application_id), String(decision.quote_id), Number(decision.quote_version));
    await connection.execute("UPDATE visa_change_decisions SET state=?,decided_by=?,decided_at=NOW(3),decision_reason=? WHERE id=?",
      [approve ? "APPROVED" : "REJECTED", actorId, reason, id]);
    if (!approve) { await event(connection, quote, "DECISION_REJECTED", `staff:${actorId}`, reason); return { approved: false }; }
    if (decision.kind === "SETTLEMENT") {
      if (!["ACCEPTED", "PAYMENT_PENDING", "REFUND_PENDING"].includes(quote.state) || !decision.stripe_reference) conflict("Settlement evidence is incomplete or no longer current.");
      await connection.execute("UPDATE visa_change_quotes SET state='SETTLED' WHERE id=?", [quote.id]);
      await event(connection, quote, "SETTLED", `staff:${actorId}`, `${decision.direction} ${decision.amount_minor} ${decision.currency}; ${decision.stripe_reference}; ${reason}`.slice(0, 500));
    } else {
      if (quote.state !== "REFUSED") conflict("This refusal was already resolved.");
      if (decision.outcome === "ORIGINAL_AT_CUSTOMER_REQUEST") {
        await connection.execute("UPDATE applications SET submitted_product=?,substitution_acknowledged_version=?,substitution_acknowledged_at=NOW(3) WHERE id=?",
          [quote.previous_product, quote.version, quote.application_id]);
      } else if (["FULL_REFUND_CANCEL", "REFUND_LESS_FEE"].includes(decision.outcome)) {
        await connection.execute("UPDATE applications SET status='cancelled' WHERE id=?", [quote.application_id]);
      }
      await event(connection, quote, "REFUSAL_RESOLVED", `staff:${actorId}`, `${decision.outcome}: ${reason}`.slice(0, 500));
    }
    await connection.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
      SELECT ?,a.id,'STATUS_CHANGED',JSON_OBJECT('statusLabel',CONCAT(IF(a.preferred_language='ar','تمت مراجعة تعديل التأشيرة: ','Visa amendment reviewed: '),?, ' — ',?), 'sourceEvent','adjustment_issued')
      FROM applications a WHERE a.id=?`, [`adjustment:${id}`, decision.kind === "SETTLEMENT" ? `${decision.direction} ${(Number(decision.amount_minor) / 100).toFixed(2)} ${decision.currency}` : decision.outcome, reason, quote.application_id]);
    return { approved: true };
  });
}
