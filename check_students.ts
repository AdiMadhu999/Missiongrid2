import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: "mission-selection-ultimate"
});
const db = getFirestore(app, '(default)');

async function check() {
  const users = await db.collection('users').get();
  console.log(`Found ${users.size} documents in 'users'.`);
  users.forEach(doc => {
    const data = doc.data();
    if (data.role === 'student' || data.role === 'aspirant') {
      console.log(`- ID: ${doc.id} | Name: ${data.name} | Role: ${data.role} | isPremium: ${data.isPremium} | premiumStatus: ${data.premiumStatus} | consecutiveMissedDays: ${data.consecutiveMissedDays} | consecutiveMissedMissions: ${data.consecutiveMissedMissions} | lastMissionSubmissionDate: ${data.lastMissionSubmissionDate}`);
    }
  });
}
check();
