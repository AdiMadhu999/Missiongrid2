const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = require("./firebase-applet-config.json");
initializeApp({ projectId: "mission-selection-ultimate" });
const db = getFirestore();

async function run() {
  const q = await db.collection("users_private").where("mobile", "==", "7407463884").get();
  q.forEach(doc => {
    console.log(doc.id, doc.data());
  });
  
  const q2 = await db.collection("users").doc(q.docs[0].id).get();
  console.log("Public:", q2.data());
}
run();
