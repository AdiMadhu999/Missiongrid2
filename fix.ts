import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

let credential = applicationDefault();
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    credential = cert(serviceAccount);
  } catch (err) {
    console.error(err);
  }
}

const app = initializeApp({
    credential,
    projectId: 'mission-selection-ultimate'
});
const db = getFirestore(app);

async function run() {
    console.log("Fixing userId field...");
    const snapshot = await db.collection('users_private').get();
    let fixedCount = 0;
    
    for (const doc of snapshot.docs) {
        const id = doc.id;
        if (/^\d{10}$/.test(id)) {
            if (doc.data().userId !== id) {
                await db.collection('users_private').doc(id).update({ userId: id });
                fixedCount++;
            }
        }
    }
    
    const usersSnapshot = await db.collection('users').get();
    for (const doc of usersSnapshot.docs) {
        const id = doc.id;
        if (/^\d{10}$/.test(id)) {
            if (doc.data().userId !== id) {
                await db.collection('users').doc(id).update({ userId: id });
                fixedCount++;
            }
            if (doc.data().id !== id) {
                await db.collection('users').doc(id).update({ id: id });
                fixedCount++;
            }
        }
    }
    console.log(`Fixed ${fixedCount} docs.`);
}

run().catch(console.error);
