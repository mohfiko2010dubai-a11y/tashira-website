import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PROCESSING_COPY, processingCopy } from "../../contracts/processing-copy";

describe("Owner-approved processing copy", () => {
  it("keeps the exact handling statements and Arabic fallback together", () => {
    expect(PROCESSING_COPY.en.regular).toBe("We submit your application within 48 hours of your documents being complete. Issuing time is decided by the authority.");
    expect(PROCESSING_COPY.en.express).toBe("Priority handling — we submit within 24 hours of your documents being complete, or we refund the express fee in full. Issuing time is decided by the authority.");
    expect(processingCopy("ar-AE")).toBe(PROCESSING_COPY.ar);
    expect(processingCopy("fr")).toBe(PROCESSING_COPY.en);
  });
  it("has no obsolete processing durations in shipped UI or API source", () => {
    const obsolete = /24\s*[-–]\s*48|3\s*[-–]\s*4\s+(?:working|business|days)|72\s+business|24\s+(?:to|إلى)\s+(?:36|48|72)/i;
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = resolve(dir, entry.name);
        if (entry.isDirectory()) scan(file);
        else if (/\.(?:tsx?|json)$/.test(file) && !/\.(?:test|spec)\./.test(file)) expect(readFileSync(file, "utf8"), file).not.toMatch(obsolete);
      }
    };
    scan(resolve("src")); scan(resolve("api"));
  });
  it("uses shared i18n references for wizard and processing FAQ", () => {
    for (const lang of ["en", "ar"]) {
      const wizard = JSON.parse(readFileSync(resolve(`src/i18n/locales/${lang}/wizard.json`), "utf8"));
      const home = JSON.parse(readFileSync(resolve(`src/i18n/locales/${lang}/home.json`), "utf8"));
      expect(wizard.step1.regularDesc).toBe("$t(processing:regular)");
      expect(wizard.step1.expressDesc).toBe("$t(processing:express)");
      expect(home.faq.items.some((item: { answer: string }) => item.answer === "$t(processing:regular) $t(processing:express)")).toBe(true);
    }
  });
});
