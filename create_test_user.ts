import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as bcrypt from 'bcryptjs';

const app = initializeApp({ projectId: 'mission-selection-ultimate' });
const db = getFirestore(app, '(default)');

async function run() {
  const hashedPin = bcrypt.hashSync("1234", 10);
  const mobile = "8888888888";
  
  await db.collection("users").doc("test_user_888").set({
    mobile: mobile,
    role: "student",
    name: "Test User"
  });
  
  await db.collection("users_private").doc("test_user_888").set({
    mobile: mobile,
    pin: hashedPin
  });
  
  console.log("User created.");
}
run().catch(console.error);
