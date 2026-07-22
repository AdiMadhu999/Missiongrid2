import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function getTestById(testId: string) {
  try {
    const testRef = doc(db, 'tests', testId);
    const testSnap = await getDoc(testRef);

    if (!testSnap.exists()) {
      throw new Error('Test not found');
    }

    return { id: testSnap.id, ...testSnap.data() };
  } catch (error) {
    console.error('Error fetching test:', error);
    throw error;
  }
}
