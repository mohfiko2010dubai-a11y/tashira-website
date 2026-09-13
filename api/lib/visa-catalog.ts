import { PROCESSING_COPY } from "../../contracts/processing-copy";
import { getDb } from "../queries/connection";
import { pricingRules } from "@db/schema";
import { and, desc, isNull, gt, or, lte } from "drizzle-orm";

export type CatalogProduct = {
  id: string;
  nameEn: string;
  nameAr: string;
  entryType: "single" | "multiple";
  validityEn: string;
  validityAr: string;
  validityDays: string;
  processingTimeRegularEn: string;
  processingTimeRegularAr: string;
  processingTimeExpressEn: string;
  processingTimeExpressAr: string;
  featuresEn: string[];
  featuresAr: string[];
  popular?: boolean;
};

const CATALOG: CatalogProduct[] = [
  {
    id: "14days-single",
    nameEn: "14 Days Single Entry",
    nameAr: "١٤ يوم دخول مفرد",
    entryType: "single",
    validityEn: "Valid 60 days",
    validityAr: "صالحة ٦٠ يومًا",
    validityDays: "60",
    processingTimeRegularEn: PROCESSING_COPY.en.regular,
    processingTimeRegularAr: PROCESSING_COPY.ar.regular,
    processingTimeExpressEn: PROCESSING_COPY.en.express,
    processingTimeExpressAr: PROCESSING_COPY.ar.express,
    featuresEn: ["Government fees included"],
    featuresAr: ["شامل الرسوم الحكومية"],
  },
  {
    id: "30days-single",
    nameEn: "30 Days Single Entry",
    nameAr: "٣٠ يوم دخول مفرد",
    entryType: "single",
    validityEn: "Valid 60 days",
    validityAr: "صالحة ٦٠ يومًا",
    validityDays: "60",
    processingTimeRegularEn: PROCESSING_COPY.en.regular,
    processingTimeRegularAr: PROCESSING_COPY.ar.regular,
    processingTimeExpressEn: PROCESSING_COPY.en.express,
    processingTimeExpressAr: PROCESSING_COPY.ar.express,
    featuresEn: ["Government fees included"],
    featuresAr: ["شامل الرسوم الحكومية"],
    popular: true,
  },
  {
    id: "60days-single",
    nameEn: "60 Days Single Entry",
    nameAr: "٦٠ يوم دخول مفرد",
    entryType: "single",
    validityEn: "Valid 60 days",
    validityAr: "صالحة ٦٠ يومًا",
    validityDays: "60",
    processingTimeRegularEn: PROCESSING_COPY.en.regular,
    processingTimeRegularAr: PROCESSING_COPY.ar.regular,
    processingTimeExpressEn: PROCESSING_COPY.en.express,
    processingTimeExpressAr: PROCESSING_COPY.ar.express,
    featuresEn: ["Government fees included"],
    featuresAr: ["شامل الرسوم الحكومية"],
  },
  {
    id: "90days-single",
    nameEn: "90 Days Single Entry",
    nameAr: "٩٠ يوم دخول مفرد",
    entryType: "single",
    validityEn: "Valid 90 days",
    validityAr: "صالحة ٩٠ يومًا",
    validityDays: "90",
    processingTimeRegularEn: PROCESSING_COPY.en.regular,
    processingTimeRegularAr: PROCESSING_COPY.ar.regular,
    processingTimeExpressEn: PROCESSING_COPY.en.express,
    processingTimeExpressAr: PROCESSING_COPY.ar.express,
    featuresEn: ["Government fees included"],
    featuresAr: ["شامل الرسوم الحكومية"],
  },
  {
    id: "14days-multiple",
    nameEn: "14 Days Multiple Entry",
    nameAr: "١٤ يوم دخول متعدد",
    entryType: "multiple",
    validityEn: "Valid 60 days",
    validityAr: "صالحة ٦٠ يومًا",
    validityDays: "60",
    processingTimeRegularEn: PROCESSING_COPY.en.regular,
    processingTimeRegularAr: PROCESSING_COPY.ar.regular,
    processingTimeExpressEn: PROCESSING_COPY.en.express,
    processingTimeExpressAr: PROCESSING_COPY.ar.express,
    featuresEn: ["Government fees included"],
    featuresAr: ["شامل الرسوم الحكومية"],
  },
  {
    id: "30days-multiple",
    nameEn: "30 Days Multiple Entry",
    nameAr: "٣٠ يوم دخول متعدد",
    entryType: "multiple",
    validityEn: "Valid 60 days",
    validityAr: "صالحة ٦٠ يومًا",
    validityDays: "60",
    processingTimeRegularEn: PROCESSING_COPY.en.regular,
    processingTimeRegularAr: PROCESSING_COPY.ar.regular,
    processingTimeExpressEn: PROCESSING_COPY.en.express,
    processingTimeExpressAr: PROCESSING_COPY.ar.express,
    featuresEn: ["Government fees included"],
    featuresAr: ["شامل الرسوم الحكومية"],
  },
  {
    id: "60days-multiple",
    nameEn: "60 Days Multiple Entry",
    nameAr: "٦٠ يوم دخول متعدد",
    entryType: "multiple",
    validityEn: "Valid 60 days",
    validityAr: "صالحة ٦٠ يومًا",
    validityDays: "60",
    processingTimeRegularEn: PROCESSING_COPY.en.regular,
    processingTimeRegularAr: PROCESSING_COPY.ar.regular,
    processingTimeExpressEn: PROCESSING_COPY.en.express,
    processingTimeExpressAr: PROCESSING_COPY.ar.express,
    featuresEn: ["Government fees included"],
    featuresAr: ["شامل الرسوم الحكومية"],
  },
  {
    id: "96hours-transit",
    nameEn: "96 Hours Transit Visa",
    nameAr: "تأشيرة عبور ٩٦ ساعة",
    entryType: "single",
    validityEn: "Valid 30 days",
    validityAr: "صالحة ٣٠ يومًا",
    validityDays: "30",
    processingTimeRegularEn: PROCESSING_COPY.en.regular,
    processingTimeRegularAr: PROCESSING_COPY.ar.regular,
    processingTimeExpressEn: PROCESSING_COPY.en.express,
    processingTimeExpressAr: PROCESSING_COPY.ar.express,
    featuresEn: ["Government fees included"],
    featuresAr: ["شامل الرسوم الحكومية"],
  },
];

