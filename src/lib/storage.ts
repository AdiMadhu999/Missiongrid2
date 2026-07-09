/**
 * Safe localStorage wrapper to prevent QuotaExceededError crashes
 * backed by an ultra-fast in-memory cache to eliminate synchronous disk I/O lag.
 */
const memoryCache: Record<string, string> = {};

export const safeStorage = {
  setItem: (key: string, value: string) => {
    // Write instantly to RAM
    memoryCache[key] = value;
    try {
      localStorage.setItem(key, value);
    } catch (e: any) {
      console.warn(`LocalStorage setItem failed for key "${key}":`, e);
      
      // If quota exceeded, try to clear some non-critical caches
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.log("Storage quota exceeded. Attempting to clear cache keys...");
        try {
          const keys = Object.keys(localStorage);
          const cacheKeys = keys.filter(k => k.includes('_cache') || k.startsWith('recents_') || k.startsWith('bookmarks_'));
          
          // Clear memory cache keys
          cacheKeys.forEach(k => {
            delete memoryCache[k];
            localStorage.removeItem(k);
          });
          
          // Try setting it again after clearing
          localStorage.setItem(key, value);
        } catch (retryError) {
          console.error("Critical: Storage still full after cache cleanup.", retryError);
        }
      }
    }
  },
  
  getItem: (key: string) => {
    // Serve from RAM instantly if present
    if (memoryCache[key] !== undefined) {
      return memoryCache[key];
    }
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        memoryCache[key] = value; // Warm the memory cache
      }
      return value;
    } catch (e) {
      console.warn(`LocalStorage getItem failed for key "${key}":`, e);
      return null;
    }
  },
  
  removeItem: (key: string) => {
    delete memoryCache[key];
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`LocalStorage removeItem failed for key "${key}":`, e);
    }
  }
};

