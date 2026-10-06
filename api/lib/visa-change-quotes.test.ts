import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
const mocks = vi.hoisted(() => ({ quote: vi.fn(), execute: vi.fn() }));
vi.mock("./pricing-engine", () => ({ quoteApplicationPrice: mocks.quote }));
import { acceptVisaChangeQuote, prepareVisaChangeQuote } from "./visa-change-quotes";
const connection = () => ({ execute: mocks.execute }) as unknown as PoolConnection;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.quote.mockResolvedValue({ totalPrice: 430, currency: "USD", applicantCount: 2 });
  mocks.execute.mockImplementation(async (sql: string) => {
    if (sql.startsWith("SELECT visa_type")) return [[{ visa_type: "30days-single", processing_type: "express", payment_status: "paid" }]];
    if (sql.startsWith("SELECT p.amount")) return [[{ amount: "370.00", currency: "USD", quote_json: { totalPrice: 370, currency: "USD", applicantCount: 2 } }]];
    return [[]];
  });
});
describe("server-priced immutable visa change", () => {
  it("uses the frozen paid party count and records only the difference separately", async () => {
    const result = await prepareVisaChangeQuote(connection(), 7, 2, "60days-single");
    expect(mocks.quote).toHaveBeenCalledWith({ serviceCode: "60days-single", processingType: "express", applicantCount: 2 });
    expect(result).toMatchObject({ oldTotalMinor: 37000, newTotalMinor: 43000, differenceMinor: 6000 });
    expect(mocks.execute.mock.calls.some(([sql]) => sql.startsWith("UPDATE applications"))).toBe(false);
    const insert = mocks.execute.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO visa_change_quotes"));
    expect(insert?.[1].slice(1, 9)).toEqual([7, 2, "30days-single", "60days-single", 37000, 43000, 6000, "USD"]);
  });
  it("refuses a second proposal while accepted funds remain unsettled", async () => {
    mocks.execute.mockResolvedValueOnce([[{ payment_status: "paid" }]]).mockResolvedValueOnce([[{ state: "ACCEPTED" }]]);
    await expect(prepareVisaChangeQuote(connection(), 7, 3, "60days-single")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it("rejects a stale price consent without writes", async () => {
    mocks.execute.mockResolvedValue([[{ id: "current", state: "PROPOSED", difference_minor: 3000 }]]);
    await expect(acceptVisaChangeQuote(connection(), 7, 2, "old")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
  it.each([[3000, "ACCEPTED"], [-3000, "ACCEPTED"], [0, "SETTLED"]])("does not treat consent to %s as a payment", async (difference, state) => {
    mocks.execute.mockResolvedValueOnce([[{ id: "current", state: "PROPOSED", difference_minor: difference }]]).mockResolvedValue([[]]);
    await acceptVisaChangeQuote(connection(), 7, 2, "current");
    expect(mocks.execute.mock.calls[1][1]).toEqual([state, "current"]);
  });
  it("replays consent without resetting the settlement", async () => {
    mocks.execute.mockResolvedValue([[{ id: "current", state: "PAYMENT_PENDING", difference_minor: 3000 }]]);
    await acceptVisaChangeQuote(connection(), 7, 2, "current");
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});
