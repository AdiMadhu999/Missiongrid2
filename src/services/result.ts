import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, limit } from 'firebase/firestore';
import { Result } from '../models/result';
import { TestAttempt } from '../models/testAttempt';
import { Question } from '../models/question';
import { StudentUpdatesService } from './studentUpdates';

const RESULT_COLLECTION = 'results';

export async function evaluateAndSaveResult(attempt: TestAttempt, questions: Question[]): Promise<string> {
  let correct = 0;
  let wrong = 0;
  let attempted = 0;
  let totalMarks = 0;
  let obtainedMarks = 0;

  questions.forEach(q => {
    totalMarks += q.marks;
    const studentAnswer = attempt.answers[q.id];
    if (studentAnswer) {
      attempted++;
      // Simplified evaluation logic for Single MCQ
      const correctOption = q.options?.find(o => o.isCorrect)?.text;
      if (studentAnswer === correctOption) {
        correct++;
        obtainedMarks += q.marks;
      } else {
        wrong++;
      }
    }
  });

  const skipped = questions.length - attempted;
  const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
  
  const startTime = new Date(attempt.startTime).getTime();
  const submitTime = attempt.submitTime ? new Date(attempt.submitTime).getTime() : new Date().getTime();
  const timeTaken = Math.max(0, Math.floor((submitTime - startTime) / 1000));

  const result: Omit<Result, 'id'> = {
    testId: attempt.testId,
    studentId: attempt.studentId,
    studentName: attempt.studentName,
    totalQuestions: questions.length,
    attempted,
    correct,
    wrong,
    skipped,
    totalMarks,
    obtainedMarks,
    accuracy,
    timeTaken,
    status: 'evaluated',
    submissionTime: new Date().toISOString(),
  };

  const docRef = await addDoc(collection(db, RESULT_COLLECTION), result);
  
  try {
    await StudentUpdatesService.createUpdate({
      studentId: attempt.studentId,
      type: 'test_evaluated',
      title: '📚 Test Evaluated',
      description: `Your evaluation for the test is now available. Score: ${obtainedMarks}/${totalMarks} (${accuracy.toFixed(1)}% Accuracy)`,
      remark: `Status: Evaluated • Rank Update Pending`
    });
  } catch (err) {
    console.error('Error logging test evaluation student update:', err);
  }

  await updateTestRankings(result.testId);
  return docRef.id;
}

export async function getResultsForStudent(studentId: string): Promise<Result[]> {
    const q = query(collection(db, RESULT_COLLECTION), where('studentId', '==', studentId), limit(50));
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({id: d.id, ...d.data()} as Result));
    // Sort desc by submissionTime
    return results.sort((a, b) => new Date(b.submissionTime).getTime() - new Date(a.submissionTime).getTime());
}

export async function getResultsForTest(testId: string): Promise<Result[]> {
    const q = query(collection(db, RESULT_COLLECTION), where('testId', '==', testId), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({id: d.id, ...d.data()} as Result));
}

export async function updateTestRankings(testId: string) {
    const results = await getResultsForTest(testId);
    if (results.length === 0) return;

    // Sort by marks
    results.sort((a, b) => b.obtainedMarks - a.obtainedMarks);

    // Update ranks and percentiles
    const totalResults = results.length;
    for (let i = 0; i < totalResults; i++) {
        const rank = i + 1;
        const percentile = ((totalResults - i) / totalResults) * 100;
        const res = results[i];
        
        const resultDoc = doc(db, RESULT_COLLECTION, res.id);
        const oldRank = (res as any).rank;
        await updateDoc(resultDoc, { rank, percentile });

        if (oldRank && oldRank !== rank) {
            try {
                await StudentUpdatesService.createUpdate({
                    studentId: res.studentId,
                    type: 'rank_updated',
                    title: '🏆 Rank Updated',
                    description: `Your rank for test "${testId}" has been updated to #${rank}.`
                });
            } catch (err) {
                console.error('Error logging test rank update:', err);
            }
        }
    }
}
