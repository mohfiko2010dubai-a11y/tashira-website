import { describe, expect, it, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
import { issuePaidInvoice } from "./invoice-archive";

describe("previously issued invoices", () => {
  it("keeps a legacy invoice without rebuilding its customer or payer snapshot", async () => {
    const execute = vi.fn().mockResolvedValue([[{ invoice_number: "INV-LEGACY", payment_id: 7 }], []]);
    const connection = { execute } as unknown as PoolConnection;
    expect(await issuePaidInvoice(connection, 1, 7)).toBe("INV-LEGACY");
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it("does not attach another payment to an existing invoice", async () => {
    const connection = { execute: vi.fn().mockResolvedValue([[{ invoice_number: "INV-LEGACY", payment_id: 8 }], []]) } as unknown as PoolConnection;
    await expect(issuePaidInvoice(connection, 1, 7)).rejects.toThrow("another payment");
  });
  it("requires verified source data for a new invoice", async () => {
    const connection = { execute: vi.fn().mockResolvedValue([[], []]) } as unknown as PoolConnection;
    await expect(issuePaidInvoice(connection, 1, 7)).rejects.toThrow("Verified invoice snapshot");
  });
});
