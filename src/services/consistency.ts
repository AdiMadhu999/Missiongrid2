import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { DailyMissionReport } from '../models/mission';
import { User } from '../models/user';
import { StudentStatsService } from './studentStats';

export const ConsistencyService = {
  checkAndFixDataConsistency: async () => {
    console.log("Checking data consistency...");
    
    // 1. Get all students
    const usersSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['student', 'aspirant'])));
    const students = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
    
    // 2. Get all approved reports
    const reportsSnap = await getDocs(query(collection(db, 'dailyMissionReports'), where('status', '==', 'Approved')));
    const approvedReports = reportsSnap.docs.map(d => d.data() as DailyMissionReport);
    
    const reportsByStudent: Record<string, number> = {};
    approvedReports.forEach(r => {
      reportsByStudent[r.userId] = (reportsByStudent[r.userId] || 0) + (r.marks || 0);
    });
    
    let discrepancies = 0;
    
    for (const student of students) {
      const calculatedPoints = reportsByStudent[student.id] || 0;
      const currentPoints = student.missionPoints || 0;
      
      if (calculatedPoints !== currentPoints) {
        console.log(`Discrepancy found for student ${student.id} (${student.name}): Local=${currentPoints}, Calculated=${calculatedPoints}`);
        discrepancies++;
        
        // 3. Fix using the authoritative Stats Service
        await StudentStatsService.updateStats(student.id);
        console.log(`Fixed points for ${student.id}`);
      }
    }
    
    console.log(`Data consistency check complete. Found and fixed ${discrepancies} discrepancies.`);
  }
};
