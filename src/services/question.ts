import { db } from './firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Question } from '../models/question';
import { sanitizeQuestionObject } from '../utils/questionSanitizer';

const QUESTION_COLLECTION = 'questions';

export async function getQuestions(): Promise<Question[]> {
  const querySnapshot = await getDocs(query(collection(db, QUESTION_COLLECTION), orderBy('updatedAt', 'desc')));
  return querySnapshot.docs.map(doc => sanitizeQuestionObject({ id: doc.id, ...doc.data() } as Question));
}

export async function addQuestion(question: Omit<Question, 'id'>) {
  const sanitized = sanitizeQuestionObject(question);
  return await addDoc(collection(db, QUESTION_COLLECTION), {
    ...sanitized,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateQuestion(id: string, updates: Partial<Question>) {
  const sanitized = sanitizeQuestionObject(updates);
  await updateDoc(doc(db, QUESTION_COLLECTION, id), {
    ...sanitized,
    updatedAt: new Date().toISOString(),
  });
}

export async function archiveQuestion(id: string) {
  await updateDoc(doc(db, QUESTION_COLLECTION, id), {
    status: 'archived',
    updatedAt: new Date().toISOString(),
  });
}

export async function restoreQuestion(id: string) {
  await updateDoc(doc(db, QUESTION_COLLECTION, id), {
    status: 'verified',
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteQuestion(id: string) {
  await deleteDoc(doc(db, QUESTION_COLLECTION, id));
}
