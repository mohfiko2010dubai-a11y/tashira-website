import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { runCustomerPrecheckBehindFlag } from "./lib/customer/customer-experience-service";
import type { EligibilityRule, ProfileValue } from "./lib/eligibility/eligibility-engine";
import type { FeatureFlagContext, FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { MysqlOperationsAccessProvider } from "./lib/operations/mysql-access-provider";
import { defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlActiveRuleProvider } from "./lib/rules/mysql-active-rule-provider";
import { chatQuery, createRouter } from "./middleware";

const inputSchema = z.object({
  routeCode: z.string().trim().min(2).max(80),
  nationality: z.string().trim().min(2).max(80).optional(),
  passportCountry: z.string().trim().min(2).max(80).optional(),
  residenceCountry: z.string().trim().min(2).max(80).optional(),
  residenceType: z.string().trim().min(2).max(80).optional(),
  gccResident: z.boolean().optional(),
  gccCountry: z.string().trim().min(2).max(80).optional(),
  profession: z.string().trim().min(2).max(120).optional(),
  age: z.number().int().min(0).max(120).optional(),
  familyComposition: z.string().trim().min(2).max(120).optional(),
  travelArrangement: z.enum(["TOGETHER", "SEPARATELY"]).optional(),
  accompanyingGuardian: z.boolean().optional(),
  location: z.enum(["INSIDE_UAE", "OUTSIDE_UAE"]).optional(),
  plannedTravelDate: z.string().date().optional(),
  ticketStatus: z.enum(["NOT_BOOKED", "RESERVED", "CONFIRMED"]).optional(),
}).strict();

type Dependencies = {
  flagContextForContext(ctx: TrpcContext): FeatureFlagContext | Promise<FeatureFlagContext>;
  flagsForContext(ctx: TrpcContext): Promise<readonly FeatureFlagRecord[]>;
  activeRules(routeCode: string): Promise<readonly EligibilityRule[]>;
  now(): Date;
};

export function createCustomerPrecheckRouter(deps: Dependencies) {
  return createRouter({
    evaluate: chatQuery.input(inputSchema).query(async ({ input, ctx }) => {
      try {
        const [context, flags, rules] = await Promise.all([
          deps.flagContextForContext(ctx), deps.flagsForContext(ctx), deps.activeRules(input.routeCode),
        ]);
        const attributes = Object.fromEntries(Object.entries(input)
          .filter(([key, value]) => key !== "routeCode" && value !== undefined)) as Record<string, ProfileValue>;
        const result = runCustomerPrecheckBehindFlag({
          context, flags, profile: { routeCode: input.routeCode, attributes },
          approvedPublicRules: rules, evaluatedAt: deps.now(),
        });
        if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "Pre-check unavailable" });
        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Pre-check requires human review" });
      }
    }),
  });
}

let access: MysqlOperationsAccessProvider | undefined;
let rules: MysqlActiveRuleProvider | undefined;
function accessProvider() { return access ??= new MysqlOperationsAccessProvider(defaultOperationsSqlClient()); }
function ruleProvider() { return rules ??= new MysqlActiveRuleProvider(defaultOperationsSqlClient()); }

export const customerPrecheckRouter = createCustomerPrecheckRouter({
  flagContextForContext: (ctx) => accessProvider().flagContextForContext(ctx),
  flagsForContext: () => accessProvider().featureFlags(),
  activeRules: (routeCode) => ruleProvider().activeForRoute(routeCode),
  now: () => new Date(),
});
