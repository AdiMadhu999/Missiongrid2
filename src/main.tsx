import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { getLiveHost } from './utils/api';

const queryClient = new QueryClient();

const isNative = Capacitor.isNativePlatform();
const isDev = window.location.hostname === 'localhost' || 
              window.location.hostname.includes('-dev-') || 
              window.location.port === '3000';

// Global window.fetch monkeypatch to rewrite relative /api paths to Cloud Run backend when running natively
const originalFetch = window.fetch;
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
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
      const liveHost = getLiveHost();
      const urlObj = urlString.startsWith('http') ? new URL(urlString) : null;
      const relativePath = urlObj ? `${urlObj.pathname}${urlObj.search}` : urlString;
      
      if (typeof input === 'string') {
        input = `${liveHost}${relativePath}`;
      } else if (input instanceof URL) {
        input = new URL(`${liveHost}${relativePath}`);
      } else if (input && typeof input === 'object' && 'url' in input) {
        const newRequest = new Request(`${liveHost}${relativePath}`, input as Request);
        input = newRequest;
      }
    }
  }
  return originalFetch(input, init);
};

// Safely patch window.fetch using redundant fallback strategies
let patched = false;
try {
  window.fetch = customFetch;
  patched = true;
} catch (e) {
  // Ignored
}

if (!patched) {
  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true,
      enumerable: true
    });
    patched = true;
  } catch (e) {
    // Ignored
  }
}

if (!patched) {
  try {
    Object.defineProperty(window, 'fetch', {
      get() {
        return customFetch;
      },
      configurable: true,
      enumerable: true
    });
    patched = true;
  } catch (e) {
    // Ignored
  }
}

if (!patched) {
  try {
    Object.defineProperty(Window.prototype, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true,
      enumerable: true
    });
    patched = true;
  } catch (e) {
    console.warn('[FetchPatch] Failed to patch global fetch:', e);
  }
}

// Intercept logs and forward to server in development or native contexts
if (isDev || isNative) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const forwardLog = (type: string, ...args: any[]) => {
    try {
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return arg.message || String(arg);
        }
        if (typeof arg === 'object' && arg !== null) {
          try { return JSON.stringify(arg); } catch(e) { return String(arg); }
        }
        return String(arg);
      }).join(' ');
      
      // Skip noisy benign third-party library warnings/info
      if (
        message.includes('reCAPTCHA Enterprise config') || 
        message.includes('reCAPTCHA v2 verification') ||
        message.includes('reCAPTCHA')
      ) {
        return;
      }
      
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message })
      }).catch(() => {});
    } catch (e) {}
  };

  console.log = (...args) => {
    originalLog(...args);
    forwardLog('INFO', ...args);
  };

  console.error = (...args) => {
    originalError(...args);
    forwardLog('ERROR', ...args);
  };

  console.warn = (...args) => {
    originalWarn(...args);
    forwardLog('WARN', ...args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      // Register main PWA SW
      navigator.serviceWorker.register('/sw.js').catch(console.error);
      
      // Register FCM Messaging SW
      navigator.serviceWorker.register('/firebase-messaging-sw.js').then((reg) => {
          console.log('[FCM SW] Registered successfully:', reg.scope);
      }).catch((err) => {
          console.error('[FCM SW] Registration failed:', err);
      });
    });
  } else {
    // Unregister active service worker in development to prevent stale files and dynamic import errors
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('[SW] Unregistered active service worker for development mode');
          }
        });
      }
    });
  }
}
