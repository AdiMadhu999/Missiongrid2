import { collection, query, where, getDocs, addDoc, doc, updateDoc, orderBy, limit, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Warning } from '../models/warning';
import { StudentUpdatesService } from './studentUpdates';

 export const issueWarning = async (warning: Omit<Warning, 'id'> & { uid?: string }) => {
  const warningsRef = collection(db, 'warnings');
  let uid = warning.uid || '';
  if (!uid && warning.studentId) {
    try {
      const privDoc = await getDoc(doc(db, 'users_private', warning.studentId));
      if (privDoc.exists()) {
        uid = privDoc.data()?.uid || '';
      }
    } catch (e) {
      console.warn("Failed to fetch uid from users_private for warning:", e);
    }
  }
  const res = await addDoc(warningsRef, {
    ...warning,
    uid,
    date: new Date().toISOString(),
    status: 'Active'
  });

  try {
    await StudentUpdatesService.createUpdate({
      studentId: warning.studentId,
      type: 'mentor_update',
      title: '📢 Important Mentor Update',
      description: `A mentor action has been issued. Reason: ${warning.reason}`,
    });
  } catch (err) {
    console.error('Error logging warning in student updates:', err);
  }

  return res;
};

export const getStudentWarnings = async (studentId: string): Promise<Warning[]> => {
  const warningsRef = collection(db, 'warnings');
  const q = query(
    warningsRef, 
    where('studentId', '==', studentId),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Warning));
};

export const resolveWarning = async (warningId: string) => {
  const warningRef = doc(db, 'warnings', warningId);
  const snap = await getDoc(warningRef);
  const res = await updateDoc(warningRef, { status: 'Resolved' });

  if (snap.exists()) {
    const warning = snap.data() as Warning;
    try {
      await StudentUpdatesService.createUpdate({
        studentId: warning.studentId,
        type: 'mentor_update',
        title: '✅ Warning Resolved',
        description: `Your mentor action/warning for "${warning.reason}" has been marked as resolved.`
      });
    } catch (err) {
      console.error('Error logging resolved warning in student updates:', err);
    }
  }

  return res;
};

export const startNew10DaysCycle = async () => {
    const settingsRef = doc(db, 'system', 'global_config');
    await setDoc(settingsRef, {
        currentCycleStartDate: new Date().toISOString()
    }, { merge: true });

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', 'in', ['student', 'aspirant']));
    const snap = await getDocs(q);
    
    const MAX_BATCH_SIZE = 240;

    for (let i = 0; i < snap.docs.length; i += MAX_BATCH_SIZE) {
        const chunk = snap.docs.slice(i, i + MAX_BATCH_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(d => {
            batch.update(d.ref, {
                updatedAt: new Date().toISOString()
            });
            const statsRef = doc(db, 'studentStats', d.id);
            batch.set(statsRef, {
                updatedAt: new Date().toISOString()
            }, { merge: true });
        });
        
        await batch.commit();
    }
    
};

export const resetAllStudentStats = async () => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', 'in', ['student', 'aspirant']));
    const snap = await getDocs(q);
    
    const MAX_BATCH_SIZE = 240;

    // First, update users in batches
    for (let i = 0; i < snap.docs.length; i += MAX_BATCH_SIZE) {
        const chunk = snap.docs.slice(i, i + MAX_BATCH_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(d => {
            batch.update(d.ref, {
                consistencyIndex: 100,
                category: 'Review Category',
                updatedAt: new Date().toISOString()
            });
            const statsRef = doc(db, 'studentStats', d.id);
            batch.set(statsRef, {
                updatedAt: new Date().toISOString()
            }, { merge: true });
        });
        
        // In the first batch, we also update the global config
        if (i === 0) {
            const settingsRef = doc(db, 'system', 'global_config');
            batch.set(settingsRef, {
                currentCycleStartDate: new Date().toISOString()
            }, { merge: true });
        }
        
        await batch.commit();
    }
    
    // If there were no users, we still need to update global_config
    if (snap.docs.length === 0) {
        const settingsRef = doc(db, 'system', 'global_config');
        await setDoc(settingsRef, {
            currentCycleStartDate: new Date().toISOString()
        }, { merge: true });
    }

    // Now, delete dailyMissionReports in batches of 500
    const reportsRef = collection(db, 'dailyMissionReports');
    const reportsSnap = await getDocs(reportsRef);
    
    for (let i = 0; i < reportsSnap.docs.length; i += MAX_BATCH_SIZE) {
        const chunk = reportsSnap.docs.slice(i, i + MAX_BATCH_SIZE);
        const reportBatch = writeBatch(db);
        chunk.forEach(document => {
            reportBatch.delete(document.ref);
        });
        await reportBatch.commit();
    }
    
};
