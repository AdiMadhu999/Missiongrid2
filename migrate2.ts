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
    console.log("Starting migration 2...");
    
    // Get all users_private
    const snapshot = await db.collection('users_private').get();
    let migratedCount = 0;
    
    for (const doc of snapshot.docs) {
        const privateData = doc.data();
        const id = doc.id;
        const legacyUserId = privateData.userId;
        
        if (/^\d{10}$/.test(id) && legacyUserId && legacyUserId !== id) {
            // Check if users doc with legacy ID exists
            const legacyUserDoc = await db.collection('users').doc(legacyUserId).get();
            if (legacyUserDoc.exists) {
                console.log(`Migrating users doc ${legacyUserId} -> ${id}`);
                const data = legacyUserDoc.data();
                await db.collection('users').doc(id).set(data);
                await db.collection('users').doc(legacyUserId).delete();
                
                // Also update userId in users_private to match the mobile number
                await db.collection('users_private').doc(id).update({
                    userId: id
                });
                
                // Update user_roles
                if (privateData.uid) {
                    await db.collection('user_roles').doc(privateData.uid).update({
                        userId: id
                    }).catch(() => {});
                }
                
                migratedCount++;
            }
        }
    }
    console.log(`Migrated ${migratedCount} docs.`);
}

migrate().then(() => console.log("Done")).catch(console.error);
