import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { effectiveApplicationIntake, readApplicationIntake } from './application-intake';
const settings = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('./pricing-engine', () => ({ activeBusinessSettings: settings.read }));
import { applicationUploadQuery, createRouter, newApplicationQuery, newPaymentQuery, paymentQuery } from '../middleware';

let directory: string;
let config: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tashira-intake-'));
  config = path.join(directory, 'intake.json');
  vi.stubEnv('APPLICATION_INTAKE_CONFIG_PATH', config);
  fs.writeFileSync(config, JSON.stringify({ closed: true }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('application intake closure', () => {
  it('cannot reopen by config while the company phone is provisional or settings are unavailable', async () => {
    fs.writeFileSync(config, JSON.stringify({ closed: false }));
    settings.read.mockResolvedValue({ legalName: 'Synthetic', address: 'Test', licence: 'TEST', email: 'test@example.test', phone: '000', website: 'example.test', logo: 'test', provisionalFieldsJson: '["phone"]' });
    expect(await effectiveApplicationIntake()).toEqual({ closed: true });
    settings.read.mockResolvedValue({ legalName: 'Synthetic', address: 'Test', licence: 'TEST', email: 'test@example.test', phone: '000', website: 'example.test', logo: 'test', provisionalFieldsJson: '[]' });
    expect(await effectiveApplicationIntake()).toEqual({ closed: false });
    settings.read.mockRejectedValue(new Error('Unavailable'));
    expect(await effectiveApplicationIntake()).toEqual({ closed: true });
  });
  it('reopens immediately after the config changes without a restart', () => {
    expect(readApplicationIntake()).toEqual({ closed: true });
    fs.writeFileSync(config, JSON.stringify({ closed: false }));
    expect(readApplicationIntake()).toEqual({ closed: false });
  });

  it('fails closed for missing, malformed or incorrectly typed config', () => {
    fs.unlinkSync(config);
    expect(readApplicationIntake().closed).toBe(true);
    for (const content of ['not-json', '{"closed":"false"}', '{}']) {
      fs.writeFileSync(config, content);
      expect(readApplicationIntake().closed).toBe(true);
    }
  });

  it.each(['production', 'development', 'test'])('defaults %s to closed when the config path is missing', (mode) => {
    vi.stubEnv('APPLICATION_INTAKE_CONFIG_PATH', '');
    vi.stubEnv('NODE_ENV', mode);
    expect(readApplicationIntake().closed).toBe(true);
  });

  it('refuses creation and new payment but preserves upload and prior payment confirmation', async () => {
    const write = vi.fn(() => 'created');
    const router = createRouter({
      create: newApplicationQuery.mutation(write),
      pay: newPaymentQuery.mutation(write),
      upload: applicationUploadQuery.mutation(() => 'uploaded'),
      confirm: paymentQuery.mutation(() => 'confirmed'),
    });
    const caller = router.createCaller({ req: new Request('https://example.test'), resHeaders: new Headers(), isAdmin: false, customerApplicationReferences: new Set(['owned']) });
    await expect(caller.create()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.pay()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.upload()).resolves.toBe('uploaded');
    await expect(caller.confirm()).resolves.toBe('confirmed');
    expect(write).not.toHaveBeenCalled();
  });

  it('rejects only the blocked operation in a mixed tRPC batch', async () => {
    const write = vi.fn(() => 'created');
    const router = createRouter({ create: newApplicationQuery.mutation(write), upload: applicationUploadQuery.mutation(() => 'uploaded') });
    const req = new Request('https://example.test/api/trpc/create,upload?batch=1', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 0: { json: null }, 1: { json: null } }),
    });
    const response = await fetchRequestHandler({ endpoint: '/api/trpc', req, router, createContext: () => ({ req, resHeaders: new Headers(), isAdmin: false, customerApplicationReferences: new Set(['owned']) }) });
    expect(await response.json()).toMatchObject([{ error: { json: { data: { code: 'FORBIDDEN' } } } }, { result: { data: { json: 'uploaded' } } }]);
    expect(write).not.toHaveBeenCalled();
  });
});
