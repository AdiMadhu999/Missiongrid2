import { db } from './firebase';
import { collection, getDocs, addDoc, query, orderBy, limit, where } from 'firebase/firestore';
import { AuditRecord } from '../models/audit';

import { cleanObject } from '../lib/firestore-utils';

const AUDIT_COLLECTION = 'system_audit_logs';

export async function getAuditLogs(): Promise<AuditRecord[]> {
  const querySnapshot = await getDocs(query(collection(db, AUDIT_COLLECTION), orderBy('date', 'desc'), limit(100)));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditRecord));
}

export async function addAuditEntry(entry: Omit<AuditRecord, 'id'>) {
  await addDoc(collection(db, AUDIT_COLLECTION), cleanObject(entry));
}
