import { randomUUID } from "crypto";
import { z } from "zod";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import {
  applicationPriceSnapshots, applications, businessSettingsVersions, financialEvents,
  payments, pricingRules, applicationTimelineEvents, applicants,
} from "@db/schema";
import { adminQuery, createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { activeBusinessSettings, quoteApplicationPrice } from "./lib/pricing-engine";

const currency = z.string().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase());
const warningLevels = z.array(z.number().min(0).max(100)).min(1).max(10)
  .transform((levels) => [...new Set(levels)].sort((a, b) => a - b));

function actorReference(ctx: { user?: { id: number }; staffId?: number }) {
  return ctx.user?.id ? `user:${ctx.user.id}` : ctx.staffId ? `staff:${ctx.staffId}` : "admin-session";
}

export const businessRouter = createRouter({
  quote: publicQuery.input(z.object({
    serviceCode: z.string().min(1).max(80),
    processingType: z.enum(["regular", "express"]),
    applicantCount: z.number().int().min(1).max(10),
  })).query(({ input }) => quoteApplicationPrice(input)),

  settings: adminQuery.query(() => activeBusinessSettings()),

  settingsHistory: adminQuery.query(() => getDb().select().from(businessSettingsVersions)
    .orderBy(desc(businessSettingsVersions.version))),

  createSettingsVersion: adminQuery.input(z.object({
    legalName: z.string().min(1).max(255),
    address: z.string().min(1).max(2000),
    phone: z.string().min(1).max(50),
    email: z.string().email(),
    vatRegistered: z.enum(["yes", "no"]),
    trn: z.string().max(100).optional(),
    vatRate: z.number().min(0).max(100),
    vatEffectiveAt: z.coerce.date().optional(),
    registrationThreshold: z.number().positive().optional(),
    warningLevels,
    invoicePrefix: z.string().min(1).max(20),
    nextInvoiceNumber: z.number().int().positive(),
    baseCurrency: currency,
    usdToBaseRate: z.number().positive(),
    effectiveAt: z.coerce.date(),
  })).mutation(async ({ input, ctx }) => {
    if (input.vatRegistered === "yes" && !input.trn) throw new Error("TRN is required when VAT registration is enabled");
    const [latest] = await getDb().select({ version: businessSettingsVersions.version })
      .from(businessSettingsVersions).orderBy(desc(businessSettingsVersions.version)).limit(1);
    const version = (latest?.version ?? 0) + 1;
    await getDb().insert(businessSettingsVersions).values({
      ...input,
      version,
      vatRate: input.vatRate.toFixed(4),
      registrationThreshold: input.registrationThreshold?.toFixed(2),
      warningLevelsJson: JSON.stringify(input.warningLevels),
      usdToBaseRate: input.usdToBaseRate.toFixed(6),
      createdBy: actorReference(ctx),
    });
    return { version };
  }),

  pricingHistory: adminQuery.input(z.object({ serviceCode: z.string().optional() }).optional())
    .query(({ input }) => input?.serviceCode
      ? getDb().select().from(pricingRules).where(eq(pricingRules.serviceCode, input.serviceCode)).orderBy(desc(pricingRules.version))
      : getDb().select().from(pricingRules).orderBy(desc(pricingRules.createdAt))),

  createPricingVersion: adminQuery.input(z.object({
    serviceCode: z.string().min(1).max(80),
    processingType: z.enum(["regular", "express"]),
    supplierCost: z.number().min(0),
    internalCost: z.number().min(0),
    markup: z.number().min(0),
    sellingPrice: z.number().positive(),
    promotionalPrice: z.number().positive().optional(),
    minimumSellingPrice: z.number().positive(),
    currency,
    effectiveAt: z.coerce.date(),
    expiresAt: z.coerce.date().optional(),
  })).mutation(async ({ input, ctx }) => {
    if (input.sellingPrice < input.minimumSellingPrice || (input.promotionalPrice !== undefined && input.promotionalPrice < input.minimumSellingPrice)) {
      throw new Error("Selling and promotional prices cannot be below the minimum selling price");
    }
    if (input.expiresAt && input.expiresAt <= input.effectiveAt) throw new Error("Expiry must be after the effective date");
    const [latest] = await getDb().select({ version: pricingRules.version }).from(pricingRules)
      .where(eq(pricingRules.serviceCode, input.serviceCode)).orderBy(desc(pricingRules.version)).limit(1);
    const version = (latest?.version ?? 0) + 1;
    await getDb().insert(pricingRules).values({
      ...input,
      version,
      supplierCost: input.supplierCost.toFixed(2),
      internalCost: input.internalCost.toFixed(2),
      markup: input.markup.toFixed(2),
      sellingPrice: input.sellingPrice.toFixed(2),
      promotionalPrice: input.promotionalPrice?.toFixed(2),
      minimumSellingPrice: input.minimumSellingPrice.toFixed(2),
      createdBy: actorReference(ctx),
    });
    return { version };
  }),

  recordFinancialEvent: adminQuery.input(z.object({
    applicationId: z.number().int().positive().optional(),
    paymentId: z.number().int().positive().optional(),
    eventType: z.enum(["REFUND_REQUESTED", "REFUND_COMPLETED", "CHARGEBACK_OPENED", "CHARGEBACK_WON", "CHARGEBACK_LOST"]),
    amount: z.number().positive().optional(),
    currency: currency.optional(),
    sourceReference: z.string().max(100).optional(),
  })).mutation(async ({ input, ctx }) => {
    const id = randomUUID();
    await getDb().insert(financialEvents).values({
      ...input,
      id,
      amount: input.amount?.toFixed(2),
      actorReference: actorReference(ctx),
    });
    return { id };
  }),

  cockpit: adminQuery.query(async () => {
    const db = getDb();
    const liveOnly = eq(applications.dataClassification, "LIVE");
    const livePaid = and(liveOnly, eq(applications.paymentStatus, "paid"));
    const [sales, paymentCounts, eventCounts, settings, abandonmentRows, visaRows, countryRows, monthlyTrend] = await Promise.all([
      db.select({
        revenue: sql<number>`coalesce(sum(${applicationPriceSnapshots.totalInBaseCurrency}), 0)`,
        supplierCost: sql<number>`coalesce(sum(${applicationPriceSnapshots.supplierCost}), 0)`,
        internalCost: sql<number>`coalesce(sum(${applicationPriceSnapshots.internalCost}), 0)`,
        orders: sql<number>`count(*)`,
      }).from(applicationPriceSnapshots)
        .innerJoin(applications, eq(applicationPriceSnapshots.applicationId, applications.id))
        .where(livePaid).then((rows) => rows[0]),
      db.select({ status: payments.status, count: sql<number>`count(*)` }).from(payments)
        .innerJoin(applications, eq(payments.applicationId, applications.id))
        .where(liveOnly).groupBy(payments.status),
      db.select({ type: financialEvents.eventType, count: sql<number>`count(*)` }).from(financialEvents)
        .leftJoin(applications, eq(financialEvents.applicationId, applications.id))
        .where(or(isNull(financialEvents.applicationId), liveOnly)).groupBy(financialEvents.eventType),
      activeBusinessSettings(),
      db.select({ count: sql<number>`count(*)` }).from(applicationTimelineEvents)
        .innerJoin(applications, eq(applicationTimelineEvents.applicationId, applications.id))
        .where(and(liveOnly, eq(applicationTimelineEvents.eventName, "CHECKOUT_ABANDONED"))),
      db.select({ label: applications.visaType, count: sql<number>`count(*)` }).from(applications)
        .where(liveOnly).groupBy(applications.visaType).orderBy(desc(sql`count(*)`)).limit(10),
      db.select({ label: applicants.nationality, count: sql<number>`count(*)` }).from(applicants)
        .innerJoin(applications, eq(applicants.applicationId, applications.id))
        .where(liveOnly).groupBy(applicants.nationality).orderBy(desc(sql`count(*)`)).limit(10),
      db.select({
        month: sql<string>`date_format(${applications.createdAt}, '%Y-%m')`,
        revenue: sql<number>`coalesce(sum(${applicationPriceSnapshots.totalInBaseCurrency}), 0)`,
        orders: sql<number>`count(*)`,
      }).from(applicationPriceSnapshots)
        .innerJoin(applications, eq(applicationPriceSnapshots.applicationId, applications.id))
        .where(livePaid)
        .groupBy(sql`date_format(${applications.createdAt}, '%Y-%m')`)
        .orderBy(sql`date_format(${applications.createdAt}, '%Y-%m')`),
    ]);
    const revenue = Number(sales?.revenue ?? 0);
    const supplierCost = Number(sales?.supplierCost ?? 0);
    const internalCost = Number(sales?.internalCost ?? 0);
    const totalCost = supplierCost + internalCost;
    const grossProfit = revenue - totalCost;
    const orders = Number(sales?.orders ?? 0);
    const paymentMap = Object.fromEntries(paymentCounts.map((row) => [row.status, Number(row.count)]));
    const eventMap = Object.fromEntries(eventCounts.map((row) => [row.type, Number(row.count)]));
    const threshold = Number(settings.registrationThreshold ?? 0);
    const successes = paymentMap.succeeded ?? 0;
    const failures = paymentMap.failed ?? 0;
    const paymentSuccessRate = successes + failures > 0 ? successes / (successes + failures) * 100 : null;
    const chargebacks = eventMap.CHARGEBACK_OPENED ?? 0;
    const paymentHealth = paymentSuccessRate === null ? 0 : Math.min(40, paymentSuccessRate * 0.4);
    const marginHealth = revenue > 0 ? Math.max(0, Math.min(30, grossProfit / revenue * 30)) : 0;
    const disputeHealth = Math.max(0, 20 - chargebacks * 5);
    const dataHealth = orders > 0 ? 10 : 0;
    const averageMonthlyRevenue = monthlyTrend.length > 0
      ? monthlyTrend.reduce((sum, row) => sum + Number(row.revenue), 0) / monthlyTrend.length
      : 0;
    const remainingToThreshold = Math.max(0, threshold - revenue);
    const estimatedThresholdDate = threshold > 0 && averageMonthlyRevenue > 0
      ? new Date(new Date().setMonth(new Date().getMonth() + Math.ceil(remainingToThreshold / averageMonthlyRevenue))).toISOString()
      : null;
    return {
      currency: settings.baseCurrency,
      revenue,
      supplierCost,
      internalCost,
      grossProfit,
      grossMargin: revenue > 0 ? grossProfit / revenue * 100 : 0,
      averageOrderValue: orders > 0 ? revenue / orders : 0,
      paymentSuccess: successes,
      paymentFailure: failures,
      paymentSuccessRate,
      refundRequests: eventMap.REFUND_REQUESTED ?? 0,
      chargebacks,
      checkoutAbandonment: Number(abandonmentRows[0]?.count ?? 0),
      topVisaTypes: visaRows,
      topCountries: countryRows.filter((row) => row.label),
      monthlyTrend,
      forecast: averageMonthlyRevenue || null,
      businessHealth: {
        score: Math.round(paymentHealth + marginHealth + disputeHealth + dataHealth),
        components: [
          { name: "payment reliability", points: paymentHealth, maximum: 40 },
          { name: "gross margin", points: marginHealth, maximum: 30 },
          { name: "chargeback exposure", points: disputeHealth, maximum: 20 },
          { name: "paid-order data", points: dataHealth, maximum: 10 },
        ],
        automatedDecision: false as const,
      },
      vatMonitor: {
        currentRelevantSales: revenue,
        threshold,
        remainingAmount: remainingToThreshold,
        progressPercent: threshold > 0 ? Math.min(100, revenue / threshold * 100) : null,
        warningLevels: JSON.parse(settings.warningLevelsJson) as number[],
        estimatedThresholdDate,
      },
    };
  }),
});