export type ActiveProduct = CatalogProduct & {
  regularPrice: number;
  expressPrice: number | null;
  currency: string;
};

export async function getActiveCatalogProducts(at?: Date): Promise<ActiveProduct[]> {
  const now = at ?? new Date();
  const db = getDb();
  const activeRules = await db
    .select()
    .from(pricingRules)
    .where(
      and(
        lte(pricingRules.effectiveAt, now),
        or(isNull(pricingRules.expiresAt), gt(pricingRules.expiresAt, now)),
      ),
    )
    .orderBy(desc(pricingRules.version));

  const latestRuleByKey = new Map<string, (typeof activeRules)[number]>();
  for (const rule of activeRules) {
    const key = `${rule.serviceCode}:${rule.processingType}`;
    if (!latestRuleByKey.has(key)) {
      latestRuleByKey.set(key, rule);
    }
  }

  const products: ActiveProduct[] = [];
  for (const product of CATALOG) {
    const regularRule = latestRuleByKey.get(`${product.id}:regular`);
    const expressRule = latestRuleByKey.get(`${product.id}:express`);
    const regularPrice = regularRule ? Number(regularRule.promotionalPrice ?? regularRule.sellingPrice) : null;
    if (regularPrice === null) continue;

    const expressPrice = expressRule ? Number(expressRule.promotionalPrice ?? expressRule.sellingPrice) : null;
    const currency = (regularRule?.currency ?? expressRule?.currency ?? "USD").toUpperCase();

    products.push({
      ...product,
      regularPrice,
      expressPrice,
      currency,
    });
  }
  return products;
}
