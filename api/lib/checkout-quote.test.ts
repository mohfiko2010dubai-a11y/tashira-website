import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
import { assertCheckoutEditable, assertDisplayedQuote, checkoutContextHash, refreshCheckoutQuote } from "./checkout-quote";
import { resolvePaymentDisplayAmount } from "../../src/lib/payment-display-amount";

vi.mock("./pricing-engine", () => ({ quoteApplicationPrice: async (input: { serviceCode: string; processingType: string; applicantCount: number }) => {
  const unitPrice = (input.serviceCode === "90days-single" ? 400 : 185) + (input.processingType === "express" ? 30 : 0);
  return { pricingRuleId: 1, pricingVersion: 1, applicantCount: input.applicantCount, unitPrice,
    totalPrice: unitPrice * input.applicantCount, supplierCost: 0, internalCost: 0, markup: 0, minimumSellingPrice: 0,
    currency: "USD", exchangeRateToBase: 3.67, baseCurrency: "AED", totalInBaseCurrency: Math.round(unitPrice * input.applicantCount * 367) / 100 };
} }));

describe("checkout quote mutation regression", () => {
  let app: { visa_type: string; processing_type: string; payment_status: string; stripe_payment_intent_id: string | null };
  let members: number[];
  let revisions: Array<Record<string, unknown>>;
  let displayedTotal: string;
  let connection: PoolConnection;
  beforeEach(() => {
    app = { visa_type: "30days-single", processing_type: "regular", payment_status: "pending", stripe_payment_intent_id: null };
    members = [1, 2]; revisions = []; displayedTotal = "0";
    connection = { execute: vi.fn(async (query: string, values: unknown[] = []) => {
      if (query.startsWith("SELECT visa_type") || query.startsWith("SELECT payment_status")) return [[app], []];
      if (query.startsWith("SELECT id,revision")) return [revisions.slice(-1), []];
      if (query.startsWith("SELECT id FROM applicants")) return [members.map(id => ({ id })), []];
      if (query.startsWith("INSERT INTO checkout_quote_revisions")) {
        const payload = JSON.parse(String(values[4])) as Record<string, unknown>;
        // MySQL JSON storage may reorder object keys; this must not create a fresh quote every read.
        const reordered = Object.fromEntries(Object.entries(payload).reverse());
        revisions.push({ id: values[0], revision: values[2], context_hash: values[3], quote_json: reordered, created_at: new Date() });
        return [{ affectedRows: 1 }, []];
      }
      if (query.startsWith("UPDATE applications")) { displayedTotal = String(values[0]); return [{ affectedRows: 1 }, []]; }
      throw new Error("Unexpected test query");
    }) } as unknown as PoolConnection;
  });
  it("recomputes additions, removals, product and speed; the display equals charge cents after each mutation", async () => {
    const changes = [() => undefined, () => { members.push(3); }, () => { members.pop(); },
      () => { app.visa_type = "90days-single"; }, () => { app.processing_type = "express"; }];
    const totals: number[] = [];
    for (const change of changes) {
      change();
      const snapshot = await refreshCheckoutQuote(connection, 7);
      const display = resolvePaymentDisplayAmount({ totalAmountUsd: displayedTotal }).amount;
      expect(Math.round(display * 100)).toBe(Math.round(snapshot.quote.totalPrice * 100));
      expect(() => assertDisplayedQuote(snapshot, snapshot.id)).not.toThrow();
      totals.push(display);
    }
    expect(totals).toEqual([370, 555, 370, 800, 860]);
    expect(revisions).toHaveLength(5);
  });
  it("keeps an unchanged quote stable despite JSON key ordering", async () => {
    const first = await refreshCheckoutQuote(connection, 7);
    expect((await refreshCheckoutQuote(connection, 7)).id).toBe(first.id);
    expect(revisions).toHaveLength(1);
  });
  it("requires the customer to see the replacement quote before payment", async () => {
    const first = await refreshCheckoutQuote(connection, 7);
    members.push(3);
    const next = await refreshCheckoutQuote(connection, 7);
    expect(() => assertDisplayedQuote(next, first.id)).toThrow("review the new total");
    expect(() => assertDisplayedQuote(next, undefined)).toThrow("review the new total");
  });
  it("freezes paid and in-flight orders against price-affecting mutations", async () => {
    await refreshCheckoutQuote(connection, 7);
    app.stripe_payment_intent_id = "pi_existing";
    await expect(assertCheckoutEditable(connection, 7)).rejects.toThrow("Payment has already started");
    app.stripe_payment_intent_id = null; app.payment_status = "paid";
    await expect(assertCheckoutEditable(connection, 7)).rejects.toThrow("Payment has already started");
  });
  it("treats member identity, not only quantity, as part of the customer-visible quote", () => {
    const context = { visaType: "30days-single", processingType: "regular", applicantIds: [1, 2] };
    expect(checkoutContextHash(context)).toBe(checkoutContextHash({ ...context, applicantIds: [2, 1] }));
    expect(checkoutContextHash(context)).not.toBe(checkoutContextHash({ ...context, applicantIds: [1, 3] }));
  });
});
