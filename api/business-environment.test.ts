import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Domain directories are recursive: a new rule file is covered automatically.
// Deployment, authentication and synthetic-fixture isolation belong outside them.
const directories = ["contracts", "api/lib/customer", "api/lib/eligibility"];
const boundaryFiles = ["api/application-router.ts", "api/dynamic-interview-router.ts",
  "api/lib/application-readiness.ts", "api/lib/pricing-engine.ts",
  "api/lib/nationality-availability.ts", "api/lib/product-availability.ts",
  "api/lib/requirements/mysql-requirement-catalog-provider.ts"];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.tsx?$/.test(file) && !/\.(test|spec)\./.test(file) ? [file] : [];
  });
}

function environmentReads(text: string): string[] {
  const source = ts.createSourceFile("rule.ts", text, ts.ScriptTarget.Latest, true);
  const failures: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) return;
    if (ts.isTypeNode(node)) return;
    if (ts.isIdentifier(node) && ["process", "Deno", "Bun", "runtimeFlagEnvironment", "isProduction", "isStaging"].includes(node.text)) failures.push(node.text);
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) failures.push("import.meta");
    if ((ts.isPropertyAccessExpression(node) && ["env", "environment"].includes(node.name.text)) ||
        (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && ["env", "environment"].includes(node.argumentExpression.text))) failures.push(node.getText(source));
    if (ts.isBindingElement(node) && ["env", "environment"].includes((node.propertyName ?? node.name).getText(source))) failures.push(node.getText(source));
    if (ts.isStringLiteral(node) && /^(?:node:)?process$|(?:^|\/)env(?:\.[cm]?[jt]s)?$/.test(node.text)) failures.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return failures;
}

describe("business policy cannot depend on deployment environment", () => {
  it.each(['process.env.APP_ENV', 'const { env } = process', 'import p from "node:process"; p.env',
    'import.meta.env.PROD', 'context.environment === "STAGING"', 'context["environment"]',
    'const { environment: mode } = context', 'runtimeFlagEnvironment()', 'import { env } from "../env"'])(
    "rejects environment access: %s", source => expect(environmentReads(source).length).toBeGreaterThan(0));
  it("allows business settings and type-only transport context", () => {
    expect(environmentReads('import type { FeatureFlagContext } from "../feature-flags"; const threshold = settings.passportMonths;')).toEqual([]);
  });
  it("checks all policy source, not just the eight fixed instances", () => {
    const files = [...new Set([...directories.flatMap(sourceFiles), ...boundaryFiles])];
    const failures = files.flatMap(file => environmentReads(readFileSync(file, "utf8")).map(read => `${file}: ${read}`));
    expect(failures).toEqual([]);
  });
});
