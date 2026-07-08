import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function run() {
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
  console.log("GOOGLE_CLOUD_PROJECT in env:", gcpProject);

  try {
    initializeApp({
      credential: applicationDefault(),
      projectId: gcpProject
    });
    console.log("Initialized Firebase Admin with project:", gcpProject);

    const db = getFirestore();
    const snap = await db.collection("users").limit(5).get();
    console.log("SUCCESS! Connected to Firestore (default) under project:", gcpProject);
    console.log("Size:", snap.size);
    snap.forEach(doc => {
      console.log("Doc ID:", doc.id, doc.data());
    });
  } catch (err: any) {
    console.error("Failed:", err.message || err);
  }
}

run();
