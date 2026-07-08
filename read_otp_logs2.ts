import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const q = query(collection(db, "otp_logs"), orderBy("timestamp", "desc"), limit(10));
    const snap = await getDocs(q);
    snap.forEach(doc => {
      console.log(doc.data().timestamp, doc.data().status, doc.data().message);
    });
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
