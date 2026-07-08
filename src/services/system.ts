import { doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { SystemSettings } from '../models/system';
import { cleanObject } from '../lib/firestore-utils';

const SETTINGS_DOC_ID = 'global_config';

export const subscribeToSystemSettings = (onUpdate: (settings: SystemSettings) => void, onError?: (err: any) => void) => {
  const docRef = doc(db, 'system', SETTINGS_DOC_ID);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data() as SystemSettings);
    }
  }, (err) => {
    console.warn("subscribeToSystemSettings real-time listener failed:", err);
    if (onError) onError(err);
  });
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  const docRef = doc(db, 'system', SETTINGS_DOC_ID);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data() as SystemSettings;
    return { ...data, announcements: data.announcements || [] };
  }
  
  // Default values
  const defaults: SystemSettings = {
    emergencyThreshold: 30,
    consistencyMultiplier: 1.0,
    elitePointRequirement: 1000,
    institutionalHolidays: [],
    maintenanceMode: false,
    announcements: []
  };
  
  await setDoc(docRef, defaults);
  return defaults;
};

export const updateSystemSettings = async (updates: Partial<SystemSettings>) => {
  const docRef = doc(db, 'system', SETTINGS_DOC_ID);
  return await updateDoc(docRef, cleanObject(updates));
};

export const logAuditAction = async (actorId: string, actorName: string, action: string, targetId?: string, details?: string) => {
    const data = cleanObject({
        actorId,
        actorName,
        action,
        targetId,
        details,
        timestamp: new Date().toISOString()
    });

    await addDoc(collection(db, 'audits'), data);
};
