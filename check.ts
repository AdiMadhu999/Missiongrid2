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
    const p1 = await db.collection('users').doc('CI23Ol7a0M3feDCjv9T8').get();
    const p2 = await db.collection('users_private').doc('CI23Ol7a0M3feDCjv9T8').get();
    
    console.log("users:", p1.exists, "users_private:", p2.exists);
    
    const p3 = await db.collection('users').doc('7407463884').get();
    const p4 = await db.collection('users_private').doc('7407463884').get();
    
    console.log("new users:", p3.exists, "new users_private:", p4.exists);
}

run().catch(console.error);
