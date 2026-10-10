import { createConnection } from 'node:net';
import { VISA_FILE_LIMIT, type VisaByteScanner } from './visa-file-evidence';

function request(socketPath: string, payload: Buffer, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let response = Buffer.alloc(0), settled = false;
    const finish = (error?: Error, value?: string) => {
      if (settled) return;
      settled = true; clearTimeout(timer); socket.destroy();
      if (error) reject(error); else resolve(value!);
    };
    const timer = setTimeout(() => finish(new Error('VISA_FILE_SCAN_TIMEOUT')), timeoutMs);
    socket.on('connect', () => { socket.write(payload); });
    socket.on('error', () => finish(new Error('VISA_FILE_SCAN_UNAVAILABLE')));
    socket.on('close', () => { if (!settled) finish(new Error('VISA_FILE_SCAN_UNAVAILABLE')); });
    socket.on('data', chunk => {
      response = Buffer.concat([response, chunk]);
      if (response.length > 4096) return finish(new Error('VISA_FILE_SCAN_RESPONSE_INVALID'));
      const end = response.indexOf(0);
      if (end !== -1) finish(undefined, response.subarray(0, end).toString('utf8').trim());
    });
  });
}

/** Local Unix socket only: no document bytes are sent to an external service. */
export function createClamdVisaScanner(socketPath: string, now: () => Date, timeoutMs = 15_000): VisaByteScanner {
  return async bytes => {
    if ((!socketPath.startsWith('/') && !socketPath.startsWith('\\\\.\\pipe\\')) || socketPath.includes('\0')) throw new Error('VISA_FILE_SCAN_UNAVAILABLE');
    if (!bytes.length || bytes.length > VISA_FILE_LIMIT) throw new Error('VISA_FILE_SIZE_INVALID');
    const version = await request(socketPath, Buffer.from('zVERSION\0'), timeoutMs);
    const match = /^ClamAV ([0-9]+\.[0-9]+\.[0-9]+)\/([0-9]+)\/(.+)$/.exec(version);
    if (!match) throw new Error('VISA_FILE_SCAN_EVIDENCE_INVALID');
    const databaseBuiltAt = Date.parse(`${match[3]} UTC`);
    const age = now().getTime() - databaseBuiltAt;
    if (!Number.isFinite(age) || age < -5 * 60_000 || age > 48 * 60 * 60_000) throw new Error('VISA_FILE_SCAN_DATABASE_STALE');
    const chunks: Buffer[] = [Buffer.from('zINSTREAM\0')];
    for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
      const part = bytes.subarray(offset, offset + 64 * 1024);
      const length = Buffer.alloc(4); length.writeUInt32BE(part.length); chunks.push(length, part);
    }
    chunks.push(Buffer.alloc(4));
    const response = await request(socketPath, Buffer.concat(chunks), timeoutMs);
    if (response !== 'stream: OK' && !/^stream: [\w.:-]+ FOUND$/.test(response)) throw new Error('VISA_FILE_SCAN_UNAVAILABLE');
    return { outcome: response === 'stream: OK' ? 'CLEAN' : 'INFECTED', engineVersion: `ClamAV ${match[1]}`, databaseVersion: match[2] };
  };
}
