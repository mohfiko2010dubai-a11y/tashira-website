import { describe, expect, it } from "vitest";
import { validPassportName } from "../../contracts/traveller-details";

describe("Latin passport names", () => {
  it.each(["Mohammed Zaky", "Jean-Luc O'Neill", "José García", "JOHN A. SMITH"])("accepts %s", name => {
    expect(validPassportName(name)).toBe(true);
  });
  it.each(["محمد زكي", "John محمد", "Иван", "1234", "John123", "😀", ""])("rejects %s", name => {
    expect(validPassportName(name)).toBe(false);
  });
});
