import React, { useEffect } from 'react';
import { app, db } from '../services/firebase';
import { getFirestore, collection, getDocs, doc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { apiFetch } from '../utils/api';

export const DBCleanupController: React.FC = () => {
  useEffect(() => {
    const runCleanup = async () => {
      if (localStorage.getItem('__db_cleanup_completed_v2') === 'true') {
        console.log("[DBCleanupController] Cleanup already completed in a previous run.");
        return;
      }

      console.log("[DBCleanupController] Starting Production Database Reset for MissionGrid V2...");

      const databases = [
        { id: '(default)', dbInstance: db }
      ];

      let totalStudentsRemoved = 0;
      let totalExaminersRemoved = 0;
      let totalTestAttemptsRemoved = 0;
      let totalSubmissionRecordsRemoved = 0;
      let totalLeaderboardRecordsRemoved = 0; // studentStats
      let mentorAccounts: any[] = [];

      for (const { id: dbId, dbInstance } of databases) {
        console.log(`[DBCleanupController] Cleaning up database: ${dbId}`);

        try {
          // 1. Process users, users_private, and user_roles
          const usersColl = collection(dbInstance, 'users');
          const usersSnap = await getDocs(usersColl);

          for (const userDoc of usersSnap.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const userRole = (userData.role || '').toLowerCase();

            // Try to find the mobile number
            let mobile = userData.mobile || '';
            let privateData: any = null;

            // Fetch private doc
            try {
              const privDocRef = doc(dbInstance, 'users_private', userId);
              const privSnap = await getDoc(privDocRef);
              if (privSnap.exists()) {
                privateData = privSnap.data();
                mobile = privateData.mobile || mobile;
              }
            } catch (e) {
              console.warn(`[DBCleanupController] Failed to fetch private data for user ${userId}:`, e);
            }

            const sanitizedMobile = (mobile || '').replace(/\D/g, '');

            if (sanitizedMobile === '7407463884') {
              // PRESERVE MENTOR
              console.log(`[DBCleanupController] Preserving Mentor account with mobile: ${sanitizedMobile}`);
              const mentorInfo = {
                id: userId,
                mobile: sanitizedMobile,
                role: 'mentor',
                status: 'active',
                databaseId: dbId
              };
              if (!mentorAccounts.some(m => m.id === userId)) {
                mentorAccounts.push(mentorInfo);
              }

              // Ensure mentor profile document is complete and correct
              try {
                const publicRef = doc(dbInstance, 'users', userId);
                await setDoc(publicRef, {
                  name: userData.name || 'Adi Madhu',
                  role: 'mentor',
                  status: 'active',
                  photoUrl: userData.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=AdiMadhu`,
                  createdAt: userData.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }, { merge: true });

                const privateRef = doc(dbInstance, 'users_private', userId);
                await setDoc(privateRef, {
                  mobile: sanitizedMobile,
                  pin: privateData?.pin || '$2b$10$3DYWgrMHlRkwwUuYToqfFuqH92wAep3uUo4iBaLJVGpzKZeM9CkSS', // fallback
                  uid: privateData?.uid || userId,
                  email: privateData?.email || 'missionselectionofficial999@gmail.com',
                  userId: userId,
                  createdAt: privateData?.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }, { merge: true });

                const roleRef = doc(dbInstance, 'user_roles', userId);
                await setDoc(roleRef, {
                  userId: userId,
                  role: 'mentor',
                  updatedAt: new Date().toISOString()
                }, { merge: true });

                const mentorsRef = doc(dbInstance, 'mentors', userId);
                await setDoc(mentorsRef, {
                  name: userData.name || 'Adi Madhu',
                  mobile: sanitizedMobile,
                  pin: '959312',
                  role: 'mentor',
                  status: 'active'
                }, { merge: true });

              } catch (e) {
                console.error(`[DBCleanupController] Error enforcing mentor documents on ${dbId}:`, e);
              }

            } else {
              // DELETE STUDENT/EXAMINER
              console.log(`[DBCleanupController] Deleting user account ${userId} with role: ${userRole}`);
              if (userRole === 'examiner') {
                totalExaminersRemoved++;
              } else {
                totalStudentsRemoved++;
              }

              try {
                await deleteDoc(doc(dbInstance, 'users', userId));
                await deleteDoc(doc(dbInstance, 'users_private', userId));
                await deleteDoc(doc(dbInstance, 'user_roles', userId));
              } catch (e) {
                console.error(`[DBCleanupController] Failed to delete user docs for ${userId}:`, e);
              }
            }
          }

          // 2. Clear remaining user_roles that might be orphaned
          try {
            const rolesColl = collection(dbInstance, 'user_roles');
            const rolesSnap = await getDocs(rolesColl);
            for (const roleDoc of rolesSnap.docs) {
              const rId = roleDoc.id;
              if (rId !== '7407463884' && !mentorAccounts.some(m => m.id === rId)) {
                await deleteDoc(doc(dbInstance, 'user_roles', rId));
              }
            }
          } catch (e) {
            console.error(`[DBCleanupController] Error cleaning up user_roles:`, e);
          }

          // 3. Delete operational data
          // test_attempts
          try {
            const attColl = collection(dbInstance, 'test_attempts');
            const attSnap = await getDocs(attColl);
            totalTestAttemptsRemoved += attSnap.size;
            for (const attDoc of attSnap.docs) {
              await deleteDoc(doc(dbInstance, 'test_attempts', attDoc.id));
            }
          } catch (e) {
            console.error(`[DBCleanupController] Error clearing test_attempts:`, e);
          }

          // dailyMissionReports
          try {
            const dmrColl = collection(dbInstance, 'dailyMissionReports');
            const dmrSnap = await getDocs(dmrColl);
            totalSubmissionRecordsRemoved += dmrSnap.size;
            for (const dmrDoc of dmrSnap.docs) {
              await deleteDoc(doc(dbInstance, 'dailyMissionReports', dmrDoc.id));
            }
          } catch (e) {
            console.error(`[DBCleanupController] Error clearing dailyMissionReports:`, e);
          }

          // studentStats (Leaderboards, Rankings, Mission Points)
          try {
            const statsColl = collection(dbInstance, 'studentStats');
            const statsSnap = await getDocs(statsColl);
            totalLeaderboardRecordsRemoved += statsSnap.size;
            for (const statDoc of statsSnap.docs) {
              await deleteDoc(doc(dbInstance, 'studentStats', statDoc.id));
            }
          } catch (e) {
            console.error(`[DBCleanupController] Error clearing studentStats:`, e);
          }

          // otp_logs
          try {
            const otpColl = collection(dbInstance, 'otp_logs');
            const otpSnap = await getDocs(otpColl);
            for (const otpDoc of otpSnap.docs) {
              await deleteDoc(doc(dbInstance, 'otp_logs', otpDoc.id));
            }
          } catch (e) {
            console.error(`[DBCleanupController] Error clearing otp_logs:`, e);
          }

          // leaves
          try {
            const leavesColl = collection(dbInstance, 'leaves');
            const leavesSnap = await getDocs(leavesColl);
            for (const leafDoc of leavesSnap.docs) {
              await deleteDoc(doc(dbInstance, 'leaves', leafDoc.id));
            }
          } catch (e) {
            console.error(`[DBCleanupController] Error clearing leaves:`, e);
          }

          // notifications
          try {
            const notifColl = collection(dbInstance, 'notifications');
            const notifSnap = await getDocs(notifColl);
            for (const notifDoc of notifSnap.docs) {
              await deleteDoc(doc(dbInstance, 'notifications', notifDoc.id));
            }
          } catch (e) {
            console.error(`[DBCleanupController] Error clearing notifications:`, e);
          }

          // activity_logs
          try {
            const logsColl = collection(dbInstance, 'activity_logs');
            const logsSnap = await getDocs(logsColl);
            for (const logDoc of logsSnap.docs) {
              await deleteDoc(doc(dbInstance, 'activity_logs', logDoc.id));
            }
          } catch (e) {
            console.error(`[DBCleanupController] Error clearing activity_logs:`, e);
          }

        } catch (dbErr: any) {
          console.error(`[DBCleanupController] Database ${dbId} reset error:`, dbErr.message || dbErr);
        }
      }

      // If mentor account was completely missing, create it on both databases
      if (mentorAccounts.length === 0) {
        console.log("[DBCleanupController] Mentor account not found in any database. Force-creating on both databases...");
        for (const { id: dbId, dbInstance } of databases) {
          try {
            const userId = '7407463884';
            const publicRef = doc(dbInstance, 'users', userId);
            await setDoc(publicRef, {
              name: 'Adi Madhu',
              role: 'mentor',
              status: 'active',
              photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=AdiMadhu`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });

            const privateRef = doc(dbInstance, 'users_private', userId);
            await setDoc(privateRef, {
              mobile: '7407463884',
              pin: '$2b$10$3DYWgrMHlRkwwUuYToqfFuqH92wAep3uUo4iBaLJVGpzKZeM9CkSS', // placeholder
              uid: userId,
              email: 'missionselectionofficial999@gmail.com',
              userId: userId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });

            const roleRef = doc(dbInstance, 'user_roles', userId);
            await setDoc(roleRef, {
              userId: userId,
              role: 'mentor',
              updatedAt: new Date().toISOString()
            });

            const mentorsRef = doc(dbInstance, 'mentors', userId);
            await setDoc(mentorsRef, {
              name: 'Adi Madhu',
              mobile: '7407463884',
              pin: '959312',
              role: 'mentor',
              status: 'active'
            });

            mentorAccounts.push({
              id: userId,
              mobile: '7407463884',
              role: 'mentor',
              status: 'active',
              databaseId: dbId
            });
          } catch (e) {
            console.error(`[DBCleanupController] Force creation of mentor failed on ${dbId}:`, e);
          }
        }
      }

      // 4. Compile final report and save it to the server
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

      console.log("[DBCleanupController] Cleanup Report compiled:", cleanupReport);

      try {
        const response = await apiFetch('/api/admin/save-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(cleanupReport)
        });
        if (response.ok) {
          console.log("[DBCleanupController] Cleanup Report sent and saved on server successfully!");
          localStorage.setItem('__db_cleanup_completed_v2', 'true');
        } else {
          console.error("[DBCleanupController] Failed to send report to server:", await response.text());
        }
      } catch (err) {
        console.error("[DBCleanupController] Error calling save-report API:", err);
      }
    };

    runCleanup();
  }, []);

  return null;
};
