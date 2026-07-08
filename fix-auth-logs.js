import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const config = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp({ credential: cert(config), projectId: 'mission-selection-ultimate' });
const db = getFirestore(app);

async function cleanLogs() {
  const q = await db.collection("mentor_auth_logs").where("mobile", "==", "7407463884").get();
  for (const doc of q.docs) {
    if (doc.data().status === 'FAILURE') {
      console.log("Removing failure log:", doc.id);
      await doc.ref.delete();
    }
  }
}
cleanLogs();
