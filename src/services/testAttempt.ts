import { db } from './firebase';
import { collection, doc, addDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { TestAttempt } from '../models/testAttempt';

const ATTEMPT_COLLECTION = 'test_attempts';

export async function startTestAttempt(testId: string, studentId: string, studentName: string): Promise<string> {
  const attempt = {
    testId,
    studentId,
    studentName,
    answers: {},
    markedQuestions: [],
    status: 'started',
    startTime: new Date().toISOString(),
  };
  const docRef = await addDoc(collection(db, ATTEMPT_COLLECTION), attempt);
  return docRef.id;
}

export async function saveAnswer(attemptId: string, questionId: string, answer: any, isMarked: boolean) {
  const docRef = doc(db, ATTEMPT_COLLECTION, attemptId);
  // Partial update
  await updateDoc(docRef, {
    [`answers.${questionId}`]: answer,
  });
}

export async function submitTest(attemptId: string) {
  await updateDoc(doc(db, ATTEMPT_COLLECTION, attemptId), {
    status: 'submitted',
    submitTime: new Date().toISOString(),
  });
}

export async function getLiveAttempts(testId: string): Promise<TestAttempt[]> {
  const q = query(collection(db, ATTEMPT_COLLECTION), where('testId', '==', testId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({id: d.id, ...d.data()} as TestAttempt));
}
