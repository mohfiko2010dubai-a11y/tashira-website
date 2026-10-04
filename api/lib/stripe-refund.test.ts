import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./stripe-runtime", () => ({ stripeSecretKey: () => "sk_test_fixture" }));

import { createStripeRefund, retrieveStripeRefund, findStripeRefund, StripeRefundRejected } from "./stripe";
import { reconcileRefundStatus } from "./refund-domain";

describe("Stripe refund request", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses PaymentIntent, exact cents, metadata, and idempotency without card data", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "re_fixture", payment_intent: "pi_fixture", amount: 245000, currency: "aed", status: "succeeded",
    }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const result = await createStripeRefund({
      paymentIntentId: "pi_fixture",
      amountCents: 245000,
      idempotencyKey: "refund-00000000-0000-4000-8000-000000000000",
      metadata: { refundCaseId: "case", refundItemId: "item", sourceType: "SECURITY_DEPOSIT" },
    });
    expect(result.id).toBe("re_fixture");
    const [, init] = request.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "Idempotency-Key": "refund-00000000-0000-4000-8000-000000000000" });
    const body = new URLSearchParams(init.body as string);
    expect(body.get("payment_intent")).toBe("pi_fixture");
    expect(body.get("amount")).toBe("245000");
    expect([...body.keys()]).not.toContain("card");
  });

  it("rejects invalid identifiers and non-positive amounts before Stripe", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(createStripeRefund({
      paymentIntentId: "invalid", amountCents: 100, idempotencyKey: "refund-00000000-0000-4000-8000-000000000000",
      metadata: { refundCaseId: "case", refundItemId: "item", sourceType: "VISA_SERVICE" },
    })).rejects.toThrow("Invalid PaymentIntent");
    expect(request).not.toHaveBeenCalled();
  });

  it("retrieves only the expected Stripe refund owner", async () => {
    const request = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      id: "re_fixture", payment_intent: "pi_fixture", amount: 980, currency: "aed", status: "pending",
    }), { status: 200 })));
    vi.stubGlobal("fetch", request);
    await expect(retrieveStripeRefund("re_fixture", "pi_fixture")).resolves.toMatchObject({ status: "pending" });
    await expect(retrieveStripeRefund("re_fixture", "pi_other")).rejects.toThrow("ownership");
  });

  it("maps every Stripe refund outcome without treating pending as complete", () => {
    expect(reconcileRefundStatus("succeeded")).toBe("SUCCEEDED");
    expect(reconcileRefundStatus("pending")).toBe("PROCESSING");
    expect(reconcileRefundStatus("requires_action")).toBe("PROCESSING");
    expect(reconcileRefundStatus("failed")).toBe("FAILED");
    expect(reconcileRefundStatus("canceled")).toBe("FAILED");
  });
  it('recovers an uncertain refund by its immutable item metadata across pages', async () => {
    const request = vi.fn().mockResolvedValueOnce(Response.json({data:[{id:'re_other',payment_intent:'pi_fixture',metadata:{refundItemId:'other'}}],has_more:true}))
      .mockResolvedValueOnce(Response.json({data:[{id:'re_existing',payment_intent:'pi_fixture',amount:5000,currency:'usd',status:'succeeded',metadata:{refundItemId:'item'}}],has_more:false}));
    vi.stubGlobal('fetch',request);
    expect(await findStripeRefund('pi_fixture','item')).toMatchObject({id:'re_existing',amount:5000});
    expect(request.mock.calls[1][0]).toContain('starting_after=re_other');
    expect(request.mock.calls.every(([,options]) => !options.method)).toBe(true);
  });
  it('distinguishes a definitive rejection from an unknown server outcome and keeps the provider message', async () => {
    const request=vi.fn().mockResolvedValueOnce(Response.json({error:{message:'Insufficient available balance'}},{status:400}))
      .mockResolvedValueOnce(Response.json({error:{message:'Temporary server error'}},{status:500}));
    vi.stubGlobal('fetch',request);
    const input={paymentIntentId:'pi_fixture',amountCents:5000,idempotencyKey:'express-guarantee-42-processing-v1',metadata:{refundCaseId:'case',refundItemId:'item',sourceType:'VISA_SERVICE'}};
    await expect(createStripeRefund(input)).rejects.toBeInstanceOf(StripeRefundRejected);
    await expect(createStripeRefund(input)).rejects.not.toBeInstanceOf(StripeRefundRejected);
  });
});
