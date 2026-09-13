import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const forbidden = /10,000\+|98% Satisfaction|٩٨٪ رضا|["']150\+["']|4\.9★|Ahmed K\.|Priya S\.|Omar R\.|Best Price Guarantee|All Nationalities|ضمان أفضل سعر|جميع الجنسيات/i;
const findings = [];
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(?:js|mjs|css|html|json|map)$/.test(file) && forbidden.test(readFileSync(file, 'utf8'))) findings.push(file);
  }
}
scan(resolve('dist'));
if (findings.length) throw new Error(`Unapproved marketing claims remain in build: ${findings.join(', ')}`);
console.log('Built marketing claim scan passed.');
