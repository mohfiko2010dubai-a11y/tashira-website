import type { FamilyRelationship } from "./family-engine";
import type { RequirementInstanceState } from "./family-readiness";

export type FamilyRelationshipEvent = {
  id: string;
  applicationId: number;
  fromApplicantId: number;
  toApplicantId: number;
  relationship: Exclude<FamilyRelationship, "LEAD_APPLICANT">;
  eventType: "ESTABLISHED" | "REVOKED";
  reason: string;
  occurredAt: string;
};

export type ApplicantRequirementInstance = {
  id: string;
  applicationId: number;
  applicantId: number;
  evaluationId: string;
  catalogVersion: string;
  code: string;
  kind: "DOCUMENT" | "QUESTION";
  critical: boolean;
  conditional: boolean;
  createdAt: string;
};

export type ApplicantRequirementEvent = {
  id: string;
  instanceId: string;
  state: RequirementInstanceState;
  reason: string;
  occurredAt: string;
};

function ordered<T extends { occurredAt: string; id: string }>(events: readonly T[]): T[] {
  return [...events].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
}

export class InMemoryFamilyPersistenceRepository {
  readonly #relationships: FamilyRelationshipEvent[] = [];
  readonly #instances: ApplicantRequirementInstance[] = [];
  readonly #requirementEvents: ApplicantRequirementEvent[] = [];

  appendRelationship(event: FamilyRelationshipEvent): void {
    if (this.#relationships.some((item) => item.id === event.id)) throw new Error("Relationship event ID already exists");
    if (event.fromApplicantId === event.toApplicantId) throw new Error("Family relationship must connect different applicants");
    const keyEvents = ordered(this.#relationships.filter((item) =>
      item.applicationId === event.applicationId
      && item.fromApplicantId === event.fromApplicantId
      && item.toApplicantId === event.toApplicantId
      && item.relationship === event.relationship));
    const current = keyEvents.at(-1);
    if (current && event.occurredAt <= current.occurredAt) throw new Error("Relationship events must be appended chronologically");
    if (event.eventType === "ESTABLISHED" && current?.eventType === "ESTABLISHED") throw new Error("Relationship is already active");
    if (event.eventType === "REVOKED" && current?.eventType !== "ESTABLISHED") throw new Error("Only an active relationship can be revoked");
    this.#relationships.push(structuredClone(event));
  }

  relationshipHistory(applicationId: number): readonly FamilyRelationshipEvent[] {
    return ordered(this.#relationships.filter((event) => event.applicationId === applicationId)).map((event) => structuredClone(event));
  }

  currentRelationships(applicationId: number): readonly FamilyRelationshipEvent[] {
    const latest = new Map<string, FamilyRelationshipEvent>();
    for (const event of this.relationshipHistory(applicationId)) {
      latest.set(`${event.fromApplicantId}:${event.toApplicantId}:${event.relationship}`, event);
    }
    return [...latest.values()].filter((event) => event.eventType === "ESTABLISHED");
  }

  appendRequirementInstance(instance: ApplicantRequirementInstance): void {
    if (this.#instances.some((item) => item.id === instance.id)) throw new Error("Requirement instance ID already exists");
    if (this.#instances.some((item) => item.evaluationId === instance.evaluationId
      && item.applicantId === instance.applicantId && item.kind === instance.kind && item.code === instance.code)) {
      throw new Error("Requirement instance already exists for this applicant evaluation");
    }
    this.#instances.push(structuredClone(instance));
  }

  appendRequirementEvent(event: ApplicantRequirementEvent): void {
    if (this.#requirementEvents.some((item) => item.id === event.id)) throw new Error("Requirement event ID already exists");
    if (!this.#instances.some((instance) => instance.id === event.instanceId)) throw new Error("Requirement instance does not exist");
    const current = ordered(this.#requirementEvents.filter((item) => item.instanceId === event.instanceId)).at(-1);
    if (current && event.occurredAt <= current.occurredAt) throw new Error("Requirement events must be appended chronologically");
    this.#requirementEvents.push(structuredClone(event));
  }

  requirements(applicationId: number, applicantId: number, evaluationId: string): readonly {
    instance: ApplicantRequirementInstance;
    currentState: RequirementInstanceState | null;
  }[] {
    return this.#instances
      .filter((instance) => instance.applicationId === applicationId
        && instance.applicantId === applicantId && instance.evaluationId === evaluationId)
      .map((instance) => ({
        instance: structuredClone(instance),
        currentState: ordered(this.#requirementEvents.filter((event) => event.instanceId === instance.id)).at(-1)?.state ?? null,
      }));
  }

  requirementHistory(instanceId: string): readonly ApplicantRequirementEvent[] {
    return ordered(this.#requirementEvents.filter((event) => event.instanceId === instanceId)).map((event) => structuredClone(event));
  }
}
