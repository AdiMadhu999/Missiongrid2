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
    const mobile = '9593126676';
    const p1 = await db.collection('users').doc(mobile).get();
    const p2 = await db.collection('users_private').doc(mobile).get();
    
    console.log("users:", p1.exists, p1.data());
    console.log("users_private:", p2.exists, p2.data());
}

run().catch(console.error);
