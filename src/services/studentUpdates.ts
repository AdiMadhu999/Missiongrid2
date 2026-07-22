import { collection, addDoc, query, where, orderBy, limit, getDocs, startAfter, DocumentSnapshot, onSnapshot, getDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface StudentUpdate {
  id?: string;
  studentId: string; // This MUST be the Auth UID for security rules to work
  type: 
    | 'target_approved' 
    | 'target_rejected' 
    | 'rank_updated' 
    | 'test_evaluated' 
    | 'premium_activated' 
    | 'premium_expired' 
    | 'leave_approved' 
    | 'leave_rejected' 
    | 'leave_cancelled' 
    | 'submission_reviewed' 
    | 'feedback_added' 
    | 'new_assignment' 
    | 'mentor_update';
  title: string;
  description: string;
  timestamp: string;
  remark?: string;
}

export const StudentUpdatesService = {
  createUpdate: async (update: Omit<StudentUpdate, 'timestamp'>): Promise<void> => {
    try {
      let finalStudentId = update.studentId;

      // Robust UID Resolution:
      // If the provided ID is not likely a UID (e.g. it's a doc ID), 
      // we check users_private to find the real UID.
      // Most doc IDs are random strings of 20 chars. UIDs are usually 28.
      // But more reliably, we check if a doc with this ID exists in users_private.
      try {
        const privSnap = await getDoc(doc(db, 'users_private', update.studentId));
        if (privSnap.exists()) {
          finalStudentId = privSnap.data().uid || update.studentId;
        }
      } catch (e) {
        // Fallback to original ID if check fails
      }

      const docData: any = {
        studentId: finalStudentId,
        timestamp: new Date().toISOString(),
        createdAt: serverTimestamp() // Add for robust server-side ordering
      };

      // Only copy defined properties to prevent standard Firestore error on undefined values
      Object.entries(update).forEach(([key, val]) => {
        if (val !== undefined) {
          docData[key] = val;
        }
      });

      // Override with resolved final studentId/UID to pass Firestore security rules
      docData.studentId = finalStudentId;
      docData.uid = finalStudentId;

      await addDoc(collection(db, 'studentUpdates'), docData);
    } catch (e) {
      console.error('Error creating student update:', e);
    }
  },

  subscribeLatestUpdates: (
    studentIds: string | string[],
    callback: (updates: StudentUpdate[]) => void,
    onError: (err: any) => void
  ) => {
    const ids = (Array.isArray(studentIds) ? studentIds : [studentIds]).filter(Boolean);
    if (ids.length === 0) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, 'studentUpdates'),
      where('studentId', 'in', ids),
      limit(30)
    );

    return onSnapshot(q, (snapshot) => {
      const updates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StudentUpdate));
      
      // Sort client side on timestamp descending
      updates.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });

      callback(updates);
    }, onError);
  }
};
