import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { environmentReads, moduleFindings, policyModules } from '../scripts/environment-policy.mjs';

const exceptions: Record<string, string> = JSON.parse(readFileSync('scripts/environment-exceptions.json', 'utf8'));
describe('all modules deny environment access by default', () => {
  it.each(['process.env.APP_ENV', 'const { env } = process', 'import p from "node:process"; p.env',
    'import.meta.env.PROD', 'context.environment === "STAGING"', 'context["environment"]',
    'const { environment: mode } = context', 'runtimeFlagEnvironment()', 'import { env } from "../env"'])(
    'rejects environment access: %s', source => expect(environmentReads(source).length).toBeGreaterThan(0));
  it('allows type context and process mechanics, not environment reads', () => {
    expect(environmentReads('import type { FeatureFlagContext } from "../feature-flags"; const t = settings.passportMonths; process.cwd(); import.meta.dirname;')).toEqual([]);
  });
  it('discovers a new module in a new directory without adding it to any coverage list', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tashira-policy-'));
    try {
      mkdirSync(path.join(root, 'new-feature'));
      const file = path.join(root, 'new-feature', 'new-rule.ts');
      writeFileSync(file, 'export const allowed = process.env.APP_ENV === "STAGING";');
      expect(policyModules(root)).toContain(file.replaceAll('\\', '/'));
      expect(exceptions['new-feature/new-rule.ts']).toBeUndefined();
      expect(environmentReads(readFileSync(file, 'utf8')).length).toBeGreaterThan(0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('has no unreviewed environment reader anywhere in source or tooling', () => {
    expect(moduleFindings().filter(({ file }) => !exceptions[file])).toEqual([]);
  }, 30_000); // Whole-repository AST scan competes with the full suite on Windows.
  it('requires exact existing exception paths and written reasons; no wildcards', () => {
    const modules = new Set(policyModules());
    for (const [file, reason] of Object.entries(exceptions)) {
      expect(file).not.toMatch(/[?*]/);
      expect(modules.has(file), file).toBe(true);
      expect(reason.trim().length, file).toBeGreaterThan(20);
    }
  });
});
