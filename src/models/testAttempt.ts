export type AttemptStatus = 'started' | 'submitted';

export interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, any>;
  markedQuestions: string[];
  status: AttemptStatus;
  startTime: string;
  submitTime?: string;
}
