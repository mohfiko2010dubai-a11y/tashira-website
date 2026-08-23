import { describe, expect, it } from "vitest";
import type { ControlledAuditEvent } from "./controlled-write-repository";
import { TransactionalControlledWriteStore, type ControlledWriteTransaction, type ControlledWriteTransactionDriver, type PersistedIdempotency } from "./transactional-write-store";

type State = { version: number; mutations: number; events: ControlledAuditEvent[]; audit: ControlledAuditEvent[]; idempotency: Map<string, PersistedIdempotency> };
const clone = (state: State): State => ({ ...structuredClone({ ...state, idempotency: undefined }), idempotency: new Map(state.idempotency) });

class TransactionalFake implements ControlledWriteTransactionDriver {
  state: State = { version: 4, mutations: 0, events: [], audit: [], idempotency: new Map() };
  failAudit = false;
  async transaction<T>(work: (transaction: ControlledWriteTransaction) => Promise<T>): Promise<T> {
    const draft = clone(this.state);
    const transaction: ControlledWriteTransaction = {
      findIdempotency: async (applicationId, key) => draft.idempotency.get(`${applicationId}:${key}`) ?? null,
      lockCurrentVersion: async () => draft.version,
      applyBusinessMutation: async () => { draft.mutations += 1; },
      advanceVersion: async (_applicationId, expected) => { if (draft.version !== expected) return false; draft.version += 1; return true; },
      appendBusinessEvent: async (event) => { draft.events.push(event); },
      appendAuditEvidence: async (event) => { if (this.failAudit) throw new Error("AUDIT_WRITE_FAILED"); draft.audit.push(event); },
      insertIdempotency: async (applicationId, key, record) => { draft.idempotency.set(`${applicationId}:${key}`, record); },
    };
    const result = await work(transaction);
    this.state = draft;
    return result;
  }
}

const command = {
  applicationId: 71, expectedVersion: 4, idempotencyKey: "review-0001", fingerprint: "fingerprint-a",
  event: { id: "event-1", applicationId: 71, action: "HUMAN_REVIEW" as const, actorId: "staff:7", reason: "Evidence reviewed", details: { outcome: "APPROVED_FOR_NEXT_STEP" }, occurredAt: "2026-08-23T12:00:00.000Z" },
};

describe("transactional controlled-write persistence gate", () => {
  it("commits mutation, version, event, audit and idempotency atomically", async () => {
    const driver = new TransactionalFake();
    const result = await new TransactionalControlledWriteStore(driver).execute(command);
    expect(result).toEqual({ status: "APPLIED", applicationId: 71, version: 5, auditEventId: "event-1" });
    expect(driver.state).toMatchObject({ version: 5, mutations: 1 });
    expect(driver.state.events).toHaveLength(1);
    expect(driver.state.audit).toHaveLength(1);
    expect(driver.state.idempotency).toHaveLength(1);
  });

  it("replays an identical command without a second mutation or audit event", async () => {
    const driver = new TransactionalFake();
    const store = new TransactionalControlledWriteStore(driver);
    await store.execute(command);
    expect(await store.execute(command)).toMatchObject({ status: "IDEMPOTENT_REPLAY", version: 5 });
    expect(driver.state.mutations).toBe(1);
    expect(driver.state.events).toHaveLength(1);
    expect(driver.state.audit).toHaveLength(1);
  });

  it("rejects stale concurrent writes before mutation", async () => {
    const driver = new TransactionalFake();
    await expect(new TransactionalControlledWriteStore(driver).execute({ ...command, expectedVersion: 3 })).rejects.toThrow("STALE_ENTITY_VERSION");
    expect(driver.state).toMatchObject({ version: 4, mutations: 0 });
  });

  it("rolls back the business mutation when audit evidence cannot be written", async () => {
    const driver = new TransactionalFake();
    driver.failAudit = true;
    await expect(new TransactionalControlledWriteStore(driver).execute(command)).rejects.toThrow("AUDIT_WRITE_FAILED");
    expect(driver.state).toMatchObject({ version: 4, mutations: 0 });
    expect(driver.state.events).toHaveLength(0);
    expect(driver.state.audit).toHaveLength(0);
    expect(driver.state.idempotency).toHaveLength(0);
  });
});
