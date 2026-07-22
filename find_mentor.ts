import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: "mission-selection-ultimate"
});
const db = getFirestore(app, '(default)');

async function findMentor() {
  const users = await db.collection('users').where('mobile', '==', '7407463884').get();
  users.forEach(doc => {
    console.log(`Mentor UID: ${doc.id}`);
  });
}
findMentor();
