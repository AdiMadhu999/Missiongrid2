import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, setDoc, addDoc, collection } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    await signInAnonymously(auth);
    const userId = auth.currentUser?.uid!;
    console.log("UID:", userId);

    const publicData = {
      name: 'Student',
      role: 'student',
      isPremium: true,
      premium: true,
      premiumStatus: 'active',
      premiumPlan: 'Mission Selection Premium',
      premiumSource: 'Auto Registration',
      premiumDays: 30,
      premiumType: 'FREE_TRIAL',
      trialDays: 30,
      remainingPremiumDays: 30,
      consecutiveMissedMissions: 0,
      lastMissionSubmissionDate: null,
      manualPremiumOverride: false,
      missionGridStudentId: 'MG123456',
      studentCode: 'MG123456',
      uid: userId,
      mobile: '9999999999'
    };

    try {
      await setDoc(doc(db, 'users', userId), publicData);
      console.log("users OK");
    } catch(e: any) { console.log("users FAIL", e.message); }

    try {
      await setDoc(doc(db, 'users_private', userId), { uid: userId, mobile: '9999999999' });
      console.log("users_private OK");
    } catch(e: any) { console.log("users_private FAIL", e.message); }

    try {
      await setDoc(doc(db, 'user_roles', userId), { userId: userId, role: 'student' });
      console.log("user_roles OK");
    } catch(e: any) { console.log("user_roles FAIL", e.message); }

    try {
      await addDoc(collection(db, 'premium_history'), {
        uid: userId, studentId: userId, source: 'Auto Registration', action: 'Auto Premium Activation', status: 'active'
      });
      console.log("premium_history OK");
    } catch(e: any) { console.log("premium_history FAIL", e.message); }
    
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
