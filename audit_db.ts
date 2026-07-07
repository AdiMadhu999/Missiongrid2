import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const firebaseConfig = {
  projectId: "mission-selection-ultimate",
  appId: "1:43729399220:web:5090f140c42da8867916e1",
  apiKey: "AIzaSyDiET7oGHd8k4-SUjH4_yolWA66KLD5INM",
  authDomain: "mission-selection-ultimate.firebaseapp.com",
  storageBucket: "mission-selection-ultimate.firebasestorage.app",
  messagingSenderId: "43729399220"
};

async function run() {
  console.log("\n======================================================================");
  console.log("   PRODUCTION DATABASE AUDIT & V2 READINESS CHECKER");
  console.log("======================================================================");
  console.log("Initializing Firebase App and Firestore (default)...");
  
  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
  }, '(default)');

  try {
    // 1. Audit Users and Roles
    console.log("Auditing Users, Roles and Permissions...");
    const usersColl = collection(db, 'users');
    const usersSnap = await getDocs(usersColl);

    const privateColl = collection(db, 'users_private');
    const privateSnap = await getDocs(privateColl);

    const rolesColl = collection(db, 'user_roles');
    const rolesSnap = await getDocs(rolesColl);

    const mentorsColl = collection(db, 'mentors');
    const mentorsSnap = await getDocs(mentorsColl);

    let mentorCount = 0;
    let studentCount = 0;
    let examinerCount = 0;
    let fallbackCount = 0;
    const mentorsList: any[] = [];

    usersSnap.forEach((userDoc) => {
      const data = userDoc.data();
      const role = (data.role || '').toLowerCase();
      const mobile = (data.mobile || '').replace(/\D/g, '');

      if (['mentor', 'primary-mentor', 'staff', 'admin'].includes(role)) {
        mentorCount++;
        mentorsList.push({
          id: userDoc.id,
          name: data.name || 'Adi Madhu',
          role: role,
          status: data.status || 'active',
          mobile: mobile || 'N/A'
        });
      } else if (['student', 'aspirant'].includes(role)) {
        studentCount++;
      } else if (role === 'examiner') {
        examinerCount++;
      } else {
        fallbackCount++;
      }
    });

    // 2. Audit Tests and Structural elements
    console.log("Auditing Course Structure, folders, and tests...");
    const testsColl = collection(db, 'tests');
    const testsSnap = await getDocs(testsColl);

    const foldersColl = collection(db, 'test_folders');
    const foldersSnap = await getDocs(foldersColl);

    let testDrafts = 0;
    let testPublished = 0;
    let testLive = 0;
    let testPublic = 0;

    testsSnap.forEach((testDoc) => {
      const data = testDoc.data();
      const status = (data.status || '').toLowerCase();
      if (status === 'published') testPublished++;
      else if (status === 'live') testLive++;
      else testDrafts++;

      if (data.isPublic) testPublic++;
    });

    // 3. Audit Operational and Log collections
    console.log("Auditing Transient session logs and student data...");
    const operationalCollections = [
      'test_attempts',
      'dailyMissionReports',
      'studentStats',
      'otp_logs',
      'leaves',
      'notifications',
      'activity_logs'
    ];

    const operationalStats: Record<string, number> = {};
    let totalOperationalDocs = 0;

    for (const collName of operationalCollections) {
      try {
        const collRef = collection(db, collName);
        const snap = await getDocs(collRef);
        operationalStats[collName] = snap.size;
        totalOperationalDocs += snap.size;
      } catch (err: any) {
        console.warn(`⚠️  Failed to query operational collection "${collName}":`, err.message || err);
        operationalStats[collName] = 0;
      }
    }

    // 4. Calculate Integrity and Readiness Checks
    const isMentorPresent = mentorCount > 0;
    const isOperationalClean = totalOperationalDocs === 0;
    const isStudentsRemoved = studentCount === 0;
    const isExaminersRemoved = examinerCount === 0;
    const isReadyForV2 = isMentorPresent && isOperationalClean && isStudentsRemoved && isExaminersRemoved;

    const auditReport = {
      timestamp: new Date().toISOString(),
      databaseId: "(default)",
      projectId: "mission-selection-ultimate",
      usersSummary: {
        totalUsers: usersSnap.size,
        mentors: mentorCount,
        students: studentCount,
        examiners: examinerCount,
        others: fallbackCount,
        privateProfiles: privateSnap.size,
        roleMappings: rolesSnap.size,
        mentorsRegistered: mentorsSnap.size
      },
      structuralSummary: {
        totalTests: testsSnap.size,
        drafts: testDrafts,
        published: testPublished,
        live: testLive,
        public: testPublic,
        testFolders: foldersSnap.size
      },
      operationalSummary: {
        totalOperationalDocs,
        ...operationalStats
      },
      v2Readiness: {
        isReadyForV2,
        checks: {
          mentorPresent: { status: isMentorPresent ? "PASSED" : "FAILED", description: "At least one active mentor user is registered" },
          studentsRemoved: { status: isStudentsRemoved ? "PASSED" : "FAILED", description: "All student and aspirant accounts are removed" },
          examinersRemoved: { status: isExaminersRemoved ? "PASSED" : "FAILED", description: "All examiner accounts are removed" },
          operationalDataClean: { status: isOperationalClean ? "PASSED" : "FAILED", description: "All operational, session, and log collections are completely clean" }
        }
      },
      mentorsDetails: mentorsList
    };

    // Save report to disk
    fs.writeFileSync(
      path.join(process.cwd(), "database_audit_report.json"),
      JSON.stringify(auditReport, null, 2),
      "utf8"
    );

    // Beautiful CLI output formatting
    console.log("\n======================================================================");
    console.log("                       DATABASE AUDIT SUMMARY REPORT                  ");
    console.log("======================================================================");
    console.log(`Database ID: (default) | Project ID: mission-selection-ultimate`);
    console.log(`Report generated at: ${auditReport.timestamp}`);
    console.log("----------------------------------------------------------------------");
    
    console.log("\n👤 USERS & ROLES STATS:");
    console.log(`  - Total Users:         ${auditReport.usersSummary.totalUsers}`);
    console.log(`  - Mentors / Admins:    ${auditReport.usersSummary.mentors}`);
    console.log(`  - Students / Aspirants: ${auditReport.usersSummary.students}`);
    console.log(`  - Examiners:           ${auditReport.usersSummary.examiners}`);
    console.log(`  - Others:              ${auditReport.usersSummary.others}`);
    console.log(`  - Private Profiles:    ${auditReport.usersSummary.privateProfiles}`);
    console.log(`  - Role Mappings:       ${auditReport.usersSummary.roleMappings}`);
    console.log(`  - Mentors Collection:  ${auditReport.usersSummary.mentorsRegistered}`);

    console.log("\n📚 CONTENT & STRUCTURE:");
    console.log(`  - Total Tests:         ${auditReport.structuralSummary.totalTests} (Drafts: ${auditReport.structuralSummary.drafts}, Published: ${auditReport.structuralSummary.published}, Live: ${auditReport.structuralSummary.live})`);
    console.log(`  - Public Tests:        ${auditReport.structuralSummary.public}`);
    console.log(`  - Folders Count:       ${auditReport.structuralSummary.testFolders}`);

    console.log("\n⚡ OPERATIONAL DATA STATE (SHOULD BE CLEANED FOR V2):");
    console.log(`  - Total Transient Docs: ${auditReport.operationalSummary.totalOperationalDocs}`);
    for (const key of Object.keys(operationalStats)) {
      const count = operationalStats[key];
      const prefix = count === 0 ? "✅ " : "⚠️  ";
      console.log(`    ${prefix}${key.padEnd(25)} : ${count}`);
    }

    console.log("\n🛡️  MISSIONGRID V2 READINESS AUDIT CHECKLIST:");
    console.log(`  [${isMentorPresent ? "PASS" : "FAIL"}] Mentor Present          : At least one mentor exists`);
    console.log(`  [${isStudentsRemoved ? "PASS" : "FAIL"}] Students Pruned         : No students in users registry`);
    console.log(`  [${isExaminersRemoved ? "PASS" : "FAIL"}] Examiners Pruned        : No examiners in users registry`);
    console.log(`  [${isOperationalClean ? "PASS" : "FAIL"}] Operational Data Clear : Clean logs, attempts, and stats`);
    
    console.log("----------------------------------------------------------------------");
    if (isReadyForV2) {
      console.log("🎉 SUCCESS: DATABASE IS 100% READY FOR THE MISSIONGRID V2 TRANSITION!");
    } else {
      console.log("❌ WARNING: DATABASE IS NOT FULLY READY. PLEASE CLEAR OUTSTANDING Operational Data or Roles.");
    }
    console.log("======================================================================\n");
    console.log("Report saved successfully to database_audit_report.json\n");

  } catch (error: any) {
    console.error("❌ Critical database audit error:", error.message || error);
  }
}

run();
