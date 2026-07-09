import { db } from './firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, getDoc, limit } from 'firebase/firestore';
import { Warning } from '../models/warning';
import { safeDate } from '../utils/date';
import { StudentStatsService } from './studentStats';
import { StudentUpdatesService } from './studentUpdates';

const WARNING_COLLECTION = 'warnings';

export async function addWarning(warning: Omit<Warning, 'id' | 'date' | 'status'> & { uid?: string }) {
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

    const res = await addDoc(collection(db, WARNING_COLLECTION), {
        ...warning,
        uid,
        date: new Date().toISOString(),
        status: 'Active'
    });
    
    try {
        await StudentUpdatesService.createUpdate({
            studentId: warning.studentId,
            type: 'mentor_update',
            title: '📢 Mentor Warning Issued',
            description: `A new warning notice has been issued to your profile: "${warning.reason}"`
        });
    } catch (err) {
        console.error('Error logging warning notice student update:', err);
    }

    await StudentStatsService.updateStats(warning.studentId);
    return res;
}

export async function resolveWarning(id: string, studentId: string) {
    await updateDoc(doc(db, WARNING_COLLECTION, id), {
        status: 'Resolved'
    });

    try {
        await StudentUpdatesService.createUpdate({
            studentId,
            type: 'mentor_update',
            title: '✅ Warning Resolved',
            description: `Your active warning notice has been marked as resolved by your mentor.`
        });
    } catch (err) {
        console.error('Error logging resolved warning student update:', err);
    }

    await StudentStatsService.updateStats(studentId);
}

export async function getWarningsForStudent(studentId: string): Promise<Warning[]> {
    const q = query(collection(db, WARNING_COLLECTION), where('studentId', '==', studentId), limit(50));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({id: d.id, ...d.data()} as Warning))
        .sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
}

export async function getAllWarnings(): Promise<Warning[]> {
    const q = query(collection(db, WARNING_COLLECTION), limit(100));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({id: d.id, ...d.data()} as Warning))
        .sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
}
