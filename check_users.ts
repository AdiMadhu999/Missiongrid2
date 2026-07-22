import { db } from './src/services/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function check() {
  console.log("--- QUERYING USERS ---");
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Total users in 'users' collection: ${usersSnap.size}`);
  usersSnap.forEach(doc => {
    console.log(`User Doc ID: ${doc.id}, Data:`, doc.data());
  });

  console.log("\n--- QUERYING USERS PRIVATE ---");
  const privateSnap = await getDocs(collection(db, 'users_private'));
  console.log(`Total users in 'users_private' collection: ${privateSnap.size}`);
  privateSnap.forEach(doc => {
    console.log(`Private Doc ID: ${doc.id}, Data:`, doc.data());
  });

  console.log("\n--- QUERYING USER ROLES ---");
  const rolesSnap = await getDocs(collection(db, 'user_roles'));
  console.log(`Total user roles in 'user_roles' collection: ${rolesSnap.size}`);
  rolesSnap.forEach(doc => {
    console.log(`Role Doc ID: ${doc.id}, Data:`, doc.data());
  });

  console.log("\n--- QUERYING MENTORS ---");
  const mentorsSnap = await getDocs(collection(db, 'mentors'));
  console.log(`Total mentors in 'mentors' collection: ${mentorsSnap.size}`);
  mentorsSnap.forEach(doc => {
    console.log(`Mentor Doc ID: ${doc.id}, Data:`, doc.data());
  });
}

check().catch(console.error);
