import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { safeStorage } from '../lib/storage';

interface CachedQueryOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
  persistKey?: string; // Cache key for safeStorage (offline-first persistent cache)
  subscribeFn?: (callback: (data: T) => void) => () => void; // Optional real-time listener
}

export function useCachedQuery<T>({
  queryKey,
  queryFn,
  staleTime = 1000 * 60 * 5, // 5 minutes default
  gcTime = 1000 * 60 * 60, // 1 hour default
  enabled = true,
  persistKey,
  subscribeFn,
}: CachedQueryOptions<T>) {
  const queryClient = useQueryClient();

  // Load from localStorage cache first for instant loading
  const getInitialData = (): T | undefined => {
    if (persistKey) {
      const cached = safeStorage.getItem(persistKey);
      if (cached) {
        try {
          return JSON.parse(cached) as T;
        } catch (e) {
          console.warn(`Failed to parse cache for key ${persistKey}:`, e);
        }
      }
    }
    return undefined;
  };

  const queryResult = useQuery<T>({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();
      if (persistKey) {
        safeStorage.setItem(persistKey, JSON.stringify(data));
      }
      return data;
    },
    staleTime,
    gcTime,
    enabled,
    initialData: getInitialData(),
  });

  // Handle real-time Firestore subscriptions securely and robustly
  useEffect(() => {
    if (!subscribeFn || !enabled) return;

    const unsubscribe = subscribeFn((newData) => {
      queryClient.setQueryData(queryKey, newData);
      if (persistKey) {
        safeStorage.setItem(persistKey, JSON.stringify(newData));
      }
    });

    return unsubscribe;
  }, [JSON.stringify(queryKey), enabled, !!subscribeFn]);

  return queryResult;
}
