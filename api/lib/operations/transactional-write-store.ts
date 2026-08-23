import type { ControlledAuditEvent, WriteResult } from "./controlled-write-repository";

export type PersistedIdempotency = { fingerprint: string; result: WriteResult };
export type PersistentWriteCommand = {
  applicationId: number;
  expectedVersion: number;
  idempotencyKey: string;
  fingerprint: string;
  event: Omit<ControlledAuditEvent, "entityVersionBefore" | "entityVersionAfter">;
};

export interface ControlledWriteTransaction {
  findIdempotency(applicationId: number, key: string): Promise<PersistedIdempotency | null>;
  lockCurrentVersion(applicationId: number): Promise<number | null>;
  applyBusinessMutation(): Promise<void>;
  advanceVersion(applicationId: number, expectedVersion: number): Promise<boolean>;
  appendBusinessEvent(event: ControlledAuditEvent): Promise<void>;
  appendAuditEvidence(event: ControlledAuditEvent): Promise<void>;
  insertIdempotency(applicationId: number, key: string, record: PersistedIdempotency): Promise<void>;
}

export interface ControlledWriteTransactionDriver {
  transaction<T>(work: (transaction: ControlledWriteTransaction) => Promise<T>): Promise<T>;
}

export class TransactionalControlledWriteStore {
  constructor(private readonly driver: ControlledWriteTransactionDriver) {}

  execute(command: PersistentWriteCommand): Promise<WriteResult> {
    return this.driver.transaction(async (transaction) => {
      const existing = await transaction.findIdempotency(command.applicationId, command.idempotencyKey);
      if (existing) {
        if (existing.fingerprint !== command.fingerprint) throw new Error("IDEMPOTENCY_KEY_CONFLICT");
        return { ...existing.result, status: "IDEMPOTENT_REPLAY" };
      }

      const currentVersion = await transaction.lockCurrentVersion(command.applicationId);
      if (currentVersion === null) throw new Error("CONTROLLED_CASE_NOT_FOUND");
      if (currentVersion !== command.expectedVersion) throw new Error("STALE_ENTITY_VERSION");

      await transaction.applyBusinessMutation();
      if (!await transaction.advanceVersion(command.applicationId, currentVersion)) throw new Error("STALE_ENTITY_VERSION");

      const auditEvent: ControlledAuditEvent = {
        ...command.event,
        entityVersionBefore: currentVersion,
        entityVersionAfter: currentVersion + 1,
      };
      await transaction.appendBusinessEvent(auditEvent);
      await transaction.appendAuditEvidence(auditEvent);

      const result: WriteResult = {
        status: "APPLIED",
        applicationId: command.applicationId,
        version: currentVersion + 1,
        auditEventId: auditEvent.id,
      };
      await transaction.insertIdempotency(command.applicationId, command.idempotencyKey, { fingerprint: command.fingerprint, result });
      return result;
    });
  }
}
