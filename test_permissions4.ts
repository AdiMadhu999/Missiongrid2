import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, runTransaction } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    await signInAnonymously(auth);
    const counterRef = doc(db, "system_config", "student_id_counter");
    const newId = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let nextId = 1;
      if (counterSnap.exists()) {
        const data = counterSnap.data();
        nextId = (Number(data?.lastId) || 0) + 1;
      }
      transaction.set(counterRef, { lastId: nextId }, { merge: true });
      return nextId;
    });
    console.log("Transaction success, newId:", newId);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
