import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ locks: new Map<string, number>(), next: 0,
  events: new Map<string, { processing_status: string; attempt_count: number }>(), attempts: new Set<string>(), rejectInsert: false }));
vi.mock("mysql2/promise", () => ({ createPool: () => ({ getConnection: async () => {
  const id = ++state.next;
  let released = false;
  return {
    beginTransaction: async () => undefined, commit: async () => undefined, rollback: async () => undefined,
    release: () => { released = true; for (const [key, owner] of state.locks) if (owner === id) state.locks.delete(key); },
    execute: async (query: string, values: unknown[]) => {
      if (released) throw new Error("Connection closed");
      if (query.startsWith("SELECT GET_LOCK")) {
        const key = String(values[0]); const acquired = !state.locks.has(key);
        if (acquired) state.locks.set(key, id); return [[{ acquired: Number(acquired) }], []];
      }
      if (query.startsWith("SELECT RELEASE_LOCK")) { if (state.locks.get(String(values[0])) === id) state.locks.delete(String(values[0])); return [[], []]; }
      if (query.startsWith("INSERT INTO stripe_webhook_events")) {
        if (state.events.has(String(values[0]))) throw Object.assign(new Error("Duplicate"), { code: "ER_DUP_ENTRY" });
        state.events.set(String(values[0]), { processing_status: "processing", attempt_count: 1 });
      } else if (query.startsWith("SELECT processing_status")) return [[state.events.get(String(values[0]))], []];
      else if (query.startsWith("INSERT INTO stripe_webhook_attempts")) {
        const key = values.join(":");
        if (state.rejectInsert || state.attempts.has(key)) throw Object.assign(new Error("Attempt insert rejected"), { code: "ER_DUP_ENTRY" });
        state.attempts.add(key);
      } else if (query.startsWith("UPDATE stripe_webhook_events SET processing_status='processing'")) {
        state.events.set(String(values[1]), { processing_status: "processing", attempt_count: Number(values[0]) });
      } else if (query.startsWith("UPDATE stripe_webhook_events SET processing_status=?")) {
        const row = state.events.get(String(values[2])); if (row && row.attempt_count === values[3]) row.processing_status = String(values[0]);
      } else if (!query.startsWith("UPDATE stripe_webhook_attempts")) throw new Error("Unexpected query");
      return [{ affectedRows: 1 }, []];
    },
  };
} }) }));

import { claimStripeWebhookEvent, markStripeWebhookFailed, markStripeWebhookProcessed } from "./stripe-webhook-claim";
const input = { eventId: "evt_concurrency", eventType: "payment_intent.succeeded", paymentIntentId: "pi_concurrency" };

describe("atomic Stripe webhook attempts", () => {
  beforeEach(() => { state.locks.clear(); state.events.clear(); state.attempts.clear(); state.rejectInsert = false; });
  it("processes only one concurrent first delivery, then only one concurrent failed retry", async () => {
    const first = await Promise.all([claimStripeWebhookEvent(input), claimStripeWebhookEvent(input)]);
    expect(first.map(x => x.status).sort()).toEqual(["busy", "process"]);
    const winner = first.find(x => x.status === "process"); if (!winner || winner.status !== "process") throw new Error("Missing winner");
    await markStripeWebhookFailed(winner);
    const retry = await Promise.all([claimStripeWebhookEvent(input), claimStripeWebhookEvent(input)]);
    expect(retry.map(x => x.status).sort()).toEqual(["busy", "process"]);
    const retryWinner = retry.find(x => x.status === "process"); if (!retryWinner || retryWinner.status !== "process") throw new Error("Missing retry winner");
    expect(retryWinner.attempt).toBe(2); await markStripeWebhookProcessed(retryWinner);
    expect((await claimStripeWebhookEvent(input)).status).toBe("duplicate");
    expect(state.attempts.size).toBe(2);
  });
  it("recovers a crashed worker without stealing a live worker's claim", async () => {
    const first = await claimStripeWebhookEvent(input); if (first.status !== "process") throw new Error("Missing claim");
    expect((await claimStripeWebhookEvent(input)).status).toBe("busy");
    first.connection.release();
    const recovered = await claimStripeWebhookEvent(input); if (recovered.status !== "process") throw new Error("Missing recovered claim");
    expect(recovered.attempt).toBe(2); await markStripeWebhookProcessed(recovered);
  });
  it("never grants processing when the unique attempt insert fails", async () => {
    state.rejectInsert = true;
    await expect(claimStripeWebhookEvent(input)).rejects.toThrow("Attempt insert rejected");
    expect(state.locks.size).toBe(0);
  });
});
