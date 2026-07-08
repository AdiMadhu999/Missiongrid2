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
    const mobile = '7407463884';
    const usersRef = db.collection('users').doc(mobile);
    const privateRef = db.collection('users_private').doc(mobile);
    
    // Get existing data
    const userSnap = await usersRef.get();
    const privateSnap = await privateRef.get();
    
    let uid = privateSnap.exists ? privateSnap.data()?.uid : (userSnap.exists ? userSnap.data()?.uid : null);
    
    if (!uid) {
        console.log("No UID found for this user. Let's look up by mobile.");
        // We might not have UID here, but let's assume the user has one if they logged in.
    }
    
    const roleData = {
        role: 'mentor',
        status: 'active',
        isPremium: true,
        premiumStatus: 'active',
        studentCode: 'MENTOR-ADMIN'
    };
    
    await usersRef.set(roleData, { merge: true });
    
    if (uid) {
        const rolesRef = db.collection('user_roles').doc(uid);
        await rolesRef.set({
            role: 'mentor',
            permissions: ['all'],
            userId: mobile,
            mobile: mobile
        }, { merge: true });
        console.log(`Updated user_roles for uid: ${uid}`);
    } else {
        console.log("UID not found, skipping user_roles update for now. Let them login first.");
    }
    
    console.log("Successfully updated user to permanent verified mentor.");
}

run().catch(console.error);
