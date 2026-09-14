import { describe, expect, it } from 'vitest';
import { assertSyntheticSeedConnection, assertSyntheticSeedTarget } from './synthetic-seed-guard';
import { assertReleaseContainsNoRuntimeData } from '../../scripts/verify-release-data-boundary.mjs';

describe('synthetic data production boundary', () => {
  const isolated = { directory: '/var/www/tashira-staging', databaseUrl: 'mysql://tashira_staging_app:test@localhost/tashira_staging', storageRoot: '/var/www/tashira-staging/storage/documents' };
  it('requires all staging identities and checks the actual connection separately', () => {
    expect(() => assertSyntheticSeedTarget(isolated)).not.toThrow();
    for (const changed of [{ directory: '/var/www/tashira' }, { databaseUrl: 'mysql://tashira_app:test@localhost/tashira_db' }, { storageRoot: '/var/www/tashira/storage/documents' }]) {
      expect(() => assertSyntheticSeedTarget({ ...isolated, ...changed })).toThrow();
    }
    expect(() => assertSyntheticSeedConnection('tashira_db', 'tashira_staging_app@localhost')).toThrow();
    expect(() => assertSyntheticSeedConnection('tashira_staging', 'root@localhost')).toThrow();
    expect(() => assertSyntheticSeedConnection('tashira_staging', 'tashira_staging_app@localhost')).not.toThrow();
  });
  it.each(['storage/documents/a.pdf', 'dist/public/invoices/a.pdf', 'logs/app.log', 'backups/db.sql', '.env', 'staging/secrets/key', 'db.sqlite'])('rejects runtime artifact %s before deployment connects to production', file => {
    expect(() => assertReleaseContainsNoRuntimeData(['src/App.tsx', file])).toThrow();
  });
  it('permits code, migrations and example configuration without copying application data', () => {
    expect(() => assertReleaseContainsNoRuntimeData(['src/App.tsx', 'migrations/052_explicit_test_orders.sql', '.env.example'])).not.toThrow();
  });
});
