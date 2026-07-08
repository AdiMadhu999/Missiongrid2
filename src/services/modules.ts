import { db } from './firebase';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';

export interface ModuleStatus {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'maintenance' | 'hidden' | 'testing' | 'archived';
  lastUpdated: string;
  updatedBy: string;
  maintenanceNotice?: string;
}

const MODULES_COLLECTION = 'modules';

export async function getModules(): Promise<ModuleStatus[]> {
  const querySnapshot = await getDocs(collection(db, MODULES_COLLECTION));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ModuleStatus));
}

export async function updateModuleStatus(id: string, updates: Partial<ModuleStatus>) {
  await updateDoc(doc(db, MODULES_COLLECTION, id), {
    ...updates,
    lastUpdated: new Date().toISOString(),
  });
}
