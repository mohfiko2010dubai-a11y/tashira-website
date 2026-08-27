import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import { AuthorityQueryTimeline } from "./authority-query";
import { generateTypingPack, type TypingPack } from "./typing-pack";
import { prepareVisaDelivery, type VisaDeliveryPackage } from "./visa-delivery";

export function generateTypingPackBehindFlag(input: { context: FeatureFlagContext; flags: readonly FeatureFlagRecord[];
  pack: Omit<TypingPack, "humanVerificationFieldKeys" | "integritySha256" | "state"> }): TypingPack | null {
  return isOperationsFlagEnabled("TYPING_PACK", input.context, input.flags) ? generateTypingPack(input.pack) : null;
}
export function createAuthorityQueryTimelineBehindFlag(input: { context: FeatureFlagContext; flags: readonly FeatureFlagRecord[] }): AuthorityQueryTimeline | null {
  return isOperationsFlagEnabled("AUTHORITY_QUERY", input.context, input.flags) ? new AuthorityQueryTimeline() : null;
}
export function prepareVisaDeliveryBehindFlag(input: { context: FeatureFlagContext; flags: readonly FeatureFlagRecord[]; delivery: Omit<VisaDeliveryPackage, "state" | "integritySha256"> }): VisaDeliveryPackage | null {
  return isOperationsFlagEnabled("VISA_DELIVERY", input.context, input.flags) ? prepareVisaDelivery(input.delivery) : null;
}
