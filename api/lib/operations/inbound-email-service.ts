import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import { normalizeVerifiedInboundEmail, type NormalizedInboundSupportEmail } from "./inbound-email-adapter";

export type InboundEmailIngestionResult = { state: "INGESTED" | "DUPLICATE"; threadId: string; messageId: string };
export type InboundEmailRepository = { ingest(input: NormalizedInboundSupportEmail): Promise<InboundEmailIngestionResult> };

export async function ingestVerifiedInboundEmail(input: { envelope: unknown; context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[]; repository: InboundEmailRepository }): Promise<InboundEmailIngestionResult> {
  if (!isOperationsFlagEnabled("SUPPORT_INBOX", input.context, input.flags)) throw new Error("INBOUND_EMAIL_DISABLED");
  return input.repository.ingest(normalizeVerifiedInboundEmail(input.envelope));
}
