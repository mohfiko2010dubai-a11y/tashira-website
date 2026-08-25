export type AuthorityQueryState = "DRAFT" | "SUBMITTED" | "AWAITING_RESPONSE" | "RESPONSE_RECEIVED" | "CLOSED";
export type AuthorityQueryEvent = {
  eventId: string; queryId: string; applicationId: number; applicantId: number | null; state: AuthorityQueryState;
  occurredAt: string; actorType: "STAFF" | "SYSTEM"; actorId: number | null; reason: string; externalReference: string | null;
};

const transitions: Readonly<Record<AuthorityQueryState, readonly AuthorityQueryState[]>> = {
  DRAFT: ["SUBMITTED"], SUBMITTED: ["AWAITING_RESPONSE", "RESPONSE_RECEIVED"], AWAITING_RESPONSE: ["RESPONSE_RECEIVED"], RESPONSE_RECEIVED: ["CLOSED"], CLOSED: [],
};

export class AuthorityQueryTimeline {
  readonly #events: AuthorityQueryEvent[] = [];
  append(event: AuthorityQueryEvent): void {
    if (!event.eventId.trim() || !event.queryId.trim() || !event.reason.trim() || Number.isNaN(Date.parse(event.occurredAt))) throw new Error("AUTHORITY_QUERY_EVIDENCE_REQUIRED");
    if (this.#events.some(({ eventId }) => eventId === event.eventId)) throw new Error("AUTHORITY_QUERY_EVENT_DUPLICATE");
    const current = this.current(event.queryId);
    if (current && !transitions[current.state].includes(event.state)) throw new Error("AUTHORITY_QUERY_TRANSITION_INVALID");
    if (!current && event.state !== "DRAFT") throw new Error("AUTHORITY_QUERY_MUST_START_DRAFT");
    if (event.state === "RESPONSE_RECEIVED" && !event.externalReference?.trim()) throw new Error("AUTHORITY_RESPONSE_REFERENCE_REQUIRED");
    this.#events.push({ ...event });
  }
  current(queryId: string): AuthorityQueryEvent | null { return [...this.#events].reverse().find((event) => event.queryId === queryId) ?? null; }
  history(queryId: string): readonly AuthorityQueryEvent[] { return this.#events.filter((event) => event.queryId === queryId).map((event) => ({ ...event })); }
}
