export function isStaleChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i.test(error.message);
}
