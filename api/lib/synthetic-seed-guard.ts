export function assertSyntheticSeedTarget(input: { directory: string; databaseUrl: string; storageRoot: string }) {
  const url = new URL(input.databaseUrl);
  if (input.directory !== '/var/www/tashira-staging' || input.storageRoot !== '/var/www/tashira-staging/storage/documents'
    || url.pathname !== '/tashira_staging' || decodeURIComponent(url.username) !== 'tashira_staging_app') {
    throw new Error('SYNTHETIC_SEED_REQUIRES_ISOLATED_STAGING');
  }
}

export function assertSyntheticSeedConnection(database: string, user: string) {
  if (database !== 'tashira_staging' || user.split('@')[0] !== 'tashira_staging_app') {
    throw new Error('SYNTHETIC_SEED_DATABASE_IDENTITY_FAILED');
  }
}
