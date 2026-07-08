const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "mission-selection-ultimate",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, '(default)');

async function run() {
  try {
    const q = query(collection(db, 'users_private'), where('mobile', '==', '9593126676'));
    await getDocs(q);
    console.log("Success");
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
