import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("the build warning names every draft, including nested choices, without failing the build", () => {
  const directory = mkdtempSync(join(tmpdir(), "tashira-rule-warning-"));
  try {
    mkdirSync(join(directory, "scripts")); mkdirSync(join(directory, "contracts"));
    const script = join(directory, "scripts/warn-draft-document-rules.mjs");
    copyFileSync(resolve("scripts/warn-draft-document-rules.mjs"), script);
    writeFileSync(join(directory, "contracts/document-requirement-rules.json"), JSON.stringify([
      { key: "draft_country", status: "draft" }, { key: "approved_choice", status: "approved", any_of: [{ key: "draft_option", status: "draft" }] },
    ]));
    const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("draft rule draft_country"); expect(result.stderr).toContain("draft rule draft_option");
    expect(result.stderr).not.toContain("draft rule approved_choice");
  } finally { rmSync(directory, { recursive: true }); }
});
