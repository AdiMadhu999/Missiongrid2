import { Batch } from '../models/mission';
import { clearUsersCache } from './users';
import { db, auth } from './firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, query, where, writeBatch, limit } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}


interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let batchesCache: { data: Batch[]; timestamp: number } | null = null;
let batchByIdCache: Record<string, { data: Batch; timestamp: number }> = {};
const BATCH_CACHE_DURATION_MS = Capacitor.isNativePlatform() ? 30000 : 6000;

function clearBatchesCache() {
  batchesCache = null;
  batchByIdCache = {};
}

/**
 * Batch Service
 * Manages Batch creations, updates, and assignments by Mentors.
 */
export const BatchService = {
  createBatch: async (batchData: Omit<Batch, 'id' | 'createdAt'>): Promise<string> => {
    try {
      if (!db) throw new Error('Firestore not initialized');
      const docRef = await addDoc(collection(db, 'batches'), {
        ...batchData,
        createdAt: new Date().toISOString()
      });
      clearBatchesCache();
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'batches');
      throw error;
    }
  },

  updateBatch: async (batchId: string, data: Partial<Batch>): Promise<void> => {
    try {
      if (!db) throw new Error('Firestore not initialized');
      const batchRef = doc(db, 'batches', batchId);
      await updateDoc(batchRef, data);
      clearBatchesCache();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `batches/${batchId}`);
    }
  },

  deleteBatch: async (batchId: string, studentsInBatch: any[]): Promise<void> => {
    try {
      if (!db) throw new Error('Firestore not initialized');
      
      const batchInstance = writeBatch(db);

      // 1. Remove the batchId from all students in this batch
      for (const student of studentsInBatch) {
        if (student.batchId === batchId) {
          const studentRef = doc(db, 'users', student.id);
          batchInstance.update(studentRef, { batchId: '' });
        }
      }

      // 2. Delete the batch document
      const batchRef = doc(db, 'batches', batchId);
      batchInstance.delete(batchRef);

      await batchInstance.commit();
      clearUsersCache();
      clearBatchesCache();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `batches/${batchId}`);
    }
  },

  renameBatch: async (batchId: string, newName: string): Promise<void> => {
    try {
      if (!db) throw new Error('Firestore not initialized');
      const batchRef = doc(db, 'batches', batchId);
      await updateDoc(batchRef, { name: newName });
      clearBatchesCache();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `batches/${batchId}`);
    }
  },

  getBatches: async (): Promise<Batch[]> => {
    try {
      if (!db) return [];
      const now = Date.now();
      if (batchesCache && (now - batchesCache.timestamp < BATCH_CACHE_DURATION_MS)) {
        return batchesCache.data;
      }
      const q = query(collection(db, 'batches'), limit(50));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Batch));
      batchesCache = { data: list, timestamp: Date.now() };
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'batches');
      return [];
    }
  },

  getBatchById: async (batchId: string): Promise<Batch | null> => {
    try {
      if (!db) return null;
      
      const now = Date.now();
      // Look in bulk batches cache first to save a read
      if (batchesCache && (now - batchesCache.timestamp < BATCH_CACHE_DURATION_MS)) {
        const found = batchesCache.data.find(b => b.id === batchId);
        if (found) return found;
      }

      if (batchByIdCache[batchId] && (now - batchByIdCache[batchId].timestamp < BATCH_CACHE_DURATION_MS)) {
        return batchByIdCache[batchId].data;
      }

      const docRef = doc(db, 'batches', batchId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as Batch;
        batchByIdCache[batchId] = { data, timestamp: Date.now() };
        return data;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `batches/${batchId}`);
      return null;
    }
  },

  assignStudentsToBatch: async (batchId: string, studentIds: string[], allStudents: any[]): Promise<void> => {
    try {
      if (!db) throw new Error('Firestore not initialized');
      
      const batchInstance = writeBatch(db);

      // 1. Update the studentIds in the batch
      const batchRef = doc(db, 'batches', batchId);
      batchInstance.update(batchRef, { studentIds });

      // 2. Set batchId key on all assigned students
      for (const sId of studentIds) {
        const studentRef = doc(db, 'users', sId);
        batchInstance.update(studentRef, { batchId });
      }

      // 3. Find students who were in this batch but are NOT in the new list, and clear their batchId in user profile
      const removedStudents = allStudents.filter(u => {
        const uId = u.id || u.mobile;
        return u.role === 'student' && u.batchId === batchId && uId && !studentIds.includes(uId);
      });

      for (const u of removedStudents) {
        const uId = u.id || u.mobile;
        if (uId) {
          const studentRef = doc(db, 'users', uId);
          batchInstance.update(studentRef, { batchId: '' });
        }
      }

      await batchInstance.commit();
      clearUsersCache();
      clearBatchesCache();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users/batches');
    }
  },

  assignExaminersToBatch: async (batchId: string, examinerIds: string[]): Promise<void> => {
    try {
      if (!db) throw new Error('Firestore not initialized');
      const batchRef = doc(db, 'batches', batchId);
      await updateDoc(batchRef, { examinerIds });
      clearUsersCache();
      clearBatchesCache();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `batches/${batchId}`);
    }
  },

  transferStudent: async (studentId: string, sourceBatchId: string | null | undefined, destinationBatchId: string): Promise<void> => {
    try {
      if (!db) throw new Error('Firestore not initialized');
      const batchInstance = writeBatch(db);

      // 1. Update student's batchId to destinationBatchId
      const studentRef = doc(db, 'users', studentId);
      batchInstance.update(studentRef, { batchId: destinationBatchId });

      // 2. Remove student from source batch's studentIds array
      if (sourceBatchId) {
        const sourceBatchRef = doc(db, 'batches', sourceBatchId);
        const sourceBatchSnap = await getDoc(sourceBatchRef);
        if (sourceBatchSnap.exists()) {
          const sourceData = sourceBatchSnap.data() as Batch;
          const filteredStudents = (sourceData.studentIds || []).filter(id => id !== studentId);
          batchInstance.update(sourceBatchRef, { studentIds: filteredStudents });
        }
      }

      // 3. Add student to destination batch's studentIds array
      const destBatchRef = doc(db, 'batches', destinationBatchId);
      const destBatchSnap = await getDoc(destBatchRef);
      if (destBatchSnap.exists()) {
        const destData = destBatchSnap.data() as Batch;
        const studentIds = destData.studentIds || [];
        if (!studentIds.includes(studentId)) {
          batchInstance.update(destBatchRef, { studentIds: [...studentIds, studentId] });
        }
      }

      await batchInstance.commit();
      clearUsersCache();
      clearBatchesCache();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'batches/transfer');
    }
  }
};
