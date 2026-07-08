import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

async function run() {
    const snap = await db.collection('users_private').limit(10).get();
    snap.docs.forEach(d => {
        console.log("ID:", d.id, "mobile:", d.data().mobile);
    });
}
run().catch(console.error);
