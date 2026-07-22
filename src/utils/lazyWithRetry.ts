import React from 'react';

export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>
) {
  return React.lazy(async () => {
    const hasRefreshed = window.sessionStorage.getItem('retry-lazy-refreshed') === 'true';
    try {
      const module = await factory();
      window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
      return module;
    } catch (error) {
      console.warn('[LazyLoad] Module import failed:', error);
      if (!hasRefreshed) {
        window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
        window.location.reload();
        return new Promise(() => {});
      }
      // Retry up to 3 times with delay before failing
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await new Promise((resolve) => setTimeout(resolve, attempt * 800));
          const module = await factory();
          window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
          return module;
        } catch (retryErr) {
          console.warn(`[LazyLoad] Retry attempt ${attempt} failed:`, retryErr);
        }
      }
      throw error;
    }
  });
}
