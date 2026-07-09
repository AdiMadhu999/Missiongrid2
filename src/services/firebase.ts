import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentSingleTabManager, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Suppress noisy Firestore connection warnings from clogging the client console
setLogLevel('error');

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true })
    }),
    experimentalForceLongPolling: true
  }, '(default)');
} catch (e) {
  console.warn('[FirestoreInit] Failed to initialize with persistent cache:', e);
  try {
    dbInstance = getFirestore(app);
  } catch (err) {
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true
    });
  }
}

export const db = dbInstance || getFirestore(app);
export const storage = getStorage(app);


