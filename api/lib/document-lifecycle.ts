import { randomUUID } from "crypto";
import { and, count, eq } from "drizzle-orm";
import { documentLifecycleEvents } from "@db/schema";
import { getDb } from "../queries/connection";

export type DocumentLifecycleEvent = "UPLOADED" | "REPLACED" | "DELETED" | "REPLACEMENT_REQUESTED" | "VALIDATED" | "REJECTED";

export async function recordDocumentLifecycleEvent(input: {
  applicationId: number;
  documentId?: number;
  applicantId?: number;
  replacesDocumentId?: number;
  eventType: DocumentLifecycleEvent;
  actorType: "CUSTOMER" | "STAFF" | "ADMIN" | "SYSTEM";
  actorReference?: string;
  evidenceReference?: string;
  reason?: string;
}) {
  const [result] = await getDb().select({ value: count() }).from(documentLifecycleEvents).where(and(
    eq(documentLifecycleEvents.applicationId, input.applicationId),
    input.documentId ? eq(documentLifecycleEvents.documentId, input.documentId) : undefined,
  ));
  const documentVersion = Number(result?.value ?? 0) + 1;
  const id = randomUUID();
  await getDb().insert(documentLifecycleEvents).values({ ...input, id, documentVersion });
  return { id, documentVersion };
}
