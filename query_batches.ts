import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function checkBatches() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.log("No FIREBASE_SERVICE_ACCOUNT_KEY found");
    return;
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'mission-selection-ultimate'
  });
  const db = getFirestore(app, "(default)");
  
  const snap = await db.collection('batches').get();
  console.log(`Found ${snap.size} batches`);
  snap.forEach(doc => {
    console.log(doc.id, "=>", doc.data().batchName);
  });
}
checkBatches();
