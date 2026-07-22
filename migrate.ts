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

async function migrate() {
    console.log("Starting migration...");
    const collections = ['users', 'users_private'];
    
    for (const coll of collections) {
        console.log(`Migrating ${coll}...`);
        const snapshot = await db.collection(coll).get();
        let migratedCount = 0;
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const id = doc.id;
            
            // Check if ID is not a mobile number (10 digits)
            if (!/^\d{10}$/.test(id) && data.mobile) {
                let mobile = String(data.mobile).replace(/\D/g, '');
                if (mobile.length > 10) mobile = mobile.slice(-10);
                
                if (mobile.length === 10 && id !== mobile) {
                    console.log(`Migrating doc ${id} -> ${mobile} in ${coll}`);
                    // Copy data to new doc
                    await db.collection(coll).doc(mobile).set(data);
                    // Delete old doc
                    await db.collection(coll).doc(id).delete();
                    migratedCount++;
                }
            }
        }
        console.log(`Completed ${coll}, migrated ${migratedCount} docs.`);
    }
}

migrate().then(() => console.log("Done")).catch(console.error);
