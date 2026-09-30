import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import wizard from "../../../src/i18n/locales/ar/wizard.json";

describe("Arabic form counters", () => {
  it("uses all six Arabic traveller and validation plural categories", async () => {
    const i18n = createInstance();await i18n.init({ lng: "ar", resources: { ar: { wizard } }, defaultNS: "wizard" });
    const cases = [[0, "zero"], [1, "one"], [2, "two"], [3, "few"], [11, "many"], [100, "other"]] as const;
    for (const [count, category] of cases) {
      expect(i18n.t("step1.priceTotal", { count })).toBe(wizard.step1[`priceTotal_${category}`].replace("{{count}}", String(count)));
      expect(i18n.t("validation.summary", { count })).toBe(wizard.validation[`summary_${category}`].replace("{{count}}", String(count)));
    }
  });
});
