const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = require("./firebase-applet-config.json");
serviceAccount.private_key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

initializeApp({ projectId: "mission-selection-ultimate", credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const q = await db.collection("users_private").limit(5).get();
  q.forEach(doc => {
    console.log(doc.id, doc.data().mobile, doc.data().pin);
  });
  const users = await db.collection("users").limit(5).get();
  users.forEach(doc => {
    console.log(doc.id, doc.data().mobile, doc.data().role);
  });
}
run();
