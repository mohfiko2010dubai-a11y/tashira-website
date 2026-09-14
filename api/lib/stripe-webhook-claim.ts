import { createHash } from "node:crypto";
import { createPool, type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { env } from "./env";

// Claim connections stay checked out while work uses the operations pool.
// Sharing that pool would deadlock when every slot holds a webhook claim.
let claimPool: Pool | undefined;
function webhookPool() {
  return claimPool ??= createPool({ uri: env.databaseUrl, connectionLimit: 4, enableKeepAlive: true });
}

export type StripeWebhookClaim = { status: "process"; eventId: string; attempt: number; lockName: string; connection: PoolConnection };
type ClaimResult = StripeWebhookClaim | { status: "duplicate" | "busy" };

async function release(connection: PoolConnection, lockName: string) {
  try { await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]); }
  finally { connection.release(); }
}

/** Unique inserts claim the event and each retry. The connection-scoped lock lasts
 * through processing, so a slow live handler is never stolen by a lease timeout.
 * MySQL releases the lock on a crashed/disconnected worker; Stripe can then retry. */
export async function claimStripeWebhookEvent(input: { eventId: string; eventType: string; paymentIntentId: string }): Promise<ClaimResult> {
  const connection = await webhookPool().getConnection();
  const lockName = "stripe:" + createHash("sha256").update(input.eventId).digest("hex").slice(0, 56);
  try {
    const [locked] = await connection.execute<RowDataPacket[]>("SELECT GET_LOCK(?,0) acquired", [lockName]);
    if (Number(locked[0]?.acquired) !== 1) { connection.release(); return { status: "busy" }; }
    await connection.beginTransaction();
    let attempt = 1;
    try {
      await connection.execute("INSERT INTO stripe_webhook_events (event_id,event_type,payment_intent_id,processing_status) VALUES (?,?,?,'processing')",
        [input.eventId, input.eventType, input.paymentIntentId]);
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY")) throw error;
      const [existing] = await connection.execute<RowDataPacket[]>("SELECT processing_status,attempt_count FROM stripe_webhook_events WHERE event_id=? FOR UPDATE", [input.eventId]);
      if (!existing.length) throw error;
      if (existing[0].processing_status === "processed") {
        await connection.rollback(); await release(connection, lockName); return { status: "duplicate" };
      }
      attempt = Number(existing[0].attempt_count) + 1;
    }
    // No processing is allowed unless this unique insert succeeds.
    await connection.execute("INSERT INTO stripe_webhook_attempts (event_id,attempt_number,processing_status) VALUES (?,?,'processing')", [input.eventId, attempt]);
    await connection.execute("UPDATE stripe_webhook_events SET processing_status='processing',attempt_count=?,processed_at=NULL,updated_at=NOW() WHERE event_id=?", [attempt, input.eventId]);
    await connection.commit();
    return { status: "process", eventId: input.eventId, attempt, lockName, connection };
  } catch (error) {
    try { await connection.rollback(); } finally { await release(connection, lockName); }
    throw error;
  }
}

async function finish(claim: StripeWebhookClaim, status: "processed" | "failed") {
  const { connection } = claim;
  try {
    await connection.beginTransaction();
    await connection.execute("UPDATE stripe_webhook_events SET processing_status=?,processed_at=IF(?='processed',NOW(),NULL),updated_at=NOW() WHERE event_id=? AND attempt_count=?",
      [status, status, claim.eventId, claim.attempt]);
    await connection.execute("UPDATE stripe_webhook_attempts SET processing_status=?,finished_at=NOW() WHERE event_id=? AND attempt_number=?", [status, claim.eventId, claim.attempt]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { await release(connection, claim.lockName); }
}

export const markStripeWebhookProcessed = (claim: StripeWebhookClaim) => finish(claim, "processed");
export const markStripeWebhookFailed = (claim: StripeWebhookClaim) => finish(claim, "failed");
