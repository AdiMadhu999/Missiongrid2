import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function checkDatabase() {
  console.log("--- Checking Database Status ---");
  try {
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

    console.log("\n--- Checking Users Private Collection ---");
    const privateSnap = await db.collection('users_private').orderBy('registrationTimestamp', 'desc').limit(10).get();
    console.log(`Found ${privateSnap.size} recent private docs:`);
    privateSnap.forEach(doc => {
      const data = doc.data();
      console.log(doc.id, "=> Mobile:", data.mobile, "UID:", data.uid, "Created:", data.registrationDateTime || data.createdAt);
    });

    console.log("\n--- Checking Users Public Collection ---");
    const publicSnap = await db.collection('users').orderBy('createdAt', 'desc').limit(10).get();
    console.log(`Found ${publicSnap.size} recent public docs:`);
    publicSnap.forEach(doc => {
      const data = doc.data();
      console.log(doc.id, "=> StudentId:", data.missionGridStudentId, "Name:", data.name, "Role:", data.role, "UID:", data.uid, "Created:", data.createdAt);
    });

    console.log("\n--- Checking User Roles Collection ---");
    const rolesSnap = await db.collection('user_roles').limit(10).get();
    console.log(`Found ${rolesSnap.size} role docs:`);
    rolesSnap.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });

  } catch (err: any) {
    console.error("Error reading database:", err);
  }
}

checkDatabase();
