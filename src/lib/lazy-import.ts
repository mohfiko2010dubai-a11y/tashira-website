import { isStaleChunkError } from "./stale-chunk-error";

const CHUNK_RELOAD_KEY = "tashira:stale-chunk-reload";

export async function importWithStaleChunkRecovery<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const loaded = await loader();
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return loaded;
  } catch (error) {
    if (!isStaleChunkError(error)) throw error;

    const page = window.location.href;
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === page) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      throw error;
    }

    sessionStorage.setItem(CHUNK_RELOAD_KEY, page);
    window.location.reload();
    return new Promise<T>(() => undefined);
  }
}
