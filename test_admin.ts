import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function run() {
  console.log("Initializing Firebase Admin...");
  initializeApp({
    credential: applicationDefault(),
    projectId: "mission-selection-ultimate"
  });

  console.log("\n--- TESTING (default) DATABASE ---");
  try {
    const dbDefault = getFirestore(); // default database
    const snap = await dbDefault.collection("users").limit(1).get();
    console.log("Successfully connected to (default)!");
    console.log("Size:", snap.size);
  } catch (err: any) {
    console.error("Failed to connect to (default):", err.message || err);
  }

  console.log("\n--- TESTING CUSTOM DATABASE ---");
  try {
    const dbCustom = getFirestore("ai-studio-missionselection-3bb9a389-e953-4d48-bb22-0fb33c8566db");
    const snap = await dbCustom.collection("users").limit(1).get();
    console.log("Successfully connected to custom database!");
    console.log("Size:", snap.size);
  } catch (err: any) {
    console.error("Failed to connect to custom database:", err.message || err);
  }
}

run().catch(console.error);
