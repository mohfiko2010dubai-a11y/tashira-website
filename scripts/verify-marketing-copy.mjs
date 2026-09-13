import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

// Bundle the same rules implementation used by CMS validation; no second regex set.
const bundle = await build({ entryPoints: ['contracts/marketing-compliance.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { findMarketingViolations } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const files = ['index.html', 'contracts/public-page-metadata.json'];
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.(?:tsx?|json)$/.test(file) && !/\.(?:test|spec)\./.test(file)) files.push(file);
  }
}
collect('src/pages');
collect('src/sections');
collect('src/i18n/locales');
let failures = 0;
for (const file of files) {
  for (const violation of findMarketingViolations(readFileSync(file, 'utf8'))) {
    console.error(`${relative(process.cwd(), resolve(file))}:${violation.line}: prohibited marketing claim: ${violation.phrase}`);
    failures++;
  }
}
if (failures) process.exitCode = 1;
else console.log('Marketing claim compliance passed.');
