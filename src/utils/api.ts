import { Capacitor } from '@capacitor/core';

export const LIVE_HOST = 'https://ais-pre-4lc74fjhivgouuxt4jkrwg-977053100479.asia-southeast1.run.app';

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let urlString = '';
  if (typeof input === 'string') {
    urlString = input;
  } else if (input instanceof URL) {
    urlString = input.href;
  } else if (input && typeof input === 'object' && 'url' in input) {
    urlString = (input as Request).url;
  }

  if (urlString.startsWith('/api/') || (urlString.startsWith(window.location.origin) && urlString.includes('/api/'))) {
    const isNativePlatform = Capacitor.isNativePlatform();
    const isLocalDev = !isNativePlatform && (
      window.location.hostname === 'localhost' || 
      window.location.hostname.includes('-dev-') || 
      window.location.port === '3000'
    );
    const isPreviewRunning = !isNativePlatform && (
      window.location.hostname.includes('run.app') ||
      window.location.hostname.includes('googleusercontent.com') ||
      window.location.hostname.includes('aistudio.google') ||
      window.location.hostname.includes('usercontent.com')
    );

    // If running inside native Android/iOS Capacitor app, or deployed outside Cloud Run container, point to the live server
    if (isNativePlatform || (!isLocalDev && !isPreviewRunning)) {
      const relativePath = urlString.startsWith('http') ? new URL(urlString).pathname : urlString;
      const finalUrl = `${LIVE_HOST}${relativePath}`;

      if (typeof input === 'string') {
        input = finalUrl;
      } else if (input instanceof URL) {
        input = new URL(finalUrl);
      } else if (input && typeof input === 'object' && 'url' in input) {
        const newRequest = new Request(finalUrl, input as Request);
        input = newRequest;
      }
    }
  }
  return fetch(input, init);
};

