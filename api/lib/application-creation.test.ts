import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrpcContext } from '../context';
import { issueCreationDevice, creationDeviceOwner } from './creation-device';
import { prepareApplicationCreation, withApplicationCreation } from './application-creation';

const pool = vi.hoisted(() => ({ getConnection: vi.fn() }));
vi.mock('./operations/mysql-query-client', () => ({ defaultOperationsPool: () => pool }));

describe('server-issued application creation requests', () => {
  let rows: Array<Record<string, unknown>>;
  let pending: Promise<void>;
  const context = (cookie?: string): TrpcContext => ({ req: new Request('https://staging.example/apply', {
    headers: cookie ? { cookie } : {},
  }), resHeaders: new Headers(), isAdmin: false, customerApplicationReferences: new Set() });
  const deviceContext = () => context(issueCreationDevice(new Headers()).cookie.split(';')[0]);
  beforeEach(() => {
    vi.stubEnv('CUSTOMER_SESSION_SECRET', 'synthetic-test-secret-only-12345678901234567890');
    rows = []; pending = Promise.resolve();
    pool.getConnection.mockImplementation(async () => {
      let unlock = () => {};
      let snapshot: typeof rows;
      return {
        beginTransaction: async () => { const previous = pending; pending = new Promise<void>(resolve => { unlock = resolve; }); await previous; snapshot = structuredClone(rows); },
        commit: async () => { unlock(); },
        rollback: async () => { rows = snapshot; unlock(); },
        release: () => {},
        execute: async (sql: string, values: unknown[]) => {
          if (sql.startsWith('INSERT IGNORE') || sql.startsWith('SELECT owner_hash FROM application_creation_devices')) return [[], []];
          if (sql.includes('ORDER BY sequence')) return [rows.filter(row => row.owner_hash === values[0] && row.flow === values[1]).slice(-1), []];
          if (sql.startsWith('INSERT INTO application_creation_requests')) {
            rows.push({ id: values[0], owner_hash: values[1], flow: values[2], reference_number: values[3], application_id: null, payload_hash: null });
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith('SELECT owner_hash,flow')) return [rows.filter(row => row.id === values[0]), []];
          if (sql.startsWith('SELECT id FROM applicants')) return [[{ id: 12 }], []];
          if (sql.startsWith('UPDATE application_creation_requests')) {
            const row = rows.find(row => row.id === values[2])!; row.application_id = values[0]; row.payload_hash = values[1];
            return [{ affectedRows: 1 }, []];
          }
          throw new Error('Unexpected query');
        },
      };
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it('refresh and double submission share one server reference and one creation', async () => {
    const ctx = deviceContext();
    const first = await prepareApplicationCreation(ctx, 'FORM', false);
    expect((await prepareApplicationCreation(ctx, 'FORM', false)).requestKey).toBe(first.requestKey);
    const create = vi.fn().mockResolvedValue({ applicationId: 3, applicantIds: [12] });
    const results = await Promise.all([1, 2].map(() => withApplicationCreation(ctx, first.requestKey, ['FORM'], { test: true }, create)));
    expect(create).toHaveBeenCalledOnce();
    expect(results[0]).toEqual(results[1]);
    expect(results[0].referenceNumber).toMatch(/^TSH-[A-F0-9]{32}$/);
    const reopened = await prepareApplicationCreation(ctx, 'FORM', false);
    expect(reopened.referenceNumber).toBe(results[0].referenceNumber);
    expect(ctx.resHeaders.get('set-cookie')).toContain('tashira_customer_session=');
    expect((await prepareApplicationCreation(ctx, 'FORM', true)).requestKey).not.toBe(first.requestKey);
  });
  it('does not consume the key on rollback; rejects foreign ownership, changed data and flow', async () => {
    const ctx = deviceContext();
    const request = await prepareApplicationCreation(ctx, 'FORM', false);
    const create = vi.fn().mockRejectedValueOnce(new Error('write failed')).mockResolvedValue({ applicationId: 3, applicantIds: [12] });
    await expect(withApplicationCreation(ctx, request.requestKey, ['FORM'], {}, create)).rejects.toThrow('write failed');
    await withApplicationCreation(ctx, request.requestKey, ['FORM'], {}, create);
    await expect(withApplicationCreation(deviceContext(), request.requestKey, ['FORM'], {}, create)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(withApplicationCreation(ctx, request.requestKey, ['CHAT'], {}, create)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(withApplicationCreation(ctx, request.requestKey, ['FORM'], { changed: true }, create)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('rejects a forged or expired device cookie', () => {
    const issued = issueCreationDevice(new Headers());
    const cookie = issued.cookie.split(';')[0];
    expect(creationDeviceOwner(new Headers({ cookie }))).toBe(issued.owner);
    expect(creationDeviceOwner(new Headers({ cookie: cookie + 'x' }))).toBeNull();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(creationDeviceOwner(new Headers({ cookie }))).toBeNull();
    vi.restoreAllMocks();
  });
});
