/**
 * Safe localStorage wrapper to prevent QuotaExceededError crashes
 */
export const safeStorage = {
  setItem: (key: string, value: string) => {
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
          
          // Sort by length (approximate size) and remove the largest ones first? 
          // Or just clear all cache keys to be safe.
          cacheKeys.forEach(k => localStorage.removeItem(k));
          
          // Try setting it again after clearing
          localStorage.setItem(key, value);
        } catch (retryError) {
          console.error("Critical: Storage still full after cache cleanup.", retryError);
        }
      }
    }
  },
  
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`LocalStorage getItem failed for key "${key}":`, e);
      return null;
    }
  },
  
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`LocalStorage removeItem failed for key "${key}":`, e);
    }
  }
};
