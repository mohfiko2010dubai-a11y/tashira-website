import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const VISA_FILE_LIMIT = 20 * 1024 * 1024;
const archiveDirectory = '.visa-delivery-files';
const archivePattern = /^\.visa-delivery-files\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$/;
export type VisaFileMime = 'application/pdf' | 'image/jpeg' | 'image/png';
export type VisaScanResult = { outcome: 'CLEAN' | 'INFECTED' | 'ERROR'; engineVersion: string; databaseVersion: string };
export type VisaFileEvidence = {
  storagePath: string; contentSha256: string; byteLength: number; mimeType: VisaFileMime;
  engineVersion: string; databaseVersion: string; scannedAt: string;
};
export type VisaByteScanner = (bytes: Buffer) => Promise<VisaScanResult>;

function digest(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }
function format(bytes: Buffer): { mime: VisaFileMime; extension: string } {
  if (bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) return { mime: 'application/pdf', extension: 'pdf' };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: 'image/jpeg', extension: 'jpg' };
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: 'image/png', extension: 'png' };
  throw new Error('VISA_FILE_FORMAT_UNSUPPORTED');
}
async function safePath(root: string, relative: string): Promise<string> {
  if (!relative || relative.includes('\\') || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('VISA_FILE_PATH_UNSAFE');
  const base = await realpath(root);
  const candidate = path.resolve(base, relative);
  const within = path.relative(base, candidate);
  if (!within || within.startsWith('..') || path.isAbsolute(within)) throw new Error('VISA_FILE_PATH_UNSAFE');
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error('VISA_FILE_PATH_UNSAFE');
  }
  return candidate;
}
async function boundedRead(root: string, relative: string): Promise<Buffer> {
  const full = await safePath(root, relative);
  const handle = await open(full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > VISA_FILE_LIMIT) throw new Error('VISA_FILE_SIZE_INVALID');
    // A bounded buffer prevents a concurrently growing file from exhausting memory.
    const bytes = Buffer.alloc(before.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!read.bytesRead) break;
      offset += read.bytesRead;
    }
    const after = await handle.stat();
    if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new Error('VISA_FILE_CHANGED_DURING_READ');
    return bytes.subarray(0, offset);
  } finally { await handle.close(); }
}

/** Capture and scan one private copy; neither a later upload nor a retry can replace it. */
export async function captureScannedVisaFile(input: {
  storageRoot: string; sourcePath: string; scan: VisaByteScanner; now: () => Date;
}): Promise<VisaFileEvidence> {
  let created: string | undefined;
  try {
    const bytes = await boundedRead(input.storageRoot, input.sourcePath);
    const detected = format(bytes);
    const contentSha256 = digest(bytes);
    const scanBytes = Buffer.from(bytes);
    const scan = await input.scan(scanBytes);
    if (digest(scanBytes) !== contentSha256) throw new Error('VISA_FILE_CHANGED_DURING_SCAN');
    if (scan.outcome !== 'CLEAN') throw new Error(scan.outcome === 'INFECTED' ? 'VISA_FILE_SCAN_INFECTED' : 'VISA_FILE_SCAN_UNAVAILABLE');
    if (![scan.engineVersion, scan.databaseVersion].every(value => value.length > 0 && value.length <= 100 && /^[\w .:/+-]+$/.test(value))) throw new Error('VISA_FILE_SCAN_EVIDENCE_INVALID');
    const scannedAt = input.now().toISOString();
    const root = await realpath(input.storageRoot);
    const directory = path.join(root, archiveDirectory);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await safePath(root, archiveDirectory);
    const storagePath = `${archiveDirectory}/${randomUUID()}.${detected.extension}`;
    const full = path.join(root, storagePath);
    const file = await open(full, 'wx', 0o400);
    created = full;
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    return { storagePath, contentSha256, byteLength: bytes.length, mimeType: detected.mime, engineVersion: scan.engineVersion, databaseVersion: scan.databaseVersion, scannedAt };
  } catch (error) {
    if (created) await unlink(created).catch(() => undefined);
    if (error instanceof Error && /^VISA_FILE_[A-Z_]+$/.test(error.message)) throw error;
    throw new Error('VISA_FILE_CAPTURE_FAILED');
  }
}

/** Always hash the bytes actually returned, not a separate earlier read of the path. */
export async function readVerifiedVisaFile(storageRoot: string, evidence: VisaFileEvidence): Promise<Buffer> {
  try {
    if (!archivePattern.test(evidence.storagePath) || !/^[a-f0-9]{64}$/.test(evidence.contentSha256)) throw new Error('VISA_FILE_EVIDENCE_INVALID');
    const bytes = await boundedRead(storageRoot, evidence.storagePath);
    if (bytes.length !== evidence.byteLength || digest(bytes) !== evidence.contentSha256 || format(bytes).mime !== evidence.mimeType) throw new Error('VISA_FILE_INTEGRITY_FAILED');
    return bytes;
  } catch (error) {
    if (error instanceof Error && /^VISA_FILE_[A-Z_]+$/.test(error.message)) throw error;
    throw new Error('VISA_FILE_READ_FAILED');
  }
}

/** Roll back a newly created, uncommitted snapshot only. Never use for retained deliveries. */
export async function discardUncommittedVisaFile(storageRoot: string, evidence: VisaFileEvidence): Promise<void> {
  if (!archivePattern.test(evidence.storagePath)) throw new Error('VISA_FILE_PATH_UNSAFE');
  const full = await safePath(storageRoot, evidence.storagePath);
  await unlink(full);
}
