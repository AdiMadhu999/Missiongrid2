import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    await signInAnonymously(auth);
    const uid = auth.currentUser?.uid!;
    console.log("Signed in anonymously with UID:", uid);
    
    console.log("Trying to getDoc(users)...");
    const snap = await getDoc(doc(db, "users", uid));
    console.log("getDoc users:", snap.exists());

    console.log("Trying to setDoc(users)...");
    await setDoc(doc(db, "users", uid), { uid: uid, role: 'student', mobile: '9999999999', isPremium: true });
    console.log("setDoc users: Success");

  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
