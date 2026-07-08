import { db } from './firebase';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';
import { BackupRecord } from '../models/backup';

const BACKUP_COLLECTION = 'system_backups';

export async function getBackups(): Promise<BackupRecord[]> {
  const querySnapshot = await getDocs(query(collection(db, BACKUP_COLLECTION), orderBy('date', 'desc')));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BackupRecord));
}

export async function createBackup(record: Omit<BackupRecord, 'id'>) {
  await addDoc(collection(db, BACKUP_COLLECTION), record);
}
