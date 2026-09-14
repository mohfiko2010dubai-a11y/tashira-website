import { describe, expect, it } from 'vitest';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { financialApplicationScope } from './financial-application-scope';
import { readFileSync } from 'node:fs';

describe('explicit test order scope', () => {
  it('requires both live classification and an unflagged row in every financial scope', () => {
    const query = new MySqlDialect().sqlToQuery(financialApplicationScope());
    expect(query.sql).toContain('`applications`.`is_test` = ?');
    expect(query.sql).toContain('`applications`.`data_classification` = ?');
    expect(query.params).toEqual(['LIVE', false]);
  });
  it('adds a false default without silently classifying or deleting historical rows', () => {
    const migration = readFileSync(new URL('../../migrations/052_explicit_test_orders.sql', import.meta.url), 'utf8');
    expect(migration).toMatch(/is_test boolean NOT NULL DEFAULT false/);
    expect(migration).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/i);
  });
});
