import { createServer, type Server } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createClamdVisaScanner } from './clamd-visa-scanner';
const servers: Server[] = [], roots: string[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
// Wire-level fake exercises framing/failures. Genuine ClamAV acceptance is a separate staging gate.
async function daemon(version: string, verdict: string | null) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tsh-clamd-')); roots.push(root);
  const socketPath = os.platform() === 'win32' ? `\\\\.\\pipe\\tsh-${randomUUID()}` : path.join(root, 'scan.sock');
  const captured: Buffer[] = [];
  const server = createServer(socket => {
    let input = Buffer.alloc(0);
    socket.on('data', chunk => {
      input = Buffer.concat([input, chunk]);
      if (input.subarray(0, 9).toString() === 'zVERSION\0') { socket.end(`${version}\0`); return; }
      if (input.subarray(0, 10).toString() !== 'zINSTREAM\0') return;
      let offset = 10; const parts: Buffer[] = [];
      while (offset + 4 <= input.length) {
        const size = input.readUInt32BE(offset); offset += 4;
        if (!size) { captured.push(Buffer.concat(parts)); if (verdict !== null) socket.end(`${verdict}\0`); return; }
        if (offset + size > input.length) return;
        parts.push(input.subarray(offset, offset + size)); offset += size;
      }
    });
  });
  servers.push(server); await new Promise<void>(resolve => server.listen(socketPath, resolve));
  return { socketPath, captured };
}
const now = () => new Date('2026-10-11T00:00:00Z');
const version = 'ClamAV 1.5.4/28149/Sat Oct 10 12:00:00 2026';
describe('local ClamD visa scanner', () => {
  it('refuses non-local socket settings before connecting', async () => {
    await expect(createClamdVisaScanner('https://external.invalid', now)(Buffer.from('test'))).rejects.toThrow('VISA_FILE_SCAN_UNAVAILABLE');
  });
  it('fails closed when no daemon exists', async () => {
    await expect(createClamdVisaScanner('/nonexistent-tashira-scanner.sock', now, 50)(Buffer.from('test'))).rejects.toThrow('VISA_FILE_SCAN_UNAVAILABLE');
  });
  it('streams exact bytes in bounded frames and preserves verified engine/database identity', async () => {
    const d = await daemon(version, 'stream: OK');
    const bytes = Buffer.alloc(150_000, 65);
    const result = await createClamdVisaScanner(d.socketPath, now)(bytes);
    expect(result).toEqual({ outcome: 'CLEAN', engineVersion: 'ClamAV 1.5.4', databaseVersion: '28149' });
    expect(d.captured).toEqual([bytes]);
  });
  it('rejects stale signatures before sending document bytes', async () => {
    const d = await daemon('ClamAV 1.5.4/28100/Mon Sep 1 12:00:00 2025', 'stream: OK');
    await expect(createClamdVisaScanner(d.socketPath, now)(Buffer.from('test'))).rejects.toThrow('VISA_FILE_SCAN_DATABASE_STALE');
    expect(d.captured).toHaveLength(0);
  });
  it.each(['stream: Eicar-Signature FOUND', 'stream: Heuristics.Limits.Exceeded.MaxScanTime FOUND'])('rejects an unsafe verdict: %s', async verdict => {
    const d = await daemon(version, verdict);
    expect((await createClamdVisaScanner(d.socketPath, now)(Buffer.from('test'))).outcome).toBe('INFECTED');
  });
  it('does not treat a daemon error as a clean file', async () => {
    const d = await daemon(version, 'stream: scanning error ERROR');
    await expect(createClamdVisaScanner(d.socketPath, now)(Buffer.from('test'))).rejects.toThrow('VISA_FILE_SCAN_UNAVAILABLE');
  });
  it('times out and closes the connection if the scanner never answers', async () => {
    const d = await daemon(version, null);
    await expect(createClamdVisaScanner(d.socketPath, now, 100)(Buffer.from('test'))).rejects.toThrow('VISA_FILE_SCAN_TIMEOUT');
  });
});
