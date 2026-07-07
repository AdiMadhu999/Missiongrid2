import { DailyTarget, TargetProgress, TargetReaction } from '../models/mission';
import { db, storage } from './firebase';
import { safeDate } from '../utils/date';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, orderBy, limit, onSnapshot, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { TargetProgress as TargetProgressType } from '../models/target_advanced';
import { StudentStatsService } from './studentStats';
import { addAuditEntry } from './audit';
import { StudentUpdatesService } from './studentUpdates';

const clearNotificationsCache = () => {
    notificationsCache = null;
};

export const TargetService = {
  sanitizeFilename: (name: string) => name.replace(/[^a-z0-9.]/gi, '_'),
  
  createTarget: async (target: Omit<DailyTarget, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const now = new Date().toISOString();
    const data = {
      ...target,
      createdAt: now,
      updatedAt: now,
      status: target.status || 'published'
    };
    
    Object.keys(data).forEach(key => {
        if ((data as any)[key] === undefined) {
            delete (data as any)[key];
        }
    });

    const docRef = await addDoc(collection(db, 'targets'), data);
    clearTargetsCache();
    return docRef.id;
  },
  
  updateTarget: async (targetId: string, updates: Partial<DailyTarget>): Promise<void> => {
    const targetRef = doc(db, 'targets', targetId);
    
    const data = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    Object.keys(data).forEach(key => {
        if ((data as any)[key] === undefined) {
            delete (data as any)[key];
        }
    });

    await updateDoc(targetRef, data);
    clearTargetsCache();
  },

  deleteTarget: async (targetId: string): Promise<void> => {
    const targetRef = doc(db, 'targets', targetId);
    await deleteDoc(targetRef);
    clearTargetsCache();
  },

  subscribeTargetsForUser: (
    role: string, 
    batchId: string | undefined, 
    studentId: string | undefined,
    callback: (targets: DailyTarget[]) => void,
    onError: (error: any) => void
  ) => {
    const targetsRef = collection(db, 'targets');
    const q = query(targetsRef, orderBy('createdAt', 'desc'), limit(50));
    
    return onSnapshot(q, (snapshot) => {
      const results: DailyTarget[] = [];
      const lowerRole = role?.toLowerCase() || '';
      const isMentorOrExaminer = lowerRole.includes('mentor') || lowerRole === 'examiner' || lowerRole === 'staff';
      
      snapshot.forEach((docSnap) => {
        const t = { id: docSnap.id, ...docSnap.data() } as DailyTarget;
        
        if (isMentorOrExaminer) {
          results.push(t);
        } else {
          // ...
          const isPublished = !t.status || t.status.toLowerCase().includes('published');
          
          if (isPublished) {
            const visibility = t.visibility || 'global';
            
            if (visibility === 'global') {
              results.push(t);
            } else if (visibility === 'batch') {
              if (batchId && t.batchId && t.batchId === batchId) {
                results.push(t);
              }
            } else if (visibility === 'individual') {
              if (studentId && t.studentId && t.studentId === studentId) {
                results.push(t);
              }
            }
          }
        }
      });
      
      const getTimestamp = (val: any): number => {
        if (!val) return 0;
        return safeDate(val).getTime();
      };

      const unique = Array.from(new Map(results.map(item => [item.id, item])).values());
      const sorted = unique.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
      
      callback(sorted);
    }, (err) => {
      onError(err);
    });
  },

  subscribeAllProgressForStudent: (
    studentId: string,
    callback: (progress: TargetProgressType[]) => void,
    onError: (error: any) => void
  ) => {
    const q = query(collection(db, 'targetProgress'), where('studentId', '==', studentId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TargetProgressType));
      callback(data);
    }, (err) => {
      onError(err);
    });
  },

  subscribeBulkReactions: (
    targetIds: string[],
    callback: (reactions: TargetReaction[]) => void,
    onError: (error: any) => void
  ) => {
    if (targetIds.length === 0) {
      callback([]);
      return () => {};
    }
    
    const slice = targetIds.slice(0, 30);
    const q = query(collection(db, 'targetReactions'), where('targetId', 'in', slice));
    
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TargetReaction));
      callback(data);
    }, (err) => {
      onError(err);
    });
  },

  getProgress: async (targetId: string, studentId: string): Promise<TargetProgressType | null> => {
    const q = query(collection(db, 'targetProgress'), where('targetId', '==', targetId), where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as TargetProgressType;
    }
    return null;
  },

  updateTaskProgress: async (targetId: string, studentId: string, taskId: string, status: 'Not Started' | 'Completed'): Promise<void> => {
    const q = query(collection(db, 'targetProgress'), where('targetId', '==', targetId), where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    const now = new Date().toISOString();
    
    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref;
      const data = snapshot.docs[0].data();
      const taskStatuses = { ...(data.taskStatuses || {}), [taskId]: status };
      await updateDoc(docRef, { taskStatuses, updatedAt: now });
    } else {
      await addDoc(collection(db, 'targetProgress'), {
        targetId, studentId, status: 'Started', taskStatuses: { [taskId]: status }, updatedAt: now
      });
    }
    clearTargetsCache();
  },

  addReaction: async (targetId: string, userId: string, type: 'Like' | 'Fire' | 'Clap' | 'Heart'): Promise<void> => {
    const q = query(collection(db, 'targetReactions'), where('targetId', '==', targetId), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref;
      await updateDoc(docRef, { type, createdAt: new Date().toISOString() });
    } else {
      await addDoc(collection(db, 'targetReactions'), {
        targetId, userId, type, createdAt: new Date().toISOString()
      });
    }
  },

  getReactions: async (targetId: string): Promise<TargetReaction[]> => {
    const q = query(collection(db, 'targetReactions'), where('targetId', '==', targetId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TargetReaction));
  },

  uploadFile: async (file: File, folder: string): Promise<{url: string, path: string}> => {
    const sanitizedName = file.name.replace(/[^a-z0-9.]/gi, '_');
    const path = `${folder}/${Date.now()}_${sanitizedName}`;
    const fileRef = ref(storage, path);
    
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return { url, path };
  },

  assignTarget: async (targetId: string, recipientIds: string[], batchId: string, deadline: string): Promise<void> => {
    const batch = writeBatch(db);
    const assignmentColl = collection(db, 'targetAssignments');
    
    recipientIds.forEach(userId => {
        const docRef = doc(assignmentColl);
        batch.set(docRef, {
            targetId,
            userId,
            batchId,
            deadline,
            assignedAt: new Date().toISOString(),
            status: 'assigned'
        });
    });
    
    await batch.commit();

    try {
      const targetSnap = await getDoc(doc(db, 'targets', targetId));
      const targetData = targetSnap.exists() ? targetSnap.data() : null;
      const targetName = targetData?.title || 'Daily Target';
      
      for (const userId of recipientIds) {
        await StudentUpdatesService.createUpdate({
          studentId: userId,
          type: 'new_assignment',
          title: '🎯 New Assignment',
          description: `A new assignment "${targetName}" has been assigned to you. Deadline: ${deadline}.`
        });
      }
    } catch (err) {
      console.error('Error logging student updates in assignTarget:', err);
    }
  },

  createNotification: async (type: 'info' | 'update' | 'emergency', title: string, text: string, targetId: string): Promise<string> => {
    const notifRef = await addDoc(collection(db, 'notifications'), {
      type,
      title,
      text,
      targetId,
      createdAt: new Date().toISOString()
    });
    clearNotificationsCache();
    return notifRef.id;
  },

  recordProgress: async (progressData: Omit<TargetProgressType, 'id' | 'updatedAt'>): Promise<string> => {
    const q = query(
      collection(db, 'targetProgress'), 
      where('targetId', '==', progressData.targetId), 
      where('studentId', '==', progressData.studentId)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, {
            ...progressData,
            updatedAt: serverTimestamp()
        });
        
        if (progressData.status === 'Completed') {
            await StudentStatsService.updateStats(progressData.studentId);
        }

        await addAuditEntry({
            eventType: 'target_update',
            userId: progressData.studentId,
            userName: 'Student',
            role: 'student',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toISOString().split('T')[1],
            action: `Target ${progressData.targetId} progress updated to ${progressData.status}`,
            status: 'success'
        });
        
        return docRef.id;
    } else {
        const progressRef = await addDoc(collection(db, 'targetProgress'), {
            ...progressData,
            updatedAt: serverTimestamp()
        });

        if (progressData.status === 'Completed') {
            await StudentStatsService.updateStats(progressData.studentId);
        }

        await addAuditEntry({
            eventType: 'target_update',
            userId: progressData.studentId,
            userName: 'Student',
            role: 'student',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toISOString().split('T')[1],
            action: `Target ${progressData.targetId} progress updated to ${progressData.status}`,
            status: 'success'
        });

        return progressRef.id;
    }
  },

  getNotifications: async (): Promise<any[]> => {
    const now = Date.now();
    if (notificationsCache && (now - notificationsCache.timestamp < NOTIF_CACHE_DURATION_MS)) {
      return notificationsCache.data;
    }
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(15));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notificationsCache = { data: list, timestamp: Date.now() };
    return list;
  }
};

let notificationsCache: { data: any[]; timestamp: number } | null = null;
const NOTIF_CACHE_DURATION_MS = 6000;

let targetsCache: Record<string, { data: DailyTarget[]; timestamp: number }> = {};
const TARGETS_CACHE_DURATION_MS = 6000;

let studentProgressCache: Record<string, { data: TargetProgressType[]; timestamp: number }> = {};

export function clearTargetsCache() {
  targetsCache = {};
  studentProgressCache = {};
}
