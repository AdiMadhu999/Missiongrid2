import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: "mission-selection-ultimate"
});

const db = getFirestore(app, '(default)');

async function check() {
  try {
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} collections:`);
    collections.forEach(coll => console.log(coll.id));
  } catch (e) {
    console.error("Failed to list collections:", e);
  }
}
check();
