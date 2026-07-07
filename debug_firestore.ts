
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function debug() {
  console.log("--- Starting Admin SDK Debug ---");
  try {
    const projectId = "mission-selection-ultimate";
    const dbId = "(default)";
    console.log(`Targeting Project: ${projectId}, DB: ${dbId}`);

    // Attempt initialization
    const app = initializeApp({
      projectId: projectId,
    });
    console.log("App initialized.");

    const db = getFirestore(app, dbId);
    console.log("Firestore client created.");

    const docRef = db.collection('system_config').doc('student_id_counter');
    console.log(`Attempting read on: ${docRef.path}`);
    
    const snap = await docRef.get();
    console.log("Read successful! Exists:", snap.exists);
  } catch (err: any) {
    console.error("--- FAILURE ---");
    console.error("Exception:", err.message);
    console.error("Code:", err.code);
    console.error("Details:", err.details);
    console.error("Stack:", err.stack);
  }
}

debug();
