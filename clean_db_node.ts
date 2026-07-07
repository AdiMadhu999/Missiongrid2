import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const app = initializeApp({
  credential: applicationDefault(),
  projectId: "mission-selection-ultimate"
});

const db = getFirestore(app, '(default)');

async function run() {
  console.log("Starting Production Database Reset on (default) database ID...");

  let totalStudentsRemoved = 0;
  let totalExaminersRemoved = 0;
  let totalTestAttemptsRemoved = 0;
  let totalSubmissionRecordsRemoved = 0;
  let totalLeaderboardRecordsRemoved = 0;
  let mentorAccounts: any[] = [];

  try {
    // 1. Process users, users_private, and user_roles
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} user profiles in users collection.`);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const userRole = (userData.role || '').toLowerCase();
      
      let mobile = userData.mobile || '';
      
      try {
        const privDoc = await db.collection('users_private').doc(userId).get();
        if (privDoc.exists) {
            mobile = privDoc.data()?.mobile || mobile;
        }
      } catch (e) {
        console.warn(`Failed to fetch private data for user ${userId}:`, e);
      }

      const sanitizedMobile = (mobile || '').replace(/\D/g, '');

      if (sanitizedMobile === '7407463884') {
        console.log(`Preserving Mentor account: ${userId} with mobile: ${sanitizedMobile}`);
        mentorAccounts.push({ id: userId, mobile: sanitizedMobile, role: 'mentor', status: 'active' });
      } else {
        console.log(`Deleting user account ${userId} with role: ${userRole}`);
        if (userRole === 'examiner') totalExaminersRemoved++;
        else totalStudentsRemoved++;

        await db.collection('users').doc(userId).delete();
        await db.collection('users_private').doc(userId).delete();
        await db.collection('user_roles').doc(userId).delete();
      }
    }

    // 2. Clear remaining user_roles that might be orphaned
    const rolesSnap = await db.collection('user_roles').get();
    for (const roleDoc of rolesSnap.docs) {
      if (roleDoc.id !== '7407463884' && !mentorAccounts.some(m => m.id === roleDoc.id)) {
        await roleDoc.ref.delete();
      }
    }

    // 3. Delete operational data
    const collectionsToClear = [
        'test_attempts', 'dailyMissionReports', 'studentStats', 
        'otp_logs', 'leaves', 'notifications', 'activity_logs'
    ];

    for (const collName of collectionsToClear) {
        const snap = await db.collection(collName).get();
        for (const doc of snap.docs) {
            await doc.ref.delete();
            if (collName === 'test_attempts') totalTestAttemptsRemoved++;
            if (collName === 'dailyMissionReports') totalSubmissionRecordsRemoved++;
            if (collName === 'studentStats') totalLeaderboardRecordsRemoved++;
        }
    }

  } catch (err: any) {
    console.error("General reset error:", err.message || err);
  }

  // Compile final report
  const cleanupReport = {
    mentorAccounts,
    studentsRemoved: totalStudentsRemoved,
    examinersRemoved: totalExaminersRemoved,
    testAttemptsRemoved: totalTestAttemptsRemoved,
    submissionRecordsRemoved: totalSubmissionRecordsRemoved,
    leaderboardRecordsRemoved: totalLeaderboardRecordsRemoved,
    remainingCollections: ["users", "users_private", "user_roles", "mentors", "tests", "questions", "test_folders"],
    readyForV2: true
  };

  console.log("\n=================================");
  console.log("CLEANUP REPORT:");
  console.log(JSON.stringify(cleanupReport, null, 2));
  console.log("=================================");

  fs.writeFileSync(path.join(process.cwd(), 'cleanup_report.json'), JSON.stringify(cleanupReport, null, 2), 'utf8');
  console.log("Saved report to cleanup_report.json");
}

run().catch(console.error);
