const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
admin.initializeApp({
  projectId: "mission-selection-ultimate"
});
const db = getFirestore();
async function run() {
  const users = await db.collection('users').get();
  for (const doc of users.docs) {
      console.log(doc.id, "=>", doc.data().role);
  }
}
run().catch(console.error);
