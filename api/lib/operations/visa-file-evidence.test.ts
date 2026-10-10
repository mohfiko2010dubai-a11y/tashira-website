import { mkdtemp, writeFile, readFile, readdir, chmod, symlink, rm, truncate } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureScannedVisaFile, readVerifiedVisaFile, VISA_FILE_LIMIT, type VisaScanResult } from './visa-file-evidence';

const roots: string[] = [];
const bytes = Buffer.from('%PDF-1.7\nSynthetic visa fixture only\n%%EOF');
const clean: VisaScanResult = { outcome: 'CLEAN', engineVersion: 'ClamAV 1.5.4', databaseVersion: '28149' };
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tashira-visa-evidence-')); roots.push(root);
  await writeFile(path.join(root, 'visa.pdf'), bytes);
  return { storageRoot: root, sourcePath: 'visa.pdf', scan: vi.fn(async () => clean), now: () => new Date('2026-10-11T00:00:00Z') };
}
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
describe('byte-bound visa delivery evidence', () => {
  it('keeps the scanned snapshot when the original is replaced, without exposing its filename', async () => {
    const f = await fixture(); const evidence = await captureScannedVisaFile(f);
    await writeFile(path.join(f.storageRoot, f.sourcePath), 'replaced');
    expect(await readVerifiedVisaFile(f.storageRoot, evidence)).toEqual(bytes);
    expect(evidence.storagePath).toMatch(/^\.visa-delivery-files\/[a-f0-9-]+\.pdf$/);
    expect(evidence).toMatchObject({ byteLength: bytes.length, mimeType: 'application/pdf', scannedAt: '2026-10-11T00:00:00.000Z' });
    expect(f.scan).toHaveBeenCalledWith(bytes);
  });
  it.each(['INFECTED', 'ERROR'] as const)('creates no delivered copy after %s', async outcome => {
    const f = await fixture();
    await expect(captureScannedVisaFile({ ...f, scan: async () => ({ ...clean, outcome }) })).rejects.toThrow(outcome === 'INFECTED' ? 'VISA_FILE_SCAN_INFECTED' : 'VISA_FILE_SCAN_UNAVAILABLE');
    expect(await readdir(f.storageRoot)).toEqual(['visa.pdf']);
  });
  it('fails closed on scanner exceptions without leaking raw errors or paths', async () => {
    const f = await fixture();
    await expect(captureScannedVisaFile({ ...f, scan: async () => { throw new Error('secret filename and provider payload'); } })).rejects.toThrow(/^VISA_FILE_CAPTURE_FAILED$/);
    expect(await readdir(f.storageRoot)).toEqual(['visa.pdf']);
  });
  it('detects mutation by a scanner adapter', async () => {
    const f = await fixture();
    await expect(captureScannedVisaFile({ ...f, scan: async value => { value.fill(0); return clean; } })).rejects.toThrow('VISA_FILE_CHANGED_DURING_SCAN');
    expect(await readFile(path.join(f.storageRoot, f.sourcePath))).toEqual(bytes);
  });
  it('rejects tampered archived bytes, size, hash and MIME evidence', async () => {
    const f = await fixture(); const evidence = await captureScannedVisaFile(f);
    for (const changed of [{ ...evidence, byteLength: 1 }, { ...evidence, contentSha256: 'b'.repeat(64) }, { ...evidence, mimeType: 'image/png' as const }]) await expect(readVerifiedVisaFile(f.storageRoot, changed)).rejects.toThrow('VISA_FILE_INTEGRITY_FAILED');
    await chmod(path.join(f.storageRoot, evidence.storagePath), 0o600);
    await writeFile(path.join(f.storageRoot, evidence.storagePath), Buffer.alloc(bytes.length, 65));
    await expect(readVerifiedVisaFile(f.storageRoot, evidence)).rejects.toThrow('VISA_FILE_INTEGRITY_FAILED');
  });
  it('rejects traversal and symbolic-link sources and archive directories', async () => {
    const f = await fixture();
    for (const sourcePath of ['../visa.pdf', '/visa.pdf', 'nested/../visa.pdf', 'C:\\visa.pdf']) await expect(captureScannedVisaFile({ ...f, sourcePath })).rejects.toThrow('VISA_FILE_PATH_UNSAFE');
    const other = await fixture();
    await symlink(other.storageRoot, path.join(f.storageRoot, 'linked'), 'junction');
    await expect(captureScannedVisaFile({ ...f, sourcePath: 'linked/visa.pdf' })).rejects.toThrow('VISA_FILE_PATH_UNSAFE');
    await symlink(other.storageRoot, path.join(f.storageRoot, '.visa-delivery-files'), 'junction');
    await expect(captureScannedVisaFile(f)).rejects.toThrow('VISA_FILE_PATH_UNSAFE');
  });
  it('rejects unsupported and oversized files before sending anything to the scanner', async () => {
    const f = await fixture();
    await writeFile(path.join(f.storageRoot, f.sourcePath), 'not a supported image or PDF');
    await expect(captureScannedVisaFile(f)).rejects.toThrow('VISA_FILE_FORMAT_UNSUPPORTED');
    await truncate(path.join(f.storageRoot, f.sourcePath), VISA_FILE_LIMIT + 1);
    await expect(captureScannedVisaFile(f)).rejects.toThrow('VISA_FILE_SIZE_INVALID');
    expect(f.scan).not.toHaveBeenCalled();
  });
  it('never overwrites a snapshot when captures run concurrently', async () => {
    const f = await fixture(); const [first, second] = await Promise.all([captureScannedVisaFile(f), captureScannedVisaFile(f)]);
    expect(first.storagePath).not.toBe(second.storagePath);
    expect(first.contentSha256).toBe(second.contentSha256);
    expect(await readVerifiedVisaFile(f.storageRoot, first)).toEqual(await readVerifiedVisaFile(f.storageRoot, second));
  });
});
