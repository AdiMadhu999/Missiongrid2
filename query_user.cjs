const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
admin.initializeApp({
  projectId: "mission-selection-ultimate"
});

async function run() {
  const db = getFirestore();
  const querySnap = await db.collection("users_private")
      .where("mobile", "==", "9593126676")
      .limit(1)
      .get();
  
  if (querySnap.empty) {
    console.log("No user found in users_private for 9593126676");
    return;
  }
  
  const privateDoc = querySnap.docs[0];
  console.log("private data:", privateDoc.data());
  
  const publicDoc = await db.collection("users").doc(privateDoc.id).get();
  if (!publicDoc.exists) {
    console.log("No public doc found for", privateDoc.id);
  } else {
    console.log("public data:", publicDoc.data());
  }
}
run().catch(console.error);
