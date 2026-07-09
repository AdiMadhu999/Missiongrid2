import { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export const UpdateChecker = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    const checkVersion = async () => {
      // Only check on native Android
      if (Capacitor.getPlatform() !== 'android' || !Capacitor.isNativePlatform()) return;
      
      try {
        const info = await App.getInfo();
        const currentVersion = info.version;

        const response = await fetch('https://mission-selection-ultimate.web.app/version.json?t=' + Date.now(), {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        if (!response.ok) return;
        const data = await response.json();
        const latestVersion = data.version;

        if (latestVersion) {
          const currentVerNormalized = currentVersion.replace('v', '');

          // Improved version comparison
          const compareVersions = (v1: string, v2: string) => {
            const parts1 = v1.split('.').map(Number);
            const parts2 = v2.split('.').map(Number);
            for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
              const p1 = parts1[i] || 0;
              const p2 = parts2[i] || 0;
              if (p1 > p2) return 1;
              if (p1 < p2) return -1;
            }
            return 0;
          };

          if (compareVersions(latestVersion, currentVerNormalized) > 0) {
            setDownloadUrl(`https://mission-selection-ultimate.web.app/app-release.apk?v=${latestVersion}&t=${Date.now()}`);
            setUpdateAvailable(true);
          }
        }
      } catch (error) {
        // Only log if it's not a platform implementation error
        if (Capacitor.isNativePlatform()) {
          console.error('Failed to check for updates', error);
        }
      }
    };

    checkVersion();
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-gray-900">New version available</h2>
        <p className="mb-6 text-gray-600">A new version of the app is available. Please update to continue.</p>
        <button
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          onClick={() => Browser.open({ url: downloadUrl })}
        >
          Update Now
        </button>
      </div>
    </div>
  );
};
