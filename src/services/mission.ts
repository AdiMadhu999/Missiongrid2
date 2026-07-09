import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  startAfter,
  serverTimestamp,
  DocumentSnapshot,
  onSnapshot,
  writeBatch,
  arrayUnion,
  deleteDoc
} from 'firebase/firestore';
import { DailyMissionReport, MissionStatus } from '../models/mission';
import { StudentUpdatesService } from './studentUpdates';
import { StudentStatsService } from './studentStats';
import { User } from '../models/user';
import { resolveUserDoc } from './users';
import { addAuditEntry } from './audit';
import { sanitizeQuestionObject } from '../utils/questionSanitizer';
import { calculatePreparationDay } from '../utils/date';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeForFirestore<T extends object>(data: T): T {
  const sanitized = { ...data };
  Object.keys(sanitized).forEach(key => {
    if ((sanitized as any)[key] === undefined) {
      delete (sanitized as any)[key];
    } else if (typeof (sanitized as any)[key] === 'object' && (sanitized as any)[key] !== null && !Array.isArray((sanitized as any)[key])) {
      (sanitized as any)[key] = sanitizeForFirestore((sanitized as any)[key]);
    }
  });
  return sanitized;
}

export interface PaginatedResult<T> {
  data: T[];
  lastVisible: DocumentSnapshot | null;
}

