import { Capacitor } from '@capacitor/core';
import React, { useEffect, useState, useCallback } from 'react';
import { APP_VERSION } from '../version';
import { UpdateOverlay } from './UpdateOverlay';
import { subscribeToSystemSettings } from '../services/system';
import { apiFetch } from '../utils/api';

export function VersionManager() {
  const isDev = window.location.hostname === 'localhost' || 
                window.location.hostname.includes('-dev-') || 
                window.location.port === '3000';

  if (isDev) return null;

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const checkVersion = useCallback(async () => {
    if (isUpdating || isChecking) return;
    try {
      setIsChecking(true);
      const now = Date.now();
      // Fetch with extreme cache-busting
      const response = await apiFetch(`/api/version?t=${now}`, {
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate', 
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) return;

      const data = await response.json();
      
      if (data.version && data.version !== APP_VERSION) {
        setServerVersion(data.version);
        setUpdateAvailable(true);
      }
    } catch (error) {
      // Slient fail for fetch errors during development
    } finally {
      setIsChecking(false);
    }
  }, [isUpdating, isChecking]);

  useEffect(() => {
    // 1. Check version on mount with a slight delay to ensure server is ready
    const timer = setTimeout(checkVersion, 2000);

    // 2. Poll every 60 seconds (fallback)
    const interval = setInterval(checkVersion, 60 * 1000);

    // 3. Real-time update signal via Firestore (INSTANT)
    const unsubscribeSystem = subscribeToSystemSettings((settings) => {
      if (settings.appVersion && settings.appVersion !== APP_VERSION) {
        console.log('[VersionManager] Instant version update detected via Firestore:', settings.appVersion);
        setServerVersion(settings.appVersion);
        setUpdateAvailable(true);
      }
    });

    // 4. Service Worker monitoring
    const handleControllerChange = () => {
      console.log('[VersionManager] Service worker controller changed, reloading...');
      window.location.reload();
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;

        // Check if there is already a waiting worker
        if (reg.waiting) {
          console.log('[VersionManager] Found waiting service worker on mount');
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
        }

        // Listen for new workers
        reg.onupdatefound = () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.onstatechange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[VersionManager] New service worker installed and waiting');
                setWaitingWorker(newWorker);
                setUpdateAvailable(true);
              }
            };
          }
        };
      });

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    // Visibility and Interaction handlers
    let lastCheck = 0;
    const throttledCheck = () => {
      const now = Date.now();
      if (now - lastCheck > 10000) { // Throttle to once every 10 seconds
        lastCheck = now;
        checkVersion();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') throttledCheck();
    };
    
    const handleFocus = () => throttledCheck();
    const handleInteraction = () => throttledCheck();

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pointerdown', handleInteraction);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribeSystem();
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }

      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pointerdown', handleInteraction);
    };
  }, [checkVersion]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    console.log('[VersionManager] User initiated update sequence...');
    
    try {
      // 1. If we have a waiting service worker, signal it to activate
      if (waitingWorker) {
        console.log('[VersionManager] Signaling waiting worker to activate...');
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        // Site will reload via 'controllerchange' listener
        return;
      }

      // 2. Fallback: Manual deep cleanup
      console.log('[VersionManager] No waiting worker found, performing deep cleanup...');
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const r of registrations) await r.unregister();
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      sessionStorage.clear();
      window.location.reload();
    } catch (error) {
      console.error('[VersionManager] Update sequence failed:', error);
      window.location.reload(); // Last resort
    }
  };

  return (
    <>
      {(updateAvailable || isUpdating) && (
        <UpdateOverlay
          currentVersion={APP_VERSION}
          serverVersion={serverVersion}
          isUpdating={isUpdating}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}
