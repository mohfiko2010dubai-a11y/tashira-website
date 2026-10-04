import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Generated output and dependencies cannot introduce application source.
const excludedDirectories = new Set(['.git', 'node_modules', 'dist', 'tmp', 'coverage', '.codex', '.agents']);
export function policyModules(root = '.') {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : policyModules(file);
    return /\.(?:[cm]?[jt]s|tsx|jsx)$/.test(file) ? [file.replaceAll('\\', '/').replace(/^\.\//, '')] : [];
  });
}

export function environmentReads(text) {
  const source = ts.createSourceFile('module.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  function visit(node) {
    if (ts.isTypeNode(node) || (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly)) return;
    if (ts.isIdentifier(node) && ['process', 'Deno', 'Bun', 'runtimeFlagEnvironment', 'isProduction', 'isStaging'].includes(node.text)) {
      // cwd/pid are process mechanics, not environment-derived business policy.
      const parent = node.parent;
      if (!(ts.isPropertyAccessExpression(parent) && parent.expression === node && ['cwd', 'pid', 'exit', 'exitCode', 'argv', 'stdout', 'stderr', 'stdin', 'on', 'hrtime', 'uptime', 'memoryUsage', 'execPath', 'kill', 'platform'].includes(parent.name.text))) findings.push(node.text);
    }
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && !(ts.isPropertyAccessExpression(node.parent) && ['url', 'dirname', 'filename'].includes(node.parent.name.text))) findings.push('import.meta');
    if ((ts.isPropertyAccessExpression(node) && ['env', 'environment'].includes(node.name.text)) ||
      (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && ['env', 'environment'].includes(node.argumentExpression.text))) findings.push(node.getText(source));
    if (ts.isBindingElement(node) && ['env', 'environment'].includes((node.propertyName ?? node.name).getText(source))) findings.push(node.getText(source));
    if (ts.isStringLiteral(node) && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isCallExpression(node.parent)) && /^(?:node:)?process$|(?:^|\/)env(?:\.[cm]?[jt]s)?$/.test(node.text)) findings.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...new Set(findings)];
}

export function moduleFindings() {
  return policyModules().flatMap(file => {
    // Test code is never shipped. New production modules receive no such exemption.
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) return [];
    const reads = environmentReads(readFileSync(file, 'utf8'));
    return reads.length ? [{ file, reads }] : [];
  });
}
