import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

const db = getFirestore();

async function run() {
  try {
    const q = db.collection("otp_logs").orderBy("timestamp", "desc").limit(10);
    const snap = await q.get();
    snap.forEach(doc => {
      console.log(doc.data().timestamp, doc.data().status, doc.data().message);
    });
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
