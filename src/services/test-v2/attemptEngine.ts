import { db } from '../firebase';
import { doc, setDoc, updateDoc, serverTimestamp, query, collection, where, getDocs, Timestamp } from 'firebase/firestore';

export async function createAttempt(userId: string, testId: string) {
  const attemptId = `${userId}_${testId}_${Date.now()}`;
  const attemptRef = doc(db, 'test_attempts_v2', attemptId);
  
  await setDoc(attemptRef, {
    userId,
    testId,
    startTime: serverTimestamp(),
    status: 'active',
    responses: {},
    score: 0
  });

  return attemptId;
}

export async function getActiveAttempt(userId: string, testId: string) {
  const q = query(collection(db, 'test_attempts_v2'), 
    where('userId', '==', userId), 
    where('testId', '==', testId), 
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function updateAttemptResponse(attemptId: string, questionId: string, response: any) {
  const attemptRef = doc(db, 'test_attempts_v2', attemptId);
  await updateDoc(attemptRef, {
    [`responses.${questionId}`]: response,
    lastUpdated: serverTimestamp()
  });
}

export async function submitAttempt(attemptId: string, testData: any) {
  const attemptRef = doc(db, 'test_attempts_v2', attemptId);
  
  // Simple score calculation (to be expanded later)
  // Need to compare with testData.questions
  
  await updateDoc(attemptRef, {
    status: 'completed',
    endTime: serverTimestamp()
  });
}
