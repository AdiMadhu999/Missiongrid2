
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function debug() {
  console.log("--- Starting Comprehensive Firestore Debug with Service Account ---");
  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log("Found FIREBASE_SERVICE_ACCOUNT_KEY");
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = cert(serviceAccount);
    } else {
      console.log("No FIREBASE_SERVICE_ACCOUNT_KEY found in process.env");
      return;
    }

    const app = initializeApp({
      credential,
      projectId: 'mission-selection-ultimate'
    });
    console.log("App initialized.");

    const db = getFirestore(app, "(default)");
    console.log("Firestore client created.");

    // 1. Try to list collections at root
    console.log("Attempting to list collections...");
    const collections = await db.listCollections();
    console.log("Collections:", collections.map(c => c.id));

    // 2. Try to read system_config
    const docRef = db.collection('system_config').doc('student_id_counter');
    console.log(`Attempting read on: ${docRef.path}`);
    
    const snap = await docRef.get();
    console.log("Read successful! Exists:", snap.exists, "Data:", snap.data());
  } catch (err: any) {
    console.error("--- FAILURE ---");
    console.error("Exception:", err.message);
    console.error("Code:", err.code);
    console.error("Stack:", err.stack);
  }
}

debug();

