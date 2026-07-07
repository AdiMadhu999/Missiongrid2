import { doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, limit } from 'firebase/firestore';
import { db } from './firebase';
import { StudentStats } from '../models/studentStats';
import { User } from '../models/user';
import { DailyMissionReport } from '../models/mission';
import { getSystemSettings } from './system';

export const StudentStatsService = {
  updateStats: async (studentId: string, updatedReport?: DailyMissionReport): Promise<void> => {
    // 1. Resolve studentId (Auth UID) to actual document ID if needed
    let studentDocId = studentId;
    const privSnap = await getDocs(query(collection(db, 'users_private'), where('uid', '==', studentId), limit(1)));
    if (!privSnap.empty) {
      studentDocId = privSnap.docs[0].id;
    }

    const userRef = doc(db, 'users', studentDocId);
    
    // 2. Fetch User & settings first to form robust studentIds list
    const [userSnap, systemSettings] = await Promise.all([
      getDoc(userRef),
      getSystemSettings()
    ]);

    if (!userSnap.exists()) {
        console.error("StudentStatsService: Student not found", studentDocId);
        throw new Error('Student not found');
    }
    const user = userSnap.data() as User;
    const studentIds = Array.from(new Set([studentDocId, user.uid, (user as any).studentCode, user.id])).filter(Boolean) as string[];

    // Fetch remaining dependent details
    const [reportsSnap, testsSnap, warningsSnap] = await Promise.all([
      getDocs(query(collection(db, 'dailyMissionReports'), where('userId', 'in', studentIds), limit(1000))),
      getDocs(query(collection(db, 'test_attempts'), where('userId', 'in', studentIds), limit(1000))),
      getDocs(query(collection(db, 'warnings'), where('studentId', 'in', studentIds), limit(1000)))
    ]);

    // 3. Perform calculations
    const reportsMap = new Map<string, DailyMissionReport>();
    
    // Add all fetched reports
    reportsSnap.docs.forEach(d => {
        const data = d.data() as DailyMissionReport;
        // Keep only one report per date
        const existing = reportsMap.get(`${data.date}`);
        if (!existing || (new Date(data.submittedAt || 0).getTime() > new Date(existing.submittedAt || 0).getTime())) {
            reportsMap.set(`${data.date}`, {id: d.id, ...data} as DailyMissionReport);
        }
    });
    
    // Add or overwrite with updated report
    if (updatedReport) {
      reportsMap.set(`${updatedReport.date}`, updatedReport);
    }
    
    const reports = Array.from(reportsMap.values());
    
    // Calculate total points and counts with backwards compatibility for section-based reports
    let totalPoints = 0;
    let approvedCount = 0;
    let pendingCount = 0;

    reports.forEach(r => {
      if (r.sections) {
        let hasApprovedSec = false;
        let hasPendingSec = false;
        let reportApprovedMarksSum = 0;

        Object.values(r.sections).forEach((sec: any) => {
          if (sec.status === 'Approved') {
            reportApprovedMarksSum += sec.marks || 0;
            hasApprovedSec = true;
          } else if (sec.status === 'Pending') {
            hasPendingSec = true;
          }
        });

        totalPoints += reportApprovedMarksSum;
        if (hasApprovedSec) approvedCount++;
        if (hasPendingSec) pendingCount++;
      } else {
        if (r.status === 'Approved') {
          totalPoints += r.marks || 0;
          approvedCount++;
        } else if (r.status === 'Pending') {
          pendingCount++;
        }
      }
    });
    
    console.log(`StudentStatsService: Calc totals for ${studentDocId}. Reports: ${reports.length}, Points: ${totalPoints}`);

    const reviewCategory: 'Elite' | 'Stable' | 'Watchlist' | 'Critical' = 'Stable';
    const eliteStatus = 'Base';

    const newStats: StudentStats = {
      studentId: studentDocId,
      accountabilityScore: 0,
      missionPoints: totalPoints,
      totalPoints: totalPoints,
      currentRank: 1,
      tenDayPerformance: 0,
      tenDayProgress: 0,
      streak: user.currentStreak || 0,
      attendance: 0,
      reviewCategory: reviewCategory,
      eliteStatus: eliteStatus,
      missionsApproved: approvedCount,
      missionsPending: pendingCount,
      testsCompleted: testsSnap.docs.length,
      averageTestScore: 0,
      warningCount: warningsSnap.docs.length,
      lastSubmission: new Date().toISOString(),
      status: user.status || 'active',
      updatedAt: new Date().toISOString()
    };

    // --- STUDENT METRICS AGGREGATION ---
    const completedAttempts = testsSnap.docs
      .filter(d => ['submitted', 'evaluated'].includes(d.data().status))
      .map(d => d.data());
    
    const totalPercentage = completedAttempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
    const averageScore = completedAttempts.length > 0 ? (totalPercentage / completedAttempts.length) : 0;

    // Fetch total tests in batch dynamically
    let totalTestsCount = 0;
    if (user.batchId) {
      try {
        const testsQuery = query(
          collection(db, 'tests'),
          where('batchIds', 'array-contains', user.batchId)
        );
        const activeTestsSnap = await getDocs(testsQuery);
        totalTestsCount = activeTestsSnap.docs.length;

        if (totalTestsCount === 0) {
          const legacyQuery = query(
            collection(db, 'tests'),
            where('batchId', '==', user.batchId)
          );
          const legacyTestsSnap = await getDocs(legacyQuery);
          totalTestsCount = legacyTestsSnap.docs.length;
        }
      } catch (e) {
        console.error("Error calculating batch tests for metrics:", e);
      }
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let weeklyScore = 0;
    let monthlyScore = 0;
    let submissionCount = 0;
    let approvedCountForMetrics = 0;

    reports.forEach(r => {
      let reportMarks = 0;
      let isApproved = false;
      let isPending = false;
      
      if (r.sections) {
        Object.values(r.sections).forEach((sec: any) => {
          if (sec.status === 'Approved') {
            reportMarks += sec.marks || 0;
            isApproved = true;
          } else if (sec.status === 'Pending') {
            isPending = true;
          }
        });
      } else {
        if (r.status === 'Approved') {
          reportMarks += r.marks || 0;
          isApproved = true;
        } else if (r.status === 'Pending') {
          isPending = true;
        }
      }
      
      if (isApproved || isPending || r.status === 'Absent' || r.status === 'Rejected') {
        submissionCount++;
      }
      if (isApproved) {
        approvedCountForMetrics++;
      }
      
      const subDate = r.submittedAt ? new Date(r.submittedAt) : (r.date ? new Date(r.date) : null);
      if (subDate) {
        if (subDate >= sevenDaysAgo) {
          weeklyScore += reportMarks;
        }
        if (subDate >= thirtyDaysAgo) {
          monthlyScore += reportMarks;
        }
      }
    });

    const attendanceRate = reports.length > 0 ? Math.round((approvedCountForMetrics / reports.length) * 100) : 100;
    const finalTotalTests = totalTestsCount || completedAttempts.length || 1;
    const completionPercentage = Math.round((completedAttempts.length / finalTotalTests) * 100);

    const metricsPayload = {
      userId: studentDocId,
      uid: user.uid || studentDocId,
      totalTests: totalTestsCount || completedAttempts.length,
      completedTests: completedAttempts.length,
      averageScore: Math.round(averageScore * 10) / 10,
      totalMissionPoints: totalPoints,
      submissionCount: submissionCount,
      leaderboardPoints: totalPoints,
      weeklyScore: weeklyScore,
      monthlyScore: monthlyScore,
      attendanceRate: attendanceRate,
      completionPercentage: completionPercentage,
      currentRank: user.currentRank || 1,
      streak: user.currentStreak || 0,
      lastUpdated: new Date().toISOString()
    };

    console.log(`StudentStatsService: Aggregated metrics for user ${studentDocId}:`, metricsPayload);

    // 3. Update master stats and sync to User (for UI compatibility)
    const batch = writeBatch(db);
    
    const statsRef = doc(db, 'studentStats', studentDocId);
    batch.set(statsRef, newStats, { merge: true });

    const metricsRef = doc(db, 'student_metrics', studentDocId);
    batch.set(metricsRef, metricsPayload, { merge: true });
    
    const userUpdatePayload = {
        missionPoints: newStats.missionPoints,
        consistencyIndex: 100,
        category: eliteStatus,
        longestStreak: Math.max(user.longestStreak || 0, user.currentStreak || 0),
        totalActiveDaysCount: approvedCount,
        updatedAt: serverTimestamp()
    };

    console.log(`StudentStatsService: Updating user ${studentDocId} with payload:`, userUpdatePayload);
    
    console.log(`StudentStatsService: [DEBUG] Prepare payload for ${studentDocId}:`, userUpdatePayload);
    
    batch.set(userRef, userUpdatePayload, { merge: true });
    
    try {
        await batch.commit();
        console.log(`StudentStatsService: [DEBUG] Batch committed`);
        
        // Immediate readback
        const updatedUserSnap = await getDoc(userRef);
        if (updatedUserSnap.exists()) {
            const updatedUser = updatedUserSnap.data() as User;
            console.log(`StudentStatsService: [DEBUG] Readback value for ${studentDocId}:`, updatedUser.missionPoints);
            if ((updatedUser.missionPoints || 0) !== newStats.missionPoints) {
                console.error(`StudentStatsService: PERSISTENCE MISMATCH!`, { 
                    expected: newStats.missionPoints, 
                    actuallyStored: updatedUser.missionPoints ,
                    fullDocument: updatedUser
                });
            } else {
                console.log(`StudentStatsService: PERSISTENCE SUCCESS!`);
            }
        }

    } catch (error) {
        console.error(`StudentStatsService: Batch commit failed`, error);
        throw error;
    }
  }

};
