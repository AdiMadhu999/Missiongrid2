import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
dotenv.config();

async function test() {
  let credential = applicationDefault();
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = cert(serviceAccount);
      console.log("Using service account key from environment.");
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", err);
    }
  }

  initializeApp({ credential, projectId: "mission-selection-ultimate" });
  const db = getFirestore();
  const res = await db.collection("users").limit(30).get();
  console.log("Total users found:", res.size);
  res.forEach(doc => {
    const d = doc.data();
    console.log(`ID: ${doc.id}, Name: ${d.name}, Role: ${d.role}, isPremium: ${d.isPremium}`);
  });
}

test().catch(console.error);
