import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** @param {readonly string[]} files */
export function assertReleaseContainsNoRuntimeData(files) {
  const forbidden = files.filter(file => /(^|\/)(storage|logs|backups|secrets|uploads)\//i.test(file)
    || /(^|\/)(dist\/public|public)\/invoices\//i.test(file)
    || /(^|\/)\.staging-db-password$/i.test(file)
    || /\.(sql\.gz|sqlite|sqlite3|dump)$/i.test(file)
    || /(^|\/)\.env($|\.)/i.test(file) && !/\.(example|template)$/i.test(file));
  if (forbidden.length) throw new Error('Release contains runtime data or secrets. Remove those paths from the release before deployment.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  assertReleaseContainsNoRuntimeData(files);
  console.log('Release data boundary verified: no tracked runtime storage, invoices, logs, backups or secrets.');
}
