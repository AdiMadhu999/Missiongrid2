import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const config = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp({ credential: cert(config), projectId: 'mission-selection-ultimate' });
const db = getFirestore(app);

async function check() {
  const p = await db.collection("users_private").doc("7407463884").get();
  const u = await db.collection("users").doc("7407463884").get();
  const ur = await db.collection("user_roles").where("userId", "==", "7407463884").get();
  
  console.log("users_private:", p.data());
  console.log("users:", u.data());
  console.log("user_roles count:", ur.size);
  ur.forEach(doc => console.log("role:", doc.id, doc.data()));
  process.exit(0);
}
check();
