export type ResultStatus = 'evaluated' | 'published' | 'hidden';

export interface Result {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  totalMarks: number;
  obtainedMarks: number;
  accuracy: number;
  percentile?: number;
  rank?: number;
  timeTaken: number; // in seconds
  status: ResultStatus;
  submissionTime: string;
}
