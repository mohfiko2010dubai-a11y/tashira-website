import { randomUUID } from "crypto";
import { and, desc, eq, isNull, lte, or, gt } from "drizzle-orm";
import { applicationPriceSnapshots, businessSettingsVersions, pricingRules } from "@db/schema";
import { getDb } from "../queries/connection";
import { priceSnapshotMatchesQuote } from "./price-snapshot-match";

export type PriceQuote = {
  pricingRuleId: number;
  pricingVersion: number;
  applicantCount: number;
  unitPrice: number;
  totalPrice: number;
  supplierCost: number;
  internalCost: number;
  markup: number;
  minimumSellingPrice: number;
  currency: string;
  exchangeRateToBase: number;
  baseCurrency: string;
  totalInBaseCurrency: number;
};

function mysqlErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function activeBusinessSettings(at = new Date()) {
  const [settings] = await getDb().select().from(businessSettingsVersions)
    .where(lte(businessSettingsVersions.effectiveAt, at))
    .orderBy(desc(businessSettingsVersions.effectiveAt), desc(businessSettingsVersions.version))
    .limit(1);
  if (!settings) throw new Error("Business and finance settings are not configured");
  return settings;
}

export async function quoteApplicationPrice(input: {
  serviceCode: string;
  processingType: "regular" | "express";
  applicantCount: number;
  at?: Date;
}): Promise<PriceQuote> {
  if (!Number.isInteger(input.applicantCount) || input.applicantCount < 1 || input.applicantCount > 10) {
    throw new Error("Applicant count is outside the supported range");
  }
  const at = input.at ?? new Date();
  const [rule, settings] = await Promise.all([
    getDb().select().from(pricingRules).where(and(
      eq(pricingRules.serviceCode, input.serviceCode),
      eq(pricingRules.processingType, input.processingType),
      lte(pricingRules.effectiveAt, at),
      or(isNull(pricingRules.expiresAt), gt(pricingRules.expiresAt, at)),
    )).orderBy(desc(pricingRules.version)).limit(1).then((rows) => rows[0]),
    activeBusinessSettings(at),
  ]);
  if (!rule) throw new Error("No active server pricing rule exists for this service");
  const sellingPrice = Number(rule.sellingPrice);
  const promotionalPrice = rule.promotionalPrice === null ? null : Number(rule.promotionalPrice);
  const minimum = Number(rule.minimumSellingPrice);
  const unitPrice = promotionalPrice ?? sellingPrice;
  if (![unitPrice, minimum].every(Number.isFinite) || unitPrice < minimum) {
    throw new Error("Active pricing rule violates the configured minimum selling price");
  }
  const exchangeRate = rule.currency === settings.baseCurrency ? 1 : Number(settings.usdToBaseRate);
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error("Configured exchange rate is invalid");
  const totalPrice = money(unitPrice * input.applicantCount);
  return {
    pricingRuleId: rule.id,
    pricingVersion: rule.version,
    applicantCount: input.applicantCount,
    unitPrice: money(unitPrice),
    totalPrice,
    supplierCost: money(Number(rule.supplierCost) * input.applicantCount),
    internalCost: money(Number(rule.internalCost) * input.applicantCount),
    markup: money(Number(rule.markup) * input.applicantCount),
    minimumSellingPrice: money(minimum * input.applicantCount),
    currency: rule.currency.toUpperCase(),
    exchangeRateToBase: exchangeRate,
    baseCurrency: settings.baseCurrency.toUpperCase(),
    totalInBaseCurrency: money(totalPrice * exchangeRate),
  };
}

export async function saveApplicationPriceSnapshot(applicationId: number, quote: PriceQuote) {
  const existing = await getApplicationPriceSnapshotIfPresent(applicationId);
  if (existing) {
    if (!priceSnapshotMatchesQuote(existing, quote)) throw new Error("Existing application price snapshot does not match the current server quote");
    return existing.id;
  }
  const id = randomUUID();
  try {
    await getDb().insert(applicationPriceSnapshots).values({
      id,
      applicationId,
      pricingRuleId: quote.pricingRuleId,
      pricingVersion: quote.pricingVersion,
      applicantCount: quote.applicantCount,
      unitPrice: quote.unitPrice.toFixed(2),
      totalPrice: quote.totalPrice.toFixed(2),
      supplierCost: quote.supplierCost.toFixed(2),
      internalCost: quote.internalCost.toFixed(2),
      markup: quote.markup.toFixed(2),
      minimumSellingPrice: quote.minimumSellingPrice.toFixed(2),
      currency: quote.currency,
      exchangeRateToBase: quote.exchangeRateToBase.toFixed(6),
      baseCurrency: quote.baseCurrency,
      totalInBaseCurrency: quote.totalInBaseCurrency.toFixed(2),
    });
  } catch (error: unknown) {
    if (mysqlErrorCode(error) !== "ER_DUP_ENTRY") throw error;
    const racedSnapshot = await getApplicationPriceSnapshotIfPresent(applicationId);
    if (!racedSnapshot || !priceSnapshotMatchesQuote(racedSnapshot, quote)) throw error;
    return racedSnapshot.id;
  }
  return id;
}

async function getApplicationPriceSnapshotIfPresent(applicationId: number) {
  const [snapshot] = await getDb().select().from(applicationPriceSnapshots)
    .where(eq(applicationPriceSnapshots.applicationId, applicationId)).limit(1);
  return snapshot;
}

export async function getApplicationPriceSnapshot(applicationId: number) {
  const snapshot = await getApplicationPriceSnapshotIfPresent(applicationId);
  if (!snapshot) throw new Error("Application price snapshot is missing");
  return snapshot;
}
