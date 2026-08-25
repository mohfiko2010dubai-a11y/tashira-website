export type SupportChannel = "EMAIL" | "CHAT";
export type SupportDirection = "INBOUND" | "OUTBOUND";

export type SupportMessage = {
  messageId: string;
  providerMessageId: string;
  threadId: string;
  channel: SupportChannel;
  direction: SupportDirection;
  applicationId: number | null;
  customerReference: string | null;
  sanitizedBody: string;
  occurredAt: string;
  actorReference: string;
  auditReference: string;
};

export type SuggestedReply = {
  threadId: string;
  text: string;
  evidenceReferences: readonly string[];
  state: "DRAFT_REQUIRES_HUMAN_APPROVAL";
  autoSendAllowed: false;
};

export class InMemorySupportInbox {
  private readonly providerIds = new Set<string>();
  private readonly messages: SupportMessage[] = [];

  append(message: SupportMessage): "APPENDED" | "DUPLICATE" {
    if (!message.providerMessageId.trim() || !message.threadId.trim() || !message.auditReference.trim()) throw new Error("SUPPORT_EVIDENCE_REQUIRED");
    if (message.applicationId === null && message.customerReference === null) throw new Error("SUPPORT_LINK_REQUIRED");
    if (this.providerIds.has(message.providerMessageId)) return "DUPLICATE";
    this.providerIds.add(message.providerMessageId);
    this.messages.push({ ...message });
    return "APPENDED";
  }

  thread(threadId: string): readonly SupportMessage[] {
    return this.messages.filter((message) => message.threadId === threadId).map((message) => ({ ...message }));
  }
}

export function createSuggestedReply(input: { threadId: string; text: string; evidenceReferences: readonly string[] }): SuggestedReply {
  if (!input.text.trim() || input.evidenceReferences.length === 0) throw new Error("SUPPORT_REPLY_GROUNDING_REQUIRED");
  return { ...input, state: "DRAFT_REQUIRES_HUMAN_APPROVAL", autoSendAllowed: false };
}
