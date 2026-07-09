import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function run() {
  try {
    initializeApp();
    console.log("Successfully initialized with empty initializeApp()");
    const db = getFirestore();
    const snap = await db.collection("users").limit(1).get();
    console.log("SUCCESS! Connected. Docs found:", snap.size);
  } catch (err: any) {
    console.error("Failed empty init test:", err.message || err);
  }
}

run();
