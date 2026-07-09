import { collection, addDoc, query, where, getDocs, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { MissionSubmission } from '../models/submission';
import { User } from '../models/user';

export const SubmissionService = {
  submitMission: async (
    user: User, 
    prepDay: number, 
    studyProofUrl: string, 
    remarks: string = ''
  ): Promise<string> => {
    // 1. One Submission Rule Validation
    const q = query(
      collection(db, 'missionSubmissions'), 
      where('studentId', '==', user.id),
      where('preparationDay', '==', prepDay)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      throw new Error("You have already submitted today's Mission.");
    }

    // 2. Automatic Data Capture
    const now = new Date();
    const submission: MissionSubmission = {
      studentId: user.id,
      studentName: user.name || 'Candidate',
      firebaseUid: user.uid || '', 
      registeredMobile: user.mobile || '',
      batchId: user.batchId || 'N/A',
      preparationDay: prepDay,
      targetDay: prepDay, 
      submissionDate: now.toISOString().split('T')[0],
      submissionTime: now.toISOString().split('T')[1].split('.')[0],
      submittedAt: serverTimestamp(),
      deviceInstallationId: localStorage.getItem('deviceInstallationId') || 'unknown',
      status: 'Pending Review',
      submissionVersion: 'v2',
      studyProofUrl,
      remarks,
      attachments: [{ url: studyProofUrl, type: 'pdf', name: 'Study Proof', path: studyProofUrl }]
    };

    // 3. Save
    const docRef = await addDoc(collection(db, 'missionSubmissions'), submission);
    return docRef.id;
  },

  getSubmissionHistory: async (studentId: string): Promise<MissionSubmission[]> => {
    const q = query(
      collection(db, 'missionSubmissions'), 
      where('studentId', '==', studentId),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissionSubmission));
  },
  
  getLatestSubmission: async (studentId: string): Promise<MissionSubmission | null> => {
      const q = query(
          collection(db, 'missionSubmissions'), 
          where('studentId', '==', studentId),
          orderBy('submittedAt', 'desc'),
          limit(1)
      );
      const snapshot = await getDocs(q);
      if(snapshot.empty) return null;
      return {id: snapshot.docs[0].id, ...snapshot.docs[0].data()} as MissionSubmission;
  }
};
