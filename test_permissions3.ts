import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    await signInAnonymously(auth);
    const uid = auth.currentUser?.uid!;
    console.log("UID:", uid);
    
    console.log("setDoc users_private...");
    await setDoc(doc(db, "users_private", uid), { uid: uid, mobile: '9999999999', isNewUser: true });
    
    console.log("setDoc user_roles...");
    await setDoc(doc(db, "user_roles", uid), { userId: uid, role: 'student', updatedAt: new Date().toISOString() });

    console.log("addDoc premium_history...");
    await addDoc(collection(db, "premium_history"), {
      uid: uid,
      studentId: uid,
      source: 'Auto Registration',
      action: 'Auto Premium Activation',
      status: 'active'
    });

    console.log("All success!");
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
