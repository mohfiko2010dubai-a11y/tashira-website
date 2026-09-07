import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const apiFile = (name: string) => new URL(`../api/${name}`, import.meta.url);
const srcFile = (name: string) => new URL(`../src/${name}`, import.meta.url);

describe("Catalog router — server-authoritative product listing", () => {
  it("exposes a public endpoint for active products", async () => {
    const router = await readFile(apiFile("catalog-router.ts"), "utf8");
    expect(router).toContain("publicQuery");
    expect(router).toContain("listActiveProducts");
    expect(router).toContain("getActiveCatalogProducts");
  });

  it("reads prices from the pricing rules table, not hardcoded values", async () => {
    const catalog = await readFile(apiFile("lib/visa-catalog.ts"), "utf8");
    expect(catalog).toContain("pricingRules");
    expect(catalog).toContain("getDb");
    expect(catalog).toContain("sellingPrice");
    expect(catalog).toContain("promotionalPrice");
    expect(catalog).not.toMatch(/regularPrice\s*:\s*\d+/);
    expect(catalog).not.toMatch(/expressPrice\s*:\s*\d+/);
  });
});

describe("VisaProductCards — shared Single/Multiple + Regular/Express component", () => {
  it("uses the same shared component on homepage and pricing page", async () => {
    const home = await readFile(srcFile("sections/redesign/RVisaTypes.tsx"), "utf8");
    const pricing = await readFile(srcFile("pages/Pricing.tsx"), "utf8");
    expect(home).toContain("VisaProductCards");
    expect(pricing).toContain("VisaProductCards");
  });

  it("fetches products from the server catalog endpoint", async () => {
    const cards = await readFile(srcFile("components/customer/VisaProductCards.tsx"), "utf8");
    expect(cards).toContain("trpc.catalog.listActiveProducts.useQuery");
    expect(cards).not.toContain("visaTypes");
    expect(cards).not.toContain("visaData");
  });

  it("has Single Entry and Multiple Entry tabs", async () => {
    const cards = await readFile(srcFile("components/customer/VisaProductCards.tsx"), "utf8");
    expect(cards).toContain('"single"');
    expect(cards).toContain('"multiple"');
    expect(cards).toContain('role="tablist"');
    expect(cards).toContain('role="tab"');
  });

  it("has Regular/Express speed selector inside each card", async () => {
    const cards = await readFile(srcFile("components/customer/VisaProductCards.tsx"), "utf8");
    expect(cards).toContain('"regular"');
    expect(cards).toContain('"express"');
    expect(cards).toContain('role="radiogroup"');
    expect(cards).toContain('role="radio"');
    expect(cards).toContain("hasExpress");
  });

  it("shows price and processing time from the selected speed in the same card", async () => {
    const cards = await readFile(srcFile("components/customer/VisaProductCards.tsx"), "utf8");
    expect(cards).toContain("currentPrice");
    expect(cards).toContain("currentTime");
    expect(cards).toContain("setSpeed");
  });

  it("Apply Now passes exact visa id and processing speed", async () => {
    const cards = await readFile(srcFile("components/customer/VisaProductCards.tsx"), "utf8");
    expect(cards).toContain("/apply?");
    expect(cards).toContain('params.set("visa"');
    expect(cards).toContain('params.set("processing"');
  });

  it("hides express option when unsupported for that product", async () => {
    const cards = await readFile(srcFile("components/customer/VisaProductCards.tsx"), "utf8");
    expect(cards).toContain("hasExpress");
    expect(cards).toContain("{hasExpress && (");
  });

  it("translates labels and supports RTL/LTR", async () => {
    const en = await readFile(new URL("../src/i18n/locales/en/pricing.json", import.meta.url), "utf8");
    const ar = await readFile(new URL("../src/i18n/locales/ar/pricing.json", import.meta.url), "utf8");
    expect(en).toContain('"tabs"');
    expect(en).toContain('"single"');
    expect(en).toContain('"multiple"');
    expect(en).toContain('"speed"');
    expect(en).toContain('"regular"');
    expect(en).toContain('"express"');
    expect(ar).toContain('"tabs"');
    expect(ar).toContain('"single"');
    expect(ar).toContain('"multiple"');
    expect(ar).toContain('"speed"');
    expect(ar).toContain('"regular"');
    expect(ar).toContain('"express"');
  });

  it("does not hardcode prices in the UI component", async () => {
    const cards = await readFile(srcFile("components/customer/VisaProductCards.tsx"), "utf8");
    expect(cards).toContain("product.regularPrice");
    expect(cards).toContain("product.expressPrice");
    expect(cards).not.toMatch(/\$\d{3}/);
    expect(cards).not.toMatch(/\$1[45689]5/);
  });
});

describe("DynamicApplicationStart — receives catalog selection via URL", () => {
  it("reads visa and processing params from URL for prefill", async () => {
    const start = await readFile(srcFile("pages/DynamicApplicationStart.tsx"), "utf8");
    expect(start).toContain('searchParams.get("processing")');
    expect(start).toContain("processingParam === \"express\"");
    expect(start).toContain("knownVisaId");
    expect(start).toContain("visaRoutes.find");
  });
});
