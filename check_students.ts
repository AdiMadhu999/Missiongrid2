import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: "mission-selection-ultimate"
});
const db = getFirestore(app, '(default)');

async function check() {
  const users = await db.collection('users').get();
  let students = 0;
  users.forEach(doc => {
    if (doc.data().role === 'student') students++;
  });
  console.log(`Found ${students} students.`);
}
check();
