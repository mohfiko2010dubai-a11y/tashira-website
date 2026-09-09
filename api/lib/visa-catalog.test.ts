import { describe, expect, it, vi } from "vitest";

vi.mock("../queries/connection", () => ({ getDb: vi.fn() }));

import { getActiveCatalogProducts } from "./visa-catalog";
import { getDb } from "../queries/connection";

function mockSelect(rows: unknown[]) {
  return () => ({
    from: () => ({
      where: () => ({
        orderBy: () => Promise.resolve(rows),
      }),
    }),
  });
}

describe("visa-catalog getActiveCatalogProducts", () => {
  it("returns products enriched with active regular and express prices", async () => {
    const mockGetDb = vi.mocked(getDb);
    mockGetDb.mockReturnValue({
      select: mockSelect([
        {
          id: 1,
          serviceCode: "30days-single",
          processingType: "regular",
          version: 1,
          sellingPrice: "185.00",
          promotionalPrice: null,
          currency: "USD",
          effectiveAt: new Date("2020-01-01"),
          expiresAt: null,
        },
        {
          id: 2,
          serviceCode: "30days-single",
          processingType: "express",
          version: 1,
          sellingPrice: "215.00",
          promotionalPrice: null,
          currency: "USD",
          effectiveAt: new Date("2020-01-01"),
          expiresAt: null,
        },
      ]),
    } as unknown as ReturnType<typeof getDb>);

    const products = await getActiveCatalogProducts();
    const product = products.find((p) => p.id === "30days-single");
    expect(product).toBeDefined();
    expect(product?.regularPrice).toBe(185);
    expect(product?.expressPrice).toBe(215);
    expect(product?.currency).toBe("USD");
  });

  it("hides express option when no express pricing rule exists", async () => {
    const mockGetDb = vi.mocked(getDb);
    mockGetDb.mockReturnValue({
      select: mockSelect([
        {
          id: 1,
          serviceCode: "96hours-transit",
          processingType: "regular",
          version: 1,
          sellingPrice: "145.00",
          promotionalPrice: null,
          currency: "USD",
          effectiveAt: new Date("2020-01-01"),
          expiresAt: null,
        },
      ]),
    } as unknown as ReturnType<typeof getDb>);

    const products = await getActiveCatalogProducts();
    const product = products.find((p) => p.id === "96hours-transit");
    expect(product).toBeDefined();
    expect(product?.regularPrice).toBe(145);
    expect(product?.expressPrice).toBeNull();
  });

  it("excludes products without a regular price", async () => {
    const mockGetDb = vi.mocked(getDb);
    mockGetDb.mockReturnValue({
      select: mockSelect([
        {
          id: 1,
          serviceCode: "unknown-visa",
          processingType: "regular",
          version: 1,
          sellingPrice: "99.00",
          promotionalPrice: null,
          currency: "USD",
          effectiveAt: new Date("2020-01-01"),
          expiresAt: null,
        },
      ]),
    } as unknown as ReturnType<typeof getDb>);

    const products = await getActiveCatalogProducts();
    expect(products.some((p) => p.id === "unknown-visa")).toBe(false);
  });

  it("uses promotional price when present", async () => {
    const mockGetDb = vi.mocked(getDb);
    mockGetDb.mockReturnValue({
      select: mockSelect([
        {
          id: 1,
          serviceCode: "14days-single",
          processingType: "regular",
          version: 2,
          sellingPrice: "165.00",
          promotionalPrice: "150.00",
          currency: "USD",
          effectiveAt: new Date("2020-01-01"),
          expiresAt: null,
        },
      ]),
    } as unknown as ReturnType<typeof getDb>);

    const products = await getActiveCatalogProducts();
    const product = products.find((p) => p.id === "14days-single");
    expect(product?.regularPrice).toBe(150);
  });

  it("groups single and multiple entry products correctly", async () => {
    const mockGetDb = vi.mocked(getDb);
    mockGetDb.mockReturnValue({
      select: mockSelect([
        {
          id: 1,
          serviceCode: "30days-single",
          processingType: "regular",
          version: 1,
          sellingPrice: "185.00",
          promotionalPrice: null,
          currency: "USD",
          effectiveAt: new Date("2020-01-01"),
          expiresAt: null,
        },
        {
          id: 2,
          serviceCode: "30days-multiple",
          processingType: "regular",
          version: 1,
          sellingPrice: "285.00",
          promotionalPrice: null,
          currency: "USD",
          effectiveAt: new Date("2020-01-01"),
          expiresAt: null,
        },
      ]),
    } as unknown as ReturnType<typeof getDb>);

    const products = await getActiveCatalogProducts();
    const single = products.filter((p) => p.entryType === "single");
    const multiple = products.filter((p) => p.entryType === "multiple");
    expect(single.some((p) => p.id === "30days-single")).toBe(true);
    expect(multiple.some((p) => p.id === "30days-multiple")).toBe(true);
  });
});
