import { createHash, randomUUID } from "node:crypto";
import type { AuthorizationActor } from "../authorization/policy";
import type { RequirementCatalogImport } from "./requirement-catalog-seed";
import { validateCatalogImport } from "./requirement-catalog-seed";

export type CatalogGovernanceState = "DRAFT" | "REVIEW" | "APPROVED" | "ACTIVE" | "REJECTED" | "SUPERSEDED" | "RETIRED";
export type CatalogDefinitionKind = "REQUIREMENT" | "QUESTION";
export type CatalogGovernanceRecord = {
  definitionId: string;
  kind: CatalogDefinitionKind;
  code: string;
  version: number;
  state: CatalogGovernanceState;
  recordVersion: number;
  payload: Readonly<Record<string, unknown>>;
};
export type CatalogGovernanceEvent = {
  eventId: string;
  definitionId: string;
  kind: CatalogDefinitionKind;
  fromState: CatalogGovernanceState | null;
  toState: CatalogGovernanceState;
  actorReference: string;
  reason: string;
  occurredAt: string;
  payloadSha256: string;
};

const transitions: Readonly<Record<CatalogGovernanceState, readonly CatalogGovernanceState[]>> = {
  DRAFT: ["REVIEW"], REVIEW: ["APPROVED", "REJECTED"], APPROVED: ["ACTIVE"], ACTIVE: ["SUPERSEDED", "RETIRED"],
  REJECTED: ["DRAFT"], SUPERSEDED: [], RETIRED: [],
};
const requiredPermission: Readonly<Record<Exclude<CatalogGovernanceState, "DRAFT">, "rule.propose" | "rule.review" | "rule.activate">> = {
  REVIEW: "rule.propose", APPROVED: "rule.review", REJECTED: "rule.review", ACTIVE: "rule.activate",
  SUPERSEDED: "rule.activate", RETIRED: "rule.activate",
};

function sha(payload: unknown): string { return createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }
function assertActor(actor: AuthorizationActor, permission: "rule.propose" | "rule.review" | "rule.activate"): void {
  if (!actor.permissions.has(permission)) throw new Error("CATALOG_GOVERNANCE_ACCESS_DENIED");
}

export class InMemoryCatalogGovernanceRepository {
  readonly #records = new Map<string, CatalogGovernanceRecord>();
  readonly #events: CatalogGovernanceEvent[] = [];

  importDraft(input: unknown, actor: AuthorizationActor, occurredAt: Date): { catalog: RequirementCatalogImport; imported: number; sha256: string } {
    assertActor(actor, "rule.propose");
    const { catalog, sha256 } = validateCatalogImport(input);
    const definitions = [...catalog.requirements.map((payload) => ({ kind: "REQUIREMENT" as const, payload })),
      ...catalog.questions.map((payload) => ({ kind: "QUESTION" as const, payload }))];
    for (const { kind, payload } of definitions) {
      if (payload.status !== "DRAFT" || payload.reviewStatus !== "PENDING") throw new Error("CATALOG_IMPORT_MUST_BE_DRAFT");
      const key = `${kind}:${payload.code}:${payload.version}`;
      if ([...this.#records.values()].some((record) => `${record.kind}:${record.code}:${record.version}` === key)) throw new Error("CATALOG_VERSION_EXISTS");
      const record: CatalogGovernanceRecord = { definitionId: payload.definitionId, kind, code: payload.code,
        version: payload.version, state: "DRAFT", recordVersion: 1, payload: structuredClone(payload) };
      this.#records.set(record.definitionId, record);
      this.#events.push({ eventId: randomUUID(), definitionId: record.definitionId, kind, fromState: null, toState: "DRAFT",
        actorReference: actor.id, reason: `CATALOG_IMPORT:${catalog.importVersion}`, occurredAt: occurredAt.toISOString(), payloadSha256: sha(record.payload) });
    }
    return { catalog, imported: definitions.length, sha256 };
  }

  editDraft(input: { definitionId: string; expectedVersion: number; payload: Readonly<Record<string, unknown>>; reason?: string; occurredAt?: Date }, actor: AuthorizationActor): CatalogGovernanceRecord {
    assertActor(actor, "rule.propose");
    const current = this.#records.get(input.definitionId);
    if (!current) throw new Error("CATALOG_DEFINITION_NOT_FOUND");
    if (current.state !== "DRAFT") throw new Error("CATALOG_DEFINITION_IMMUTABLE");
    if (current.recordVersion !== input.expectedVersion) throw new Error("CATALOG_VERSION_CONFLICT");
    const next = { ...current, recordVersion: current.recordVersion + 1, payload: structuredClone(input.payload) };
    this.#records.set(input.definitionId, next);
    this.#events.push({ eventId: randomUUID(), definitionId: current.definitionId, kind: current.kind, fromState: "DRAFT", toState: "DRAFT",
      actorReference: actor.id, reason: input.reason?.trim() || "DRAFT_EDITED", occurredAt: (input.occurredAt ?? new Date()).toISOString(), payloadSha256: sha(next.payload) });
    return structuredClone(next);
  }

  transition(input: { definitionId: string; expectedVersion: number; toState: CatalogGovernanceState; reason: string; occurredAt: Date }, actor: AuthorizationActor): CatalogGovernanceRecord {
    const current = this.#records.get(input.definitionId);
    if (!current) throw new Error("CATALOG_DEFINITION_NOT_FOUND");
    if (!transitions[current.state].includes(input.toState)) throw new Error("CATALOG_TRANSITION_INVALID");
    if (current.recordVersion !== input.expectedVersion) throw new Error("CATALOG_VERSION_CONFLICT");
    if (!input.reason.trim()) throw new Error("CATALOG_REASON_REQUIRED");
    const permission = input.toState === "DRAFT" ? "rule.propose" : requiredPermission[input.toState];
    assertActor(actor, permission);
    const next = { ...current, state: input.toState, recordVersion: current.recordVersion + 1 };
    this.#records.set(input.definitionId, next);
    this.#events.push({ eventId: randomUUID(), definitionId: current.definitionId, kind: current.kind,
      fromState: current.state, toState: input.toState, actorReference: actor.id, reason: input.reason.trim(),
      occurredAt: input.occurredAt.toISOString(), payloadSha256: sha(current.payload) });
    return structuredClone(next);
  }

  get(definitionId: string): CatalogGovernanceRecord | null { const value = this.#records.get(definitionId); return value ? structuredClone(value) : null; }
  history(definitionId: string): readonly CatalogGovernanceEvent[] { return this.#events.filter((event) => event.definitionId === definitionId).map((event) => structuredClone(event)); }
}
