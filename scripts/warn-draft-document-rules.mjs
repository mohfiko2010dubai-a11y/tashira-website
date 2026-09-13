import { readFileSync } from 'node:fs';
const rules = JSON.parse(readFileSync(new URL('../contracts/document-requirement-rules.json', import.meta.url), 'utf8'));
function warn(rows) {
  for (const rule of rows) {
    if (rule.status === 'draft') console.warn(`[Document rules] WARNING: draft rule ${rule.key} is withheld from customers.`);
    warn(rule.any_of ?? rule.all_of ?? []);
  }
}
warn(rules);
