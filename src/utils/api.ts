import { Capacitor } from '@capacitor/core';
import { debugLogger } from './debugLogger';
import { auth } from '../services/firebase';

export const DEFAULT_LIVE_HOST = 'https://mission-selection-43729399220.asia-south1.run.app';

export const getLiveHost = (): string => {
  try {
    return localStorage.getItem('custom_api_host') || DEFAULT_LIVE_HOST;
  } catch (e) {
    return DEFAULT_LIVE_HOST;
  }
};

export const setLiveHost = (host: string): void => {
  try {
    if (!host) {
      localStorage.removeItem('custom_api_host');
    } else {
      localStorage.setItem('custom_api_host', host.trim().replace(/\/$/, ''));
    }
  } catch (e) {
    console.error('[API] Failed to save custom API host:', e);
  }
};

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let urlString = '';
  if (typeof input === 'string') {
    urlString = input;
  } else if (input instanceof URL) {
    urlString = input.href;
  } else if (input && typeof input === 'object' && 'url' in input) {
    urlString = (input as Request).url;
  }

  const liveHost = getLiveHost();
  
  const headers = new Headers(init?.headers);

  // Auto-attach auth token
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    } catch (e) {
      console.error('[API] Failed to get auth token:', e);
    }
  }
  
  const newInit = { ...init, headers };

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
      const urlObj = urlString.startsWith('http') ? new URL(urlString) : null;
      const relativePath = urlObj ? `${urlObj.pathname}${urlObj.search}` : urlString;
      const finalUrl = `${liveHost}${relativePath}`;
      console.log(`[API Routing] Redirecting cross-origin request: ${urlString} -> ${finalUrl}`);

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

  // Instrument logging
  debugLogger.add('REQUEST', `Fetching ${urlString}`, {
      method: init?.method || 'GET',
      body: init?.body
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(input, { ...newInit, credentials: 'include', signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    
    // Read response for logging (cloning to avoid consuming body)
    const clonedResponse = response.clone();
    const data = await clonedResponse.text();
    
    debugLogger.add('RESPONSE', `Status: ${response.status}`, {
        body: data
    });
    
    return response;
  } catch (err) {
    debugLogger.add('ERROR', `Failed requesting ${String(input)}`, { error: err instanceof Error ? err.message : String(err) });
    console.error(`[API Fetch Error] Failed requesting ${String(input)}:`, err);
    throw err;
  }
};

