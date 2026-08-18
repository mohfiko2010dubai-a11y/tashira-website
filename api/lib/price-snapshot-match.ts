export type PriceSnapshotEvidence = {
  pricingRuleId: number;
  pricingVersion: number;
  applicantCount: number;
  unitPrice: string;
  totalPrice: string;
  supplierCost: string;
  internalCost: string;
  markup: string;
  minimumSellingPrice: string;
  currency: string;
  exchangeRateToBase: string;
  baseCurrency: string;
  totalInBaseCurrency: string;
};

export type PriceQuoteEvidence = {
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

export function priceSnapshotMatchesQuote(snapshot: PriceSnapshotEvidence, quote: PriceQuoteEvidence) {
  return snapshot.pricingRuleId === quote.pricingRuleId
    && snapshot.pricingVersion === quote.pricingVersion
    && snapshot.applicantCount === quote.applicantCount
    && Number(snapshot.unitPrice) === quote.unitPrice
    && Number(snapshot.totalPrice) === quote.totalPrice
    && Number(snapshot.supplierCost) === quote.supplierCost
    && Number(snapshot.internalCost) === quote.internalCost
    && Number(snapshot.markup) === quote.markup
    && Number(snapshot.minimumSellingPrice) === quote.minimumSellingPrice
    && snapshot.currency === quote.currency
    && Number(snapshot.exchangeRateToBase) === quote.exchangeRateToBase
    && snapshot.baseCurrency === quote.baseCurrency
    && Number(snapshot.totalInBaseCurrency) === quote.totalInBaseCurrency;
}
