import { describe, expect, it } from "vitest";
import { customerFileCount } from "../../../contracts/customer-count";

describe("Arabic customer file counters", () => {
  it.each([[0, "لا توجد ملفات"], [1, "ملف واحد"], [2, "ملفان"], [3, "٣ ملفات"], [11, "١١ ملفًا"], [100, "١٠٠ ملف"]] as const)("renders count %s", (count, copy) => {
    expect(customerFileCount(count, true)).toBe(copy);
  });
  it("uses English singular and plural", () => {
    expect(customerFileCount(1, false)).toBe("1 file");
    expect(customerFileCount(2, false)).toBe("2 files");
  });
});
