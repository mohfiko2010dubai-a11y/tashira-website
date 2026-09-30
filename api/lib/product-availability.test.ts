import { describe, expect, it, vi, beforeEach } from "vitest";
const db = vi.hoisted(() => ({ execute: vi.fn(), getConnection: vi.fn() }));
vi.mock("./operations/mysql-query-client", () => ({ defaultOperationsPool: () => db }));
import { assertProductAvailable, updateProductAvailability, verificationDue } from "./product-availability";

describe("catalog product controls", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects inactive and unknown products even when their old price rules exist", async () => {
    db.execute.mockResolvedValue([[{ service_code: "90days-single", is_active: 0, version: 1 }]]);
    await expect(assertProductAvailable("90days-single")).rejects.toThrow("not offering this visa");
    await expect(assertProductAvailable("unknown")).rejects.toThrow("not offering this visa");
  });
  it("allows an active product and fails closed if the catalog cannot be read", async () => {
    db.execute.mockResolvedValue([[{ service_code: "30days-single", is_active: 1, version: 1 }]]);
    await expect(assertProductAvailable("30days-single")).resolves.toBeUndefined();
    db.execute.mockRejectedValue(new Error("Database unavailable"));
    await expect(assertProductAvailable("30days-single")).rejects.toThrow("Database unavailable");
  });
  it("requires verification after 90 days and for never-verified products", () => {
    const now = new Date("2026-09-30T00:00:00Z");
    expect(verificationDue(null, now)).toBe(true);
    expect(verificationDue(new Date(now.getTime() - 90 * 86400000), now)).toBe(false);
    expect(verificationDue(new Date(now.getTime() - 91 * 86400000), now)).toBe(true);
  });
  it("rejects a stale admin update without overwriting a concurrent change", async () => {
    const connection = { beginTransaction: vi.fn(), execute: vi.fn().mockResolvedValue([[{ version: 2 }]]), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    db.getConnection.mockResolvedValue(connection);
    await expect(updateProductAvailability({ serviceCode: "90days-single", expectedVersion: 1, isActive: true }, "admin-session")).rejects.toThrow("Product changed");
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
  });
});
