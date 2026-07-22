import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    await signInAnonymously(auth);
    console.log("Signed in anonymously with UID:", auth.currentUser?.uid);
    
    const privateRef = collection(db, "users_private");
    const q = query(privateRef, where("mobile", "==", "9999999999"));
    const snap = await getDocs(q);
    console.log("Success! Found docs:", snap.size);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
