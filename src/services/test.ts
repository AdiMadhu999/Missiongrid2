import { db, storage } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, addDoc, orderBy, writeBatch } from 'firebase/firestore';
import { auth } from './firebase';
import { resolveUserDoc } from './users';

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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Test, TestAttempt, Answer } from '../models/mission';
import { StudentStatsService } from './studentStats';
import { StudentUpdatesService } from './studentUpdates';
import { sanitizeQuestionObject } from '../utils/questionSanitizer';

// Caching for fast retrievals
let userRolesVerifiedSession = false;
const userDocDataCache = new Map<string, any>();

export const TestService = {
  createTest: async (testData: Omit<Test, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const sanitized = sanitizeQuestionObject(testData);
    const docRef = await addDoc(collection(db, 'tests'), JSON.parse(JSON.stringify({
      ...sanitized,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })));
    return docRef.id;
  },

  updateTest: async (id: string, testData: Partial<Test>): Promise<void> => {
    // Prevent publishing tests with no questions
    if (testData.status === 'published') {
      const existingTest = await TestService.getTest(id);
      const questions = testData.questions || existingTest.questions || [];
      if (questions.length < 1) {
        throw new Error("Cannot publish a test with fewer than 1 question.");
      }
    }

    const docRef = doc(db, 'tests', id);
    const sanitized = sanitizeQuestionObject(testData);
    const dataToUpdate = { ...sanitized, updatedAt: new Date().toISOString() };
    // Remove undefined values to avoid Firestore errors
    Object.keys(dataToUpdate).forEach(key => (dataToUpdate as any)[key] === undefined && delete (dataToUpdate as any)[key]);
    await updateDoc(docRef, dataToUpdate);
  },

  deleteTest: async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'tests', id), { status: 'archived', updatedAt: new Date().toISOString() });
  },

  createPracticeTest: async (originalTest: Test, incorrectQuestions: any[], userId: string): Promise<string> => {
    const practiceTest: Partial<Test> = {
      title: `Practice: ${originalTest.title} (Revision)`,
      description: `Revision test containing incorrect questions from your previous attempt at "${originalTest.title}".`,
      questions: incorrectQuestions,
      maximumMarks: incorrectQuestions.reduce((acc, q) => acc + (q.points || 2), 0),
      duration: Math.max(5, Math.ceil(incorrectQuestions.length * 1.5)), // 1.5 mins per question, min 5 mins
      status: 'published',
      category: originalTest.category,
      subject: originalTest.subject,
      testType: 'free',
      accessLevel: 'private',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      isPractice: true
    };
    
    const docRef = await addDoc(collection(db, 'tests'), practiceTest);
    return docRef.id;
  },

  getTest: async (id: string): Promise<Test> => {
    const snap = await getDoc(doc(db, 'tests', id));
    if (!snap.exists()) throw new Error('Test not found');
    const data = snap.data() as any;
    return sanitizeQuestionObject({ id: snap.id, ...data, testType: data.testType || 'free' } as Test);
  },

  getTestsForMentor: async (uid: string): Promise<Test[]> => {
    const q = query(
      collection(db, 'tests'),
      where('status', '!=', 'archived'),
      orderBy('status'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data() as any;
      return { id: doc.id, ...data, testType: data.testType || 'free' } as Test;
    });
  },

  getTestsForStudent: async (studentId: string): Promise<Test[]> => {
    console.log(`[TestService DEBUG] getTestsForStudent called with studentId: ${studentId}`);
    if (!studentId) {
      console.warn('[TestService DEBUG] getTestsForStudent called with empty studentId');
      return [];
    }
    
    // Resolve the user to get the true document ID in the 'users' collection
    const { userId, publicRef } = await resolveUserDoc(studentId);
    console.log(`[TestService DEBUG] Resolved studentId '${studentId}' to userId: '${userId}'`);
    
    // Check and backfill user_roles mapping only once per session to avoid expensive polling on every list load
    if (!userRolesVerifiedSession) {
      const waitMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      let authRetries = 15; // Optimize wait times
      while (!auth.currentUser && authRetries > 0) {
        await waitMs(100);
        authRetries--;
      }
      
      if (auth.currentUser) {
        const currentUid = auth.currentUser.uid;
        console.log(`[TestService DEBUG] Current Firebase UID is: ${currentUid}`);
        
        let rolesExist = false;
        let rolesRetries = 10; // Reduce maximum retries to avoid hogging DB connection
        while (rolesRetries > 0) {
          try {
            const roleRef = doc(db, 'user_roles', currentUid);
            const roleSnap = await getDoc(roleRef);
            if (roleSnap.exists()) {
              rolesExist = true;
              console.log(`[TestService DEBUG] Verified user_roles mapping exists for UID: ${currentUid}`);
              break;
            }
          } catch (e) {
            console.warn(`[TestService DEBUG] Error checking user_roles for ${currentUid}:`, e);
          }
          await waitMs(100);
          rolesRetries--;
        }
        
        if (!rolesExist) {
          console.log(`[TestService DEBUG] user_roles mapping not found after waiting. Backfilling it now to ensure immediate query compatibility.`);
          try {
            const roleRef = doc(db, 'user_roles', currentUid);
            const userSnap = await getDoc(publicRef);
            const roleToSet = userSnap.exists() ? (userSnap.data() as any).role || 'student' : 'student';
            const batchToSet = userSnap.exists() ? (userSnap.data() as any).batchId || '' : '';
            
            await setDoc(roleRef, {
              userId: userId,
              role: roleToSet,
              batchId: batchToSet,
              updatedAt: new Date().toISOString()
            });
            console.log(`[TestService DEBUG] Successfully self-backfilled user_roles mapping for UID: ${currentUid}`);
          } catch (err) {
            console.error(`[TestService DEBUG] Failed to self-backfill user_roles:`, err);
          }
        }
        userRolesVerifiedSession = true;
      } else {
        console.warn(`[TestService DEBUG] Auth currentUser is still null after waiting.`);
      }
    }
    
    // Use cached user document details if available to bypass extra fetch
    let userData = userDocDataCache.get(userId);
    if (!userData) {
      const userSnap = await getDoc(publicRef);
      userData = userSnap.exists() ? userSnap.data() as any : {};
      userDocDataCache.set(userId, userData);
    }
    
    const userBatchId = userData.batchId || '';
    console.log(`[TestService DEBUG] Student details: Name: ${userData.name}, BatchId: ${userBatchId}`);

    const testMap = new Map<string, Test>();
    const promises: Promise<any>[] = [];

    // Query 1: Active tests matching user's batch via multi-batch array
    if (userBatchId) {
      const qBatch = query(
        collection(db, 'tests'),
        where('batchIds', 'array-contains', userBatchId)
      );
      promises.push(
        getDocs(qBatch).then(snap => {
          snap.docs.forEach(doc => {
            const data = doc.data() as any;
            testMap.set(doc.id, { id: doc.id, ...data, testType: data.testType || 'free' } as Test);
          });
        }).catch(err => {
          console.error("[TestService DEBUG] Query 1 (batchIds array-contains) failed:", err);
        })
      );

      // Query 2: Active tests matching user's batch via legacy single batchId (for backward compatibility)
      const qLegacy = query(
        collection(db, 'tests'),
        where('batchId', '==', userBatchId)
      );
      promises.push(
        getDocs(qLegacy).then(snap => {
          snap.docs.forEach(doc => {
            const data = doc.data() as any;
            testMap.set(doc.id, { id: doc.id, ...data, testType: data.testType || 'free' } as Test);
          });
        }).catch(err => {
          console.error("[TestService DEBUG] Query 2 (batchId legacy match) failed:", err);
        })
      );
    }

    // Query 3: Revision/practice tests created by the student (check both userId and studentId formats)
    const practiceIds = [userId];
    if (studentId && studentId !== userId) {
      practiceIds.push(studentId);
    }
    for (const pid of practiceIds) {
      const qPractice = query(
        collection(db, 'tests'),
        where('isPractice', '==', true),
        where('createdBy', '==', pid)
      );
      promises.push(
        getDocs(qPractice).then(snap => {
          snap.docs.forEach(doc => {
            const data = doc.data() as any;
            testMap.set(doc.id, { id: doc.id, ...data, testType: data.testType || 'free' } as Test);
          });
        }).catch(err => {
          console.error("[TestService DEBUG] Query 3 (practice tests) failed for ID " + pid + ":", err);
        })
      );
    }

    // Run all queries in parallel, tolerating individual query failures
    await Promise.all(promises);

    const all = Array.from(testMap.values());

    // Final client-side verification to ensure no batch leakages
    const filtered = all.filter(t => {
      if (t.isPractice) {
        return t.createdBy === userId || t.createdBy === studentId;
      }
      
      // Filter status on the client side to avoid needing compound Firestore indexes
      const allowedStatuses = ['published', 'live', 'completed', 'scheduled'];
      if (!allowedStatuses.includes(t.status || '')) {
        return false;
      }

      if (t.visibility === 'individual') {
        return t.studentId === userId || t.studentId === studentId;
      }
      // Every standard test must strictly belong to the student's batch (unless it is individual or practice).
      // This ensures we hide any test which does not belong to the batch.
      const hasBatch = (t.batchIds && t.batchIds.includes(userBatchId)) || (t.batchId === userBatchId);
      return hasBatch;
    });

    return filtered;
  },

  migrateScoringData: async (): Promise<{ testsUpdated: number; attemptsUpdated: number }> => {
    // 1. Update all tests to have correct points
    const testsSnap = await getDocs(collection(db, 'tests'));
    const testMap: Record<string, Test> = {};
    let testsUpdated = 0;

    let testBatch = writeBatch(db);
    let testBatchCount = 0;
    
    for (const testDoc of testsSnap.docs) {
      const data = { id: testDoc.id, ...testDoc.data() } as Test;
      
      let changed = false;
      const updatedQuestions = (data.questions || []).map(q => {
        let qChanged = false;
        const newQ = { ...q };
        // Force standard scoring: +2 for correct, 0.5 for wrong
        const targetPoints = 2;
        const targetNegPoints = 0.5;

        if (newQ.points !== targetPoints) { newQ.points = targetPoints; qChanged = true; }
        if (newQ.negativePoints !== targetNegPoints) { newQ.negativePoints = targetNegPoints; qChanged = true; }
        if (qChanged) changed = true;
        return newQ;
      });

      const maxMarks = updatedQuestions.reduce((acc, q) => acc + (q.points || 2), 0);
      const passingMarks = Math.round(maxMarks * 0.4);

      // FORCE update test metadata even if questions didn't change, to ensure negativeMarking is ON
      if (changed || !data.negativeMarking || data.maximumMarks !== maxMarks) {
        testBatch.update(testDoc.ref, { 
          questions: updatedQuestions,
          negativeMarking: true,
          maximumMarks: maxMarks,
          passingMarks: passingMarks,
          updatedAt: new Date().toISOString()
        });
        
        testMap[testDoc.id] = { 
          ...data, 
          questions: updatedQuestions, 
          negativeMarking: true,
          maximumMarks: maxMarks,
          passingMarks: passingMarks
        };

        testsUpdated++;
        testBatchCount++;
        
        if (testBatchCount >= 400) {
          await testBatch.commit();
          testBatch = writeBatch(db);
          testBatchCount = 0;
        }
      } else {
        testMap[testDoc.id] = data;
      }
    }

    if (testBatchCount > 0) await testBatch.commit();

    // 2. Update all attempts to reflect new marks
    const attemptsSnap = await getDocs(collection(db, 'test_attempts'));
    let attemptsUpdated = 0;
    let attemptBatch = writeBatch(db);
    let attemptBatchCount = 0;

    for (const attDoc of attemptsSnap.docs) {
      const att = { id: attDoc.id, ...attDoc.data() } as TestAttempt;
      const test = testMap[att.testId];
      if (!test) continue;

      let marks = 0;
      let correct = 0;
      let wrong = 0;
      let skipped = 0;
      const updatedAnswers = { ...att.answers };
      let attemptDataChanged = false;

      test.questions.forEach(q => {
        const ans = updatedAnswers[q.id];
        if (!ans) return;

        // Support legacy selectedOption field
        const ansValue = ans.value !== undefined ? ans.value : (ans as any).selectedOption;
        const hasValue = ansValue !== undefined && ansValue !== null && ansValue !== '';
        
        if (!hasValue || (Array.isArray(ansValue) && ansValue.length === 0)) {
          skipped++;
          if (ans.marksAwarded !== 0) { ans.marksAwarded = 0; attemptDataChanged = true; }
        } else {
          let isCorrect = false;
          const qCorrect = q.correctAnswers || [];
          
          if (q.type === 'MSQ' && Array.isArray(ansValue)) {
            isCorrect = qCorrect.length === ansValue.length && 
                        qCorrect.every(v => (ansValue as any[]).map(String).includes(String(v)));
          } else if (qCorrect.length > 0) {
            isCorrect = String(ansValue) === String(qCorrect[0]);
          }

          if (isCorrect) {
            correct++;
            const pts = q.points || 2;
            marks += pts;
            if (ans.marksAwarded !== pts) { ans.marksAwarded = pts; attemptDataChanged = true; }
          } else {
            wrong++;
            const negPts = q.negativePoints || 0.5;
            marks -= negPts;
            if (ans.marksAwarded !== -negPts) { ans.marksAwarded = -negPts; attemptDataChanged = true; }
          }
          if (ans.status !== 'evaluated') { ans.status = 'evaluated'; attemptDataChanged = true; }
        }
      });

      const maxMarks = test.maximumMarks || test.questions.reduce((acc, q) => acc + (q.points || 2), 0);
      const percentage = maxMarks > 0 ? Math.max(0, (marks / maxMarks) * 100) : 0;

      if (att.marks !== marks || attemptDataChanged || att.percentage !== percentage) {
        attemptBatch.update(attDoc.ref, {
          marks,
          percentage,
          correct,
          wrong,
          skipped,
          answers: updatedAnswers,
          updatedAt: new Date().toISOString()
        });
        attemptsUpdated++;
        attemptBatchCount++;

        if (attemptBatchCount >= 400) {
          await attemptBatch.commit();
          attemptBatch = writeBatch(db);
          attemptBatchCount = 0;
        }
      }
    }

    if (attemptBatchCount > 0) await attemptBatch.commit();

    return { testsUpdated, attemptsUpdated };
  },

  startAttempt: async (
    testId: string, 
    inputUserId: string, 
    isPractice: boolean = false, 
    practiceType: string = 'all', 
    parentAttemptId: string = '',
    practiceQuestionIds: string[] = []
  ): Promise<string> => {
    const test = await TestService.getTest(testId);
    
    // Resolve inputUserId to the true legacy or public document ID (e.g. mobile number)
    const { userId, publicRef } = await resolveUserDoc(inputUserId);
    console.log(`[TestService DEBUG] startAttempt resolved ${inputUserId} to user document ID ${userId}`);
    
    // Check for an in-progress or started attempt to resume using either format
    const attemptsQ = query(
      collection(db, 'test_attempts'), 
      where('testId', '==', testId), 
      where('userId', 'in', [userId, inputUserId])
    );
    const attemptsSnap = await getDocs(attemptsQ);
    const inProgress = attemptsSnap.docs.find(d => {
      const data = d.data();
      const statusMatch = data.status === 'in_progress' || data.status === 'started';
      const practiceMatch = isPractice ? data.isPracticeAttempt === true : !data.isPracticeAttempt;
      return statusMatch && practiceMatch;
    });
    
    if (inProgress) {
      return inProgress.id;
    }

    // Get previous attempts to determine attempt number and best score
    const allAttsQ = query(
      collection(db, 'test_attempts'), 
      where('testId', '==', testId), 
      where('userId', 'in', [userId, inputUserId])
    );
    const allAtts = await getDocs(allAttsQ);
    
    if (!isPractice) {
      const maxAttemptsVal = test.maxAttempts || (test.oneAttemptOnly ? 1 : (test.status === 'live' ? 1 : 9999));
      if (allAtts.size >= maxAttemptsVal && !allAtts.empty) {
        throw new Error(`Maximum attempt limit reached. This test allows at most ${maxAttemptsVal} attempt(s).`);
      }
    }

    let attemptNumber = 1;
    let bestScoreSoFar = 0;
    
    if (!allAtts.empty) {
      attemptNumber = allAtts.size + 1;
      bestScoreSoFar = Math.max(...allAtts.docs.map(d => d.data().marks || 0));
    }

    const sessionToken = Math.random().toString(36).substring(2, 15);

    // Get user details for analytics
    let userName = 'Student';
    let userPhotoURL = '';
    let batchId = test.batchId || '';

    try {
      const userSnap = await getDoc(publicRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as any;
        // Since the premium system is removed, all premium tests are accessible.
        const isPremiumUser = true;
        if (test.testType === 'premium' && !isPremiumUser && !isPractice && userData.role === 'student') {
           throw new Error("Premium tests are restricted to premium students only.");
        }
        userName = userData.name || userData.displayName || 'Student';
        userPhotoURL = userData.photoURL || userData.photo || '';
        if (!batchId) batchId = userData.batchId || '';
      }
    } catch (e) {
      console.error("Error fetching user details for test attempt:", e);
      throw e;
    }

    const docRef = await addDoc(collection(db, 'test_attempts'), {
      testId,
      userId, // Store the primary resolved userId (e.g. legacy mobile or primary ID) for exact schema consistency
      userName,
      userPhotoURL,
      testTitle: test.title,
      batchId,
      status: 'in_progress',
      answers: {},
      marks: 0,
      percentage: 0,
      correct: 0,
      wrong: 0,
      skipped: isPractice ? practiceQuestionIds.length : test.questions.length,
      timeTaken: 0,
      startedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      activeSessionToken: sessionToken,
      attemptNumber: isPractice ? 1 : attemptNumber,
      bestScoreSoFar: isPractice ? 0 : bestScoreSoFar,
      visitedQuestions: [],
      markedForReview: [],
      lastQuestionIdx: 0,
      isPracticeAttempt: isPractice,
      practiceType: isPractice ? practiceType : null,
      parentAttemptId: isPractice ? parentAttemptId : null,
      practiceQuestionIds: isPractice ? practiceQuestionIds : null
    });
    return docRef.id;
  },

  duplicateTest: async (testId: string, mentorId: string): Promise<string> => {
    const original = await TestService.getTest(testId);
    const { id, createdAt, updatedAt, ...rest } = original;
    const newTestId = await TestService.createTest({
      ...rest,
      title: `${original.title} (Copy)`,
      status: 'draft',
      createdBy: mentorId
    });
    return newTestId;
  },

  getAttemptsForTest: async (testId: string): Promise<TestAttempt[]> => {
    const q = query(collection(db, 'test_attempts'), where('testId', '==', testId));
    const snap = await getDocs(q);
    const attempts = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as TestAttempt));
    
    if (attempts.length === 0) return [];

    try {
      const userIds = Array.from(new Set(attempts.map(a => a.userId).filter(Boolean)));
      if (userIds.length === 0) return attempts;

      // Fetch user data in chunks of 10 (Firestore 'in' limit is 30, but let's be safe)
      const userProfiles: Record<string, any> = {};
      
      for (let i = 0; i < userIds.length; i += 10) {
        const chunk = userIds.slice(i, i + 10);
        const usersQ = query(collection(db, 'users'), where('uid', 'in', chunk));
        const usersSnap = await getDocs(usersQ);
        usersSnap.forEach(d => {
          userProfiles[d.data().uid] = d.data();
        });
      }

      attempts.forEach(att => {
        const uData = userProfiles[att.userId];
        if (uData) {
          att.userName = uData.name || uData.displayName || att.userName || 'Student';
          att.userPhotoURL = uData.photoURL || uData.photo || att.userPhotoURL || '';
          att.batchId = uData.batchId || att.batchId || '';
          (att as any).category = uData.category || 'Review Category';
        }
      });
    } catch (e) {
      console.error("Error enriching getAttemptsForTest:", e);
    }
    
    return attempts;
  },

  getAttemptsForTestAndStudent: async (testId: string, studentId: string): Promise<TestAttempt[]> => {
    if (!studentId) return [];
    const { userId } = await resolveUserDoc(studentId);
    
    const attemptsMap = new Map<string, TestAttempt>();
    const idsToQuery = [userId];
    if (studentId && !idsToQuery.includes(studentId)) {
      idsToQuery.push(studentId);
    }
    
    try {
      const privRef = doc(db, 'users_private', userId);
      const privSnap = await getDoc(privRef);
      if (privSnap.exists()) {
        const privData = privSnap.data();
        if (privData.uid && !idsToQuery.includes(privData.uid)) {
          idsToQuery.push(privData.uid);
        }
      }
    } catch (e) {
      console.warn("[TestService DEBUG] Error resolving private UID for test attempts:", e);
    }
    
    for (const uid of idsToQuery) {
      const q = query(
        collection(db, 'test_attempts'),
        where('testId', '==', testId),
        where('userId', '==', uid)
      );
      const snap = await getDocs(q);
      snap.docs.forEach(doc => {
        attemptsMap.set(doc.id, { id: doc.id, ...(doc.data() as any) } as TestAttempt);
      });
    }
    
    return Array.from(attemptsMap.values());
  },

  getRank: async (testId: string, score: number): Promise<number> => {
    const q = query(
      collection(db, 'test_attempts'),
      where('testId', '==', testId),
      where('status', '!=', 'in_progress')
    );
    const snap = await getDocs(q);
    const validDocs = snap.docs.filter(doc => !doc.data().isPracticeAttempt);
    // Unique best scores per user
    const userBestScores: Record<string, number> = {};
    validDocs.forEach(doc => {
      const data = doc.data();
      userBestScores[data.userId] = Math.max(userBestScores[data.userId] || 0, data.marks || 0);
    });
    const uniqueSortedScores = Object.values(userBestScores).sort((a, b) => b - a);
    const rank = uniqueSortedScores.findIndex(s => s <= score) + 1;
    return rank > 0 ? rank : uniqueSortedScores.length + 1;
  },

  getTestAnalytics: async (testId: string) => {
    const q = query(collection(db, 'test_attempts'), where('testId', '==', testId));
    const snap = await getDocs(q);
    const attempts = snap.docs
      .map(d => d.data() as TestAttempt)
      .filter(a => a.status !== 'in_progress' && !a.isPracticeAttempt);
    
    if (attempts.length === 0) return null;

    const totalMarks = attempts.reduce((acc, a) => acc + a.marks, 0);
    const averageScore = totalMarks / attempts.length;
    const maxScore = Math.max(...attempts.map(a => a.marks));
    const averageTimeTaken = attempts.reduce((acc, a) => acc + (a.timeTaken || 0), 0) / attempts.length;
    
    // Per question difficulty
    const questionStats: Record<string, {
      correctAttempts: number;
      wrongAttempts: number;
      skippedAttempts: number;
      submissions: number;
      accuracy: number;
    }> = {};

    attempts.forEach(a => {
      if (!a.answers) return;
      Object.keys(a.answers).forEach(qId => {
        if (!questionStats[qId]) {
          questionStats[qId] = {
            correctAttempts: 0,
            wrongAttempts: 0,
            skippedAttempts: 0,
            submissions: 0,
            accuracy: 0
          };
        }
        const ans = a.answers[qId];
        if (ans) {
          if (ans.marksAwarded! > 0) {
            questionStats[qId].correctAttempts++;
          } else if (ans.marksAwarded! < 0 || ans.value) {
            questionStats[qId].wrongAttempts++;
          } else {
            questionStats[qId].skippedAttempts++;
          }
        } else {
          questionStats[qId].skippedAttempts++;
        }
      });
    });

    // Compute submissions and accuracy for each question
    Object.keys(questionStats).forEach(qId => {
      const qs = questionStats[qId];
      qs.submissions = qs.correctAttempts + qs.wrongAttempts + qs.skippedAttempts;
      qs.accuracy = qs.submissions > 0 ? (qs.correctAttempts / qs.submissions) * 100 : 0;
    });

    return {
      totalAttempts: attempts.length,
      averageScore,
      maxScore,
      averageTimeTaken,
      questionStats
    };
  },

  saveAnswer: async (attemptId: string, answer: Answer): Promise<void> => {
    try {
      const docRef = doc(db, 'test_attempts', attemptId);
      const sanitizedAnswer = sanitizeQuestionObject(answer);
      await updateDoc(docRef, { 
        [`answers.${answer.questionId}`]: sanitizedAnswer,
        lastHeartbeatAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error in saveAnswer:", e);
      throw e;
    }
  },

  updateAttemptProgress: async (attemptId: string, progress: { 
    lastQuestionIdx?: number; 
    visitedQuestions?: string[]; 
    markedForReview?: string[];
  }): Promise<void> => {
    const docRef = doc(db, 'test_attempts', attemptId);
    await updateDoc(docRef, { 
      ...progress,
      lastHeartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  },

  refreshHeartbeat: async (attemptId: string, sessionToken: string): Promise<void> => {
    const docRef = doc(db, 'test_attempts', attemptId);
    await updateDoc(docRef, { 
      lastHeartbeatAt: new Date().toISOString(),
      activeSessionToken: sessionToken
    });
  },

  submitAttempt: async (attemptId: string, finalTimeTaken: number, currentAnswers?: Record<string, any>, lastIdx?: number): Promise<void> => {
    try {
      if (!attemptId) throw new Error("No attempt ID provided");
      
      const docRef = doc(db, 'test_attempts', attemptId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error(`Attempt document not found: ${attemptId}`);
      }
      
      const attemptData = snap.data() as TestAttempt;
      const attempt = { id: snap.id, ...attemptData };
      const isPracticeAttempt = attempt.isPracticeAttempt || false;
      const practiceQuestionIds = attempt.practiceQuestionIds as string[] | undefined;
      
      // Use provided answers if available, otherwise fallback to DB answers
      const updatedAnswers = currentAnswers ? { ...currentAnswers } : { ...attempt.answers };
      
      const test = await TestService.getTest(attempt.testId);
      if (!test) throw new Error(`Test not found: ${attempt.testId}`);
      
      let questionsToEvaluate = test.questions;
      if (isPracticeAttempt && practiceQuestionIds) {
        questionsToEvaluate = test.questions.filter(q => practiceQuestionIds.includes(q.id));
      }

      let marks = 0, correct = 0, wrong = 0, skipped = 0;
      let hasSubjective = false;

      questionsToEvaluate.forEach(q => {
        const ans = updatedAnswers[q.id];
        if (!ans || !ans.value || (Array.isArray(ans.value) && ans.value.length === 0)) {
          skipped++;
          return;
        }
        
        if (q.type === 'Subjective' || q.type === 'Paragraph') {
          hasSubjective = true;
          ans.status = 'pending';
        } else {
          let isCorrect = false;
          if (Array.isArray(ans.value) && q.correctAnswers) {
            isCorrect = q.correctAnswers.length === ans.value.length && 
                        q.correctAnswers.every(v => (ans.value as string[]).includes(v));
          } else if (q.correctAnswers && q.correctAnswers.length > 0) {
            isCorrect = String(ans.value) === String(q.correctAnswers[0]);
          }

          if (isCorrect) {
            correct++;
            const pts = q.points || 2;
            marks += pts;
            ans.marksAwarded = pts;
          } else {
            wrong++;
            const negPts = q.negativePoints || 0.5;
            if (test.negativeMarking && negPts) {
              marks -= negPts;
            }
            ans.marksAwarded = test.negativeMarking && negPts ? -negPts : 0;
          }
          ans.status = 'evaluated';
        }
      });

      let maxMarks = test.maximumMarks;
      if (isPracticeAttempt && practiceQuestionIds) {
        maxMarks = questionsToEvaluate.reduce((acc, q) => acc + (q.points || 2), 0);
      }
      const percentage = maxMarks > 0 ? Math.max(0, (marks / maxMarks) * 100) : 0;
      
      const myPrevAttempts = await TestService.getAttemptsForTestAndStudent(attempt.testId, attempt.userId);
      const prevAttempt = myPrevAttempts.filter(a => a.attemptNumber < attempt.attemptNumber).sort((a,b) => b.attemptNumber - a.attemptNumber)[0];
      const improvementFromPrevious = prevAttempt ? marks - prevAttempt.marks : 0;

      const newBestScore = attempt.bestScoreSoFar !== undefined ? Math.max(attempt.bestScoreSoFar, marks) : marks;

      const dataToUpdate: any = {
        status: hasSubjective ? 'submitted' : 'evaluated',
        answers: updatedAnswers,
        lastQuestionIdx: lastIdx !== undefined ? lastIdx : attempt.lastQuestionIdx,
        marks,
        bestScoreSoFar: isPracticeAttempt ? 0 : newBestScore,
        percentage,
        correct,
        wrong,
        skipped,
        timeTaken: finalTimeTaken,
        improvementFromPrevious: isPracticeAttempt ? 0 : improvementFromPrevious,
        submittedAt: new Date().toISOString()
      };
      
      // Remove undefined values to avoid Firestore errors
      Object.keys(dataToUpdate).forEach(key => (dataToUpdate as any)[key] === undefined && delete (dataToUpdate as any)[key]);
      
      try {
        await updateDoc(docRef, dataToUpdate);
      } catch (err: any) {
        console.error("Step 1 (Update Attempt) failed:", err);
        handleFirestoreError(err, OperationType.UPDATE, `test_attempts/${attemptId}`);
      }

      // Step 2 and 3 are auxiliary and should not block test submission if they fail (e.g. due to permissions)
      if (!isPracticeAttempt) {
        try {
          TestService.updateTestAnalytics(attempt.testId);
        } catch (err: any) {
          console.warn("Step 2 (Update Analytics) skipped or failed:", err.message);
          // Silently continue for non-critical analytics update
        }

        try {
          StudentStatsService.updateStats(attempt.userId);
        } catch (err: any) {
          console.warn("Step 3 (Update Stats) skipped or failed:", err.message);
          // Silently continue for non-critical stats update
        }
      }
    } catch (e: any) {
      console.error("Error in submitAttempt:", e);
      throw e;
    }
  },

  getAttempt: async (attemptId: string): Promise<TestAttempt> => {
    const snap = await getDoc(doc(db, 'test_attempts', attemptId));
    if (!snap.exists()) throw new Error('Attempt not found');
    const att = { id: snap.id, ...(snap.data() as any) } as TestAttempt;

    try {
      if (att.userId) {
        const { publicRef } = await resolveUserDoc(att.userId);
        const uSnap = await getDoc(publicRef);
        let uData: any = null;
        if (uSnap.exists()) {
          uData = uSnap.data();
        }

        if (uData) {
          att.userName = uData.name || att.userName || 'Student';
          att.userPhotoURL = uData.photoUrl || att.userPhotoURL || '';
          att.batchId = uData.batchId || att.batchId || '';
          (att as any).category = uData.category || 'Review Category';
        }
      }
    } catch (e) {
      console.error("Error enriching single attempt with user profile:", e);
    }

    return att;
  },

  updateTestAnalytics: async (testId: string): Promise<void> => {
    const attempts = await TestService.getAttemptsForTest(testId);
    const evaluatedAttempts = attempts.filter(a => a.status === 'evaluated' || a.status === 'submitted').sort((a, b) => b.marks - a.marks);
    
    if (evaluatedAttempts.length === 0) return;

    const batch = writeBatch(db);
    const total = evaluatedAttempts.length;

    let isMentor = false;
    let currentAppUserId = '';
    try {
      const cached = localStorage.getItem('user_profile');
      if (cached) {
        const u = JSON.parse(cached);
        isMentor = u.role === 'mentor' || u.role === 'primary-mentor' || u.role === 'admin' || u.role === 'staff' || u.role === 'examiner';
        currentAppUserId = u.id || '';
      }
    } catch (e) {
      // ignore
    }

    const currentUid = auth.currentUser?.uid;
    let addedToBatch = false;

    evaluatedAttempts.forEach((attempt, index) => {
        const rank = index + 1;
        const percentile = ((total - index) / total) * 100;

        // If not a mentor/examiner, we are only allowed to update our own attempt!
        const isOwnAttempt = (currentUid && (attempt as any).uid === currentUid) || 
                             (currentAppUserId && attempt.userId === currentAppUserId) ||
                             (currentUid && attempt.userId === currentUid);

        if (isMentor || isOwnAttempt) {
            batch.update(doc(db, 'test_attempts', attempt.id), { rank, percentile });
            addedToBatch = true;
        }
    });

    if (!addedToBatch) return;

    try {
      await batch.commit();
    } catch (e: any) {
      if (e.message?.includes('permission')) {
        handleFirestoreError(e, OperationType.UPDATE, `test_attempts/rank_update`);
      }
      throw e;
    }
  },
  
  getAttemptsForStudent: async (studentId: string): Promise<TestAttempt[]> => {
    if (!studentId) return [];
    
    // Resolve the user to get both their true document ID (userId) and private UID
    const { userId } = await resolveUserDoc(studentId);
    
    const attemptsMap = new Map<string, TestAttempt>();
    
    // Query 1: Query by resolved userId
    const q1 = query(collection(db, 'test_attempts'), where('userId', '==', userId));
    const snap1 = await getDocs(q1);
    snap1.docs.forEach(doc => {
      attemptsMap.set(doc.id, { id: doc.id, ...(doc.data() as any) } as TestAttempt);
    });
    
    // Query 2: If studentId is different from resolved userId, query by studentId too
    if (studentId !== userId) {
      const q2 = query(collection(db, 'test_attempts'), where('userId', '==', studentId));
      const snap2 = await getDocs(q2);
      snap2.docs.forEach(doc => {
        attemptsMap.set(doc.id, { id: doc.id, ...(doc.data() as any) } as TestAttempt);
      });
    }
    
    // Query 3: Query by UID from users_private just to be completely bulletproof
    try {
      const privRef = doc(db, 'users_private', userId);
      const privSnap = await getDoc(privRef);
      if (privSnap.exists()) {
        const privData = privSnap.data();
        if (privData.uid && privData.uid !== userId && privData.uid !== studentId) {
          const q3 = query(collection(db, 'test_attempts'), where('userId', '==', privData.uid));
          const snap3 = await getDocs(q3);
          snap3.docs.forEach(doc => {
            attemptsMap.set(doc.id, { id: doc.id, ...(doc.data() as any) } as TestAttempt);
          });
        }
      }
    } catch (e) {
      console.warn("[TestService DEBUG] Querying attempts by private UID failed:", e);
    }
    
    return Array.from(attemptsMap.values());
  },

  getAllAttempts: async (): Promise<TestAttempt[]> => {
    const q = query(collection(db, 'test_attempts'), where('status', '!=', 'in_progress'));
    const snap = await getDocs(q);
    const attempts = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as TestAttempt));

    if (attempts.length === 0) return [];

    try {
      const userIds = Array.from(new Set(attempts.map(a => a.userId).filter(Boolean)));
      if (userIds.length === 0) return attempts;

      const userProfiles: Record<string, any> = {};
      for (let i = 0; i < userIds.length; i += 10) {
        const chunk = userIds.slice(i, i + 10);
        const usersQ = query(collection(db, 'users'), where('uid', 'in', chunk));
        const usersSnap = await getDocs(usersQ);
        usersSnap.forEach(d => {
          userProfiles[d.data().uid] = d.data();
        });
      }

      attempts.forEach(att => {
        const uData = userProfiles[att.userId];
        if (uData) {
          att.userName = uData.name || uData.displayName || att.userName || 'Student';
          att.userPhotoURL = uData.photoURL || uData.photo || att.userPhotoURL || '';
          att.batchId = uData.batchId || att.batchId || '';
          (att as any).category = uData.category || 'Review Category';
        }
      });
    } catch (e) {
      console.error("Error enriching getAllAttempts:", e);
    }

    return attempts;
  },

  evaluateSubjective: async (attemptId: string, evaluations: Record<string, { marksAwarded: number, remarks: string }>, evaluatorId: string): Promise<void> => {
    const docRef = doc(db, 'test_attempts', attemptId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const attempt = { id: snap.id, ...(snap.data() as any) } as TestAttempt;
    
    let addedMarks = 0;
    
    Object.keys(evaluations).forEach(qId => {
      if (attempt.answers[qId]) {
        const evaluation = sanitizeQuestionObject(evaluations[qId]);
        attempt.answers[qId].marksAwarded = evaluation.marksAwarded;
        attempt.answers[qId].evaluatorRemarks = evaluation.remarks;
        attempt.answers[qId].status = 'evaluated';
        addedMarks += evaluation.marksAwarded;
      }
    });

    const newMarks = attempt.marks + addedMarks;
    const test = await TestService.getTest(attempt.testId);
    const percentage = test.maximumMarks > 0 ? Math.max(0, (newMarks / test.maximumMarks) * 100) : 0;
    const newBestScore = (attempt as any).bestScoreSoFar !== undefined ? Math.max((attempt as any).bestScoreSoFar, newMarks) : newMarks;

    await updateDoc(docRef, {
      answers: attempt.answers,
      marks: newMarks,
      bestScoreSoFar: newBestScore,
      percentage,
      status: 'evaluated',
      evaluatedBy: evaluatorId,
      evaluatedAt: new Date().toISOString()
    });

    try {
      await StudentUpdatesService.createUpdate({
        studentId: attempt.userId,
        type: 'test_evaluated',
        title: '📚 Test Evaluated',
        description: `Your subjective test "${test.title || 'Subjective Test'}" attempt has been evaluated and scored. Score: ${newMarks} marks.`
      });
    } catch (err) {
      console.error('Error logging test evaluation update:', err);
    }
    
    try {
      await TestService.updateTestAnalytics(attempt.testId);
    } catch (err) {
      console.warn('Post-evaluation analytics update failed:', err);
    }

    try {
      await StudentStatsService.updateStats(attempt.userId);
    } catch (err) {
      console.warn('Post-evaluation stats update failed:', err);
    }
  },

  uploadQuestionImage: async (file: File): Promise<string> => {
    const fileRef = ref(storage, `tests/questions/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  },

  uploadSolutionMedia: async (file: File, type: 'image' | 'pdf' | 'audio'): Promise<string> => {
    let path = 'tests/solutions/';
    if (type === 'image') path += 'images/';
    else if (type === 'pdf') path += 'pdf/';
    else if (type === 'audio') path += 'audio/';
    
    const fileRef = ref(storage, `${path}${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  },

  getTestByShareableId: async (shareableId: string): Promise<Test | null> => {
    try {
      const q = query(
        collection(db, 'tests'),
        where('shareableId', '==', shareableId),
        where('status', '!=', 'archived')
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() } as Test;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `/tests (by shareableId: ${shareableId})`);
      return null;
    }
  },

  incrementTestAnalytics: async (testId: string, metric: 'views' | 'registrations' | 'started' | 'completed', extra?: { score?: number }): Promise<void> => {
    try {
      const docRef = doc(db, 'tests', testId);
      const testSnap = await getDoc(docRef);
      if (!testSnap.exists()) return;
      const testData = testSnap.data() as Test;
      const currentAnalytics = testData.analytics || {};
      
      const updatedAnalytics = { ...currentAnalytics };
      updatedAnalytics[metric] = (updatedAnalytics[metric] || 0) + 1;
      
      if (metric === 'registrations') {
        updatedAnalytics.conversions = (updatedAnalytics.conversions || 0) + 1;
      }
      
      if (metric === 'completed' && extra?.score !== undefined) {
        updatedAnalytics.totalScore = (updatedAnalytics.totalScore || 0) + extra.score;
        updatedAnalytics.averageScore = updatedAnalytics.totalScore / (updatedAnalytics.completed || 1);
      }
      
      await updateDoc(docRef, {
        analytics: updatedAnalytics,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(`Failed to increment test analytics for ${testId}:`, e);
    }
  }
};