export const MissionService = {
  submitDailyReport: async (report: Omit<DailyMissionReport, 'id' | 'status' | 'marks' | 'submittedAt'>): Promise<void> => {
    const userSnap = await getDoc(doc(db, 'users', report.userId));
    const userData = userSnap.exists() ? userSnap.data() as any : {};
    
    // Stricter validation
    if (!userData.isPremium) {
      throw new Error("Mission submission is restricted to premium students only.");
    }
    if (!userData.batchId) {
      throw new Error("Student is not assigned to any batch.");
    }

    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    const ipAddress = ipData.ip;

    const dayKey = report.date;
    const docId = `${report.userId}_${dayKey}`;
    const path = 'dailyMissionReports';
    const reportRef = doc(db, path, docId);
    
    // Calculate Prep Day
    const registrationDate = userData.registrationDate || userData.createdAt;
    const prepDay = calculatePreparationDay(registrationDate);
    
    try {
      const snap = await getDoc(reportRef);
      if (snap.exists() && snap.data().status !== 'Rejected') {
        throw new Error(`A mission report has already been submitted for ${report.date}.`);
      }
      
      const fullReport = sanitizeForFirestore(sanitizeQuestionObject({
        ...report,
        userId: report.userId,
        userName: userData.name,
        userMobile: userData.mobile,
        batchId: userData.batchId,
        preparationDay: prepDay,
        targetDay: prepDay, // Assuming targetDay is same as prepDay as per objective
        deviceInstallationId: userData.deviceId,
        ipAddress,
        id: docId,
        dayKey,
        status: 'Pending' as MissionStatus,
        marks: 0,
        submittedAt: new Date().toISOString(),
        submissionTime: new Date().toISOString().split('T')[1],
        submissionVersion: 'v2',
        createdAt: serverTimestamp()
      } as any));
      
      await setDoc(reportRef, fullReport);

      // Reset consecutive missed missions and save last submission date
      try {
        await updateDoc(doc(db, 'users', report.userId), {
          consecutiveMissedMissions: 0,
          consecutiveMissedDays: 0,
          lastMissionSubmissionDate: report.date,
          lastSubmissionDate: report.date,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to update student consecutive missed missions on daily report:", err);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${docId}`);
    }
  },

  submitSectionReport: async (
    userId: string,
    userName: string | null,
    userMobile: string | null,
    userPhoto: string | null,
    batchId: string | null,
    date: string,
    sectionId: string,
    sectionNotes: string,
    sectionAttachments: { url: string; type: 'image' | 'pdf'; name: string; path: string }[]
  ): Promise<void> => {
    const userSnap = await getDoc(doc(db, 'users', userId));
    const userData = userSnap.exists() ? userSnap.data() as any : {};
    if (!userData.isPremium) {
      throw new Error("Mission submission is restricted to premium students only.");
    }

    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    const ipAddress = ipData.ip;

    const dayKey = date;
    const docId = `${userId}_${dayKey}`;
    const path = 'dailyMissionReports';
    const reportRef = doc(db, path, docId);

    try {
      const snap = await getDoc(reportRef);
      let existingReport = snap.exists() ? (snap.data() as DailyMissionReport) : null;

      // Prepare default sections template
      const defaultSections: Record<string, any> = {
        section1: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 20, attachments: [], notes: '' },
        section2: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 10, attachments: [], notes: '' },
        section3: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 20, attachments: [], notes: '' },
        section4: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 10, attachments: [], notes: '' },
        section5: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 20, attachments: [], notes: '' },
        section6: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 20, attachments: [], notes: '' },
      };

      let sections = existingReport?.sections || defaultSections;

      // Update specific section
      sections[sectionId] = {
        ...sections[sectionId],
        submitted: true,
        submittedAt: new Date().toISOString(),
        status: 'Pending',
        notes: sectionNotes || '',
        attachments: sectionAttachments || []
      };

      // Combine attachments for backward compatibility
      let allAttachments: any[] = [];
      Object.keys(sections).forEach(k => {
        if (sections[k].attachments && sections[k].attachments.length > 0) {
          allAttachments = [...allAttachments, ...sections[k].attachments];
        }
      });
      if (existingReport?.attachments) {
        existingReport.attachments.forEach(at => {
          if (!allAttachments.some(x => x.url === at.url)) {
            allAttachments.push(at);
          }
        });
      }

      // Also sum up marks of APPROVED sections
      let approvedMarksSum = 0;
      Object.values(sections).forEach((sec: any) => {
        if (sec.status === 'Approved') {
          approvedMarksSum += sec.marks || 0;
        }
      });

      const updatedReport = sanitizeForFirestore(sanitizeQuestionObject({
        id: docId,
        userId,
        userName: userName || userData.name,
        userMobile: userMobile || userData.mobile,
        userPhoto,
        batchId: batchId || userData.batchId,
        ipAddress,
        date,
        dayKey,
        note: existingReport?.note || 'Section-based mission submission',
        attachments: allAttachments,
        status: (existingReport?.status === 'Approved' || existingReport?.status === 'Rejected') ? existingReport.status : 'Pending' as MissionStatus, // Any active pending submission puts report back to pending
        marks: approvedMarksSum, // overall marks is sum of approved sections!
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submissionVersion: 'v2',
        sections,
        stateChangeHistory: existingReport?.stateChangeHistory || []
      }));

      await setDoc(reportRef, updatedReport, { merge: true });
      
      // Reset consecutive missed missions and save last submission date
      try {
        await updateDoc(doc(db, 'users', userId), {
          consecutiveMissedMissions: 0,
          consecutiveMissedDays: 0,
          lastMissionSubmissionDate: date,
          lastSubmissionDate: date,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to update student consecutive missed missions on section report:", err);
      }
      
      // Recollect user stats to sync total points
      await StudentStatsService.updateStats(userId, updatedReport as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${docId}`);
    }
  },

  reviewSectionsReport: async (
    reportId: string,
    reviewedBy: string,
    sectionReviews: Record<string, { status: 'Approved' | 'Rejected' | 'Needs Improvement'; marks: number; remarks: string }>,
    cachedReport?: DailyMissionReport
  ): Promise<void> => {
    const reportRef = doc(db, 'dailyMissionReports', reportId);
    try {
      let report: DailyMissionReport;
      if (cachedReport) {
        report = cachedReport;
      } else {
        const snap = await getDoc(reportRef);
        if (!snap.exists()) throw new Error('Report not found');
        report = snap.data() as DailyMissionReport;
      }

      // Create a deep copy of sections to avoid mutation issues
      const sections = JSON.parse(JSON.stringify(report.sections || {}));
      
      const defaultSections: Record<string, any> = {
        section1: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 20, attachments: [], notes: '' },
        section2: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 10, attachments: [], notes: '' },
        section3: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 20, attachments: [], notes: '' },
        section4: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 10, attachments: [], notes: '' },
        section5: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 20, attachments: [], notes: '' },
        section6: { submitted: false, status: 'Not Submitted', marks: 0, maxMarks: 20, attachments: [], notes: '' },
      };
      
      // Ensure all sections exist in the copy
      Object.keys(defaultSections).forEach(key => {
        if (!sections[key]) {
          sections[key] = { ...defaultSections[key] };
        }
      });

      // Update the sections with new review data
      Object.keys(sectionReviews).forEach(secId => {
        if (sections[secId]) {
          sections[secId].status = sectionReviews[secId].status;
          sections[secId].marks = Number(sectionReviews[secId].marks) || 0;
          sections[secId].remarks = sectionReviews[secId].remarks || '';
          // If a mentor explicitly reviews a section, we consider it handled (effectively submitted for grading)
          sections[secId].submitted = true;
        }
      });

      // Recalculate marks and overall status
      let totalApprovedMarks = 0;
      let hasPending = false;
      let reviewStatuses: string[] = [];

      Object.keys(sections).forEach(secId => {
        const sec = sections[secId];
        if (sec.submitted) {
          reviewStatuses.push(sec.status);
          if (sec.status === 'Approved') {
            totalApprovedMarks += Number(sec.marks) || 0;
          }
          if (sec.status === 'Pending') {
            hasPending = true;
          }
        }
      });

      // Overall status determination
      let overallStatus: MissionStatus = 'Pending';
      if (!hasPending && reviewStatuses.length > 0) {
         if (reviewStatuses.every(s => s === 'Approved')) {
           overallStatus = 'Approved';
         } else if (reviewStatuses.includes('Resubmit Required') || reviewStatuses.includes('Needs Improvement')) {
           overallStatus = 'Resubmit Required';
         } else if (reviewStatuses.includes('Rejected')) {
           overallStatus = 'Rejected';
         } else if (reviewStatuses.includes('Approved')) {
           overallStatus = 'Approved'; 
         }
      }

      const updatedReport = sanitizeQuestionObject({
        ...report,
        id: reportId,
        sections,
        marks: totalApprovedMarks,
        status: overallStatus,
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), // Ensure updatedAt triggers listeners
        stateChangeHistory: [
          ...(report.stateChangeHistory || []),
          {
            status: overallStatus,
            changedAt: new Date().toISOString(),
            changedBy: reviewedBy
          }
        ]
      });

      console.log('Updating report status to:', overallStatus, 'for report:', reportId);
      await setDoc(reportRef, sanitizeForFirestore(updatedReport));
 
      // 1. Overall Status Update
      const updates: Promise<any>[] = [];
      if (overallStatus === 'Approved') {
        updates.push(StudentUpdatesService.createUpdate({
          studentId: report.userId || (report as any).studentId,
          type: 'target_approved',
          title: '✅ Target Approved',
          description: `Your entire mission target for ${report.date} has been approved!`,
          remark: `Excellence achieved (Score: ${totalApprovedMarks}/100)`
        }));
      } else if (overallStatus === 'Rejected' || overallStatus === 'Resubmit Required') {
         updates.push(StudentUpdatesService.createUpdate({
          studentId: report.userId || (report as any).studentId,
          type: 'target_rejected',
          title: overallStatus === 'Rejected' ? '❌ Target Rejected' : '🚨 Resubmit Required',
          description: `Your mission target for ${report.date} has been marked as "${overallStatus}".`,
          remark: `Please check mentor feedback for required corrections.`
        }));
      }
      
      // General review notification
      updates.push(StudentUpdatesService.createUpdate({
        studentId: report.userId || (report as any).studentId,
        type: 'submission_reviewed',
        title: '📝 Mission Reviewed',
        description: `Your daily mission report for ${report.date} has been reviewed by your mentor. Overall Status: ${overallStatus}.`,
        remark: `Total Marks: ${totalApprovedMarks}/100`
      }));
      
      try {
        await Promise.all(updates);
      } catch (err) {
        console.error('Error logging overall student update:', err);
      }

      // Student updates logs for each reviewed section
      const batchPromises = Object.keys(sectionReviews).map(async (secId) => {
        const rev = sectionReviews[secId];
        let title = '';

        if (secId === 'section1') title = 'To Do List';
        else if (secId === 'section2') title = 'Rough Sheets';
        else if (secId === 'section3') title = 'Active Learning';
        else if (secId === 'section4') title = 'Revision / Backlog';
        else if (secId === 'section5') title = 'Study Time';
        else if (secId === 'section6') title = 'Error Register';

        try {
          if (rev.status === 'Approved') {
            await StudentUpdatesService.createUpdate({
              studentId: report.userId,
              type: 'target_approved',
              title: `✅ ${title} Approved`,
              description: `Your ${title} section has been approved. Score: ${rev.marks}/${sections[secId].maxMarks} marks.`,
              remark: rev.remarks || undefined
            });
          } else if (rev.status === 'Rejected') {
            await StudentUpdatesService.createUpdate({
              studentId: report.userId,
              type: 'target_rejected',
              title: `❌ ${title} Rejected`,
              description: `Your ${title} section was rejected by your mentor.`,
              remark: rev.remarks || undefined
            });
          } else if (rev.status === 'Needs Improvement') {
            await StudentUpdatesService.createUpdate({
              studentId: report.userId,
              type: 'submission_reviewed',
              title: `⚠️ ${title} Needs Improvement`,
              description: `Your mentor left feedback that your ${title} section needs improvement.`,
              remark: rev.remarks || undefined
            });
          }
        } catch (e) {
          console.error('Error logging section review updates:', e);
        }
      });

      await Promise.all(batchPromises);

      // Trigger stats recalculation
      await StudentStatsService.updateStats(report.userId, updatedReport as any);

      // Audit log entry
      await addAuditEntry({
        eventType: 'approval',
        userId: report.userId,
        userName: report.userName || 'Unknown',
        role: 'mentor',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toISOString().split('T')[1],
        action: `Section-by-section mission evaluated. Final status: ${overallStatus}, Marks: ${totalApprovedMarks}`,
        status: 'success'
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dailyMissionReports/${reportId}`);
    }
  },

  subscribeDailyReport: (
    userId: string, 
    date: string,
    callback: (report: DailyMissionReport | null) => void,
    onError: (error: any) => void
  ) => {
    const docId = `${userId}_${date}`;
    return onSnapshot(doc(db, 'dailyMissionReports', docId), (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as DailyMissionReport);
      } else {
        callback(null);
      }
    }, (err) => {
      console.error("Error subscribing to daily report:", err);
      onError(err);
    });
  },

  subscribeStudentReports: (
    userId: string,
    callback: (reports: DailyMissionReport[]) => void,
    onError?: (error: any) => void,
    limitCount: number = 30
  ) => {
    const path = 'dailyMissionReports';
    const q = query(
      collection(db, path),
      where('userId', '==', userId),
      limit(limitCount * 2)
    );
    return onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyMissionReport));
      const sorted = results.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limitCount);
      callback(sorted);
    }, (err) => {
      console.error("Error subscribing to student reports:", err);
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    });
  },

  getDailyReport: async (userId: string, date: string): Promise<DailyMissionReport | null> => {
    const docId = `${userId}_${date}`;
    const path = `dailyMissionReports/${docId}`;
    try {
      const snap = await getDoc(doc(db, 'dailyMissionReports', docId));
      return snap.exists() ? (snap.data() as DailyMissionReport) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  getStudentReports: async (userId: string, limitCount: number = 30): Promise<DailyMissionReport[]> => {
    const path = 'dailyMissionReports';
    try {
      const q = query(
        collection(db, path),
        where('userId', '==', userId),
        limit(limitCount * 2) 
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyMissionReport));
      return results.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limitCount);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  getPendingReportsByBatch: async (
    batchId: string, 
    lastVisible: DocumentSnapshot | null = null,
    pageSize: number = 50
  ): Promise<PaginatedResult<DailyMissionReport>> => {
    const path = 'dailyMissionReports';
    try {
      // Include 'Submitted' as well to avoid them getting stuck
      let q = query(
        collection(db, path),
        where('status', 'in', ['Pending', 'Submitted'])
      );

      const isGlobal = !batchId || batchId.toLowerCase() === 'all';
      if (!isGlobal) {
        q = query(q, where('batchId', '==', batchId));
      }

      q = query(q, orderBy('submittedAt', 'desc'));
      q = query(q, limit(pageSize));

      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snap = await getDocs(q);
      
      return {
        data: snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as DailyMissionReport)),
        lastVisible: snap.docs[snap.docs.length - 1] || null
      };
    } catch (error: any) {
      if (error?.message?.includes('index')) {
        console.warn('Mission Review Index Missing. Falling back to non-ordered fetch.');
        const q = query(collection(db, path), where('status', 'in', ['Pending', 'Submitted']), limit(pageSize));
        const snap = await getDocs(q);
        const reports = snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as DailyMissionReport));
        reports.sort((a, b) => {
          const tA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const tB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return tB - tA;
        });
        return {
          data: reports,
          lastVisible: null 
        };
      }
      handleFirestoreError(error, OperationType.LIST, path);
      return { data: [], lastVisible: null };
    }
  },

  searchReports: async (searchTerm: string, field: 'userMobile' | 'userName'): Promise<DailyMissionReport[]> => {
    const path = 'dailyMissionReports';
    try {
      const q = query(
        collection(db, path),
        where(field, '>=', searchTerm),
        where(field, '<=', searchTerm + '\uf8ff'),
        limit(20)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as DailyMissionReport));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  submitManualReport: async (report: Omit<DailyMissionReport, 'id' | 'status' | 'submittedAt'>, marks: number, mentorId: string): Promise<void> => {
    // Check for existing report for this day to avoid duplicates
    const q = query(
        collection(db, 'dailyMissionReports'),
        where('userId', '==', report.userId),
        where('date', '==', report.date)
    );
    const snap = await getDocs(q);
    
    let docId;
    if (!snap.empty) {
        docId = snap.docs[0].id;
    } else {
        docId = `${report.userId}_${report.date}`;
    }

    const reportRef = doc(db, 'dailyMissionReports', docId);
    
    const freshReport = {
      ...report,
      id: docId,
      status: 'Approved',
      marks: marks,
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: mentorId
    };

    await setDoc(reportRef, {
      ...freshReport,
      createdAt: serverTimestamp()
    });

    await StudentStatsService.updateStats(report.userId, freshReport as any);
  },

  reviewReport: async (reportId: string, review: { 
    status: MissionStatus; 
    marks: number; 
    remarks: string; 
    reviewedBy: string;
  }): Promise<void> => {
    const reportPath = `dailyMissionReports/${reportId}`;
    try {
      const reportRef = doc(db, 'dailyMissionReports', reportId);
      const snap = await getDoc(reportRef);
      if (!snap.exists()) throw new Error('Report not found');
      
      const report = snap.data() as DailyMissionReport;
      
      const batch = writeBatch(db);
      
      // 1. Update report + history
      const sanitizedReview = sanitizeQuestionObject(review);
      batch.update(reportRef, {
        status: sanitizedReview.status,
        marks: sanitizedReview.marks,
        remarks: sanitizedReview.remarks,
        reviewedBy: sanitizedReview.reviewedBy,
        reviewedAt: new Date().toISOString(),
        stateChangeHistory: arrayUnion({
            status: sanitizedReview.status,
            changedAt: new Date().toISOString(),
            changedBy: sanitizedReview.reviewedBy
        })
      });
      
      // Commit batch first
      await batch.commit();

      try {
        if (sanitizedReview.status === 'Approved') {
          await StudentUpdatesService.createUpdate({
            studentId: report.userId,
            type: 'target_approved',
            title: '✅ Target Approved',
            description: `Your daily target submission for ${report.date} has been evaluated & approved.`,
            remark: sanitizedReview.remarks || undefined
          });
        } else {
          await StudentUpdatesService.createUpdate({
            studentId: report.userId,
            type: 'target_rejected',
            title: '❌ Target Rejected',
            description: `Your daily target submission for ${report.date} was marked as "${sanitizedReview.status}".`,
            remark: sanitizedReview.remarks || undefined
          });
        }

        await StudentUpdatesService.createUpdate({
          studentId: report.userId,
          type: 'submission_reviewed',
          title: '📝 Submission Reviewed',
          description: `Your daily mission report for ${report.date} has been reviewed by your mentor.`,
          remark: sanitizedReview.remarks || undefined
        });

        if (sanitizedReview.remarks) {
          await StudentUpdatesService.createUpdate({
            studentId: report.userId,
            type: 'feedback_added',
            title: '💬 Mentor Feedback Added',
            description: `A mentor left feedback remarks on your daily report of ${report.date}.`,
            remark: sanitizedReview.remarks
          });
        }
      } catch (err) {
        console.error('Error logging student updates in reviewReport:', err);
      }

      const updatedReport = sanitizeQuestionObject({
        ...report,
        id: reportId,
        status: sanitizedReview.status,
        marks: sanitizedReview.marks,
        remarks: sanitizedReview.remarks,
        reviewedBy: sanitizedReview.reviewedBy,
        reviewedAt: new Date().toISOString(),
        stateChangeHistory: [
            ...(report.stateChangeHistory || []),
            {
                status: sanitizedReview.status,
                changedAt: new Date().toISOString(),
                changedBy: sanitizedReview.reviewedBy
            }
        ]
      });

      // 2. Add Audit Entry
      await addAuditEntry({
        eventType: 'approval', // Should be dynamic based on status, but let's keep it simple for now
        userId: report.userId,
        userName: report.userName || 'Unknown',
        role: 'mentor',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toISOString().split('T')[1],
        action: `Mission status changed to ${review.status}`,
        status: 'success',
        remarks: review.remarks
      });

      // 3. Trigger stats recalculation
      await StudentStatsService.updateStats(report.userId, updatedReport);

    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, reportPath);
    }
  },

  submitMissionFeedback: async (
    reportId: string,
    feedback: string
  ): Promise<void> => {
    const reportRef = doc(db, 'dailyMissionReports', reportId);
    try {
      await updateDoc(reportRef, {
        studentFeedback: feedback,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dailyMissionReports/${reportId}`);
    }
  },

  deleteReport: async (reportId: string, deletedByUserId: string): Promise<void> => {
    const reportRef = doc(db, 'dailyMissionReports', reportId);
    try {
      const snap = await getDoc(reportRef);
      if (!snap.exists()) {
        console.warn('Report already deleted or not found:', reportId);
        return;
      }
      const report = snap.data() as DailyMissionReport;
      
      await deleteDoc(reportRef);
      
      // Recollect user stats to sync total points/status
      await StudentStatsService.updateStats(report.userId);

      // Audit log entry
      await addAuditEntry({
        eventType: 'backup',
        userId: report.userId,
        userName: report.userName || 'Unknown',
        role: 'mentor',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toISOString().split('T')[1],
        action: `Mission submission for date ${report.date} deleted by mentor.`,
        status: 'success'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `dailyMissionReports/${reportId}`);
    }
  }
};
