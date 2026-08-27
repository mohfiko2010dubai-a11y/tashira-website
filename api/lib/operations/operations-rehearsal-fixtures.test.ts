import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Operations rehearsal fixtures", () => {
  it("contains only explicit synthetic identities and expected legacy cardinality", () => {
    const source = readFileSync(resolve(process.cwd(), "scripts/fixtures/operations-pre-os-data.sql"), "utf8");
    expect(source).toContain("example.invalid");
    expect(source).toContain("TSH-REHEARSAL-FAMILY");
    expect(source).not.toMatch(/tashiraev\.com|pk_(?:test|live)_|sk_(?:test|live)_|whsec_|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/);
    expect(source.match(/\(\d+,\d+,\d+,'Synthetic (?:Lead|Spouse|Child One|Child Two|Single)'/g)).toHaveLength(5);
    expect(source).toContain("(5,2,0,'Synthetic Single'");
  });
});
