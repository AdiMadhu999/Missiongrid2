
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  // Assuming these are available based on build success of previous turn, 
  // but better to just use the structure that already works in the app.
  // Actually, I'll assume the environment is already setup properly in the app itself.
};

// I need to use the actual app's firebase init. 
// Let's import directly from src/services/firebase
import { db } from './src/services/firebase';
import { AuthService } from './src/services/auth';

async function runVerification() {
  console.log("Starting mentor verification...");
  
  // 1. Verify/Create mentor
  const mentorsRef = collection(db, 'mentors');
  const q = query(mentorsRef, where('mobile', '==', '7407463884'));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    console.log("Mentor not found, creating...");
    await addDoc(mentorsRef, {
      name: 'Adi Madhu',
      mobile: '7407463884',
      pin: '959312',
      role: 'mentor',
      status: 'active'
    });
    console.log("Mentor created.");
  } else {
    console.log("Mentor exists.");
  }
  
  // 2. Test login
  try {
    console.log("Testing login...");
    const user = await AuthService.loginWithMobileAndPassword('7407463884', '959312', 'mentor');
    console.log("Login successful! User:", user.name);
  } catch (e: any) {
    console.error("Login failed:", e.message);
  }
}

runVerification();
