const activePromises = new Map<string, Promise<any>>();

/**
 * Deduplicates concurrent asynchronous requests/queries that have the same key.
 * If a request with the given key is already in-flight, returns the existing promise
 * instead of spawning a new one. Once resolved or rejected, the key is evicted.
 */
export function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = activePromises.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fn()
    .then((result) => {
      activePromises.delete(key);
      return result;
    })
    .catch((err) => {
      activePromises.delete(key);
      throw err;
    });

  activePromises.set(key, promise);
  return promise;
}

/**
 * Simple in-memory cache with expiration support.
 * Keeps the application fast, memory-efficient, and within quota under heavy load.
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export function cacheGet<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function cacheClear(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}
