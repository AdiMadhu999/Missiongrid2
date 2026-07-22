export type QuestionType = 'MCQ' | 'MULTIPLE' | 'MATCH' | 'NUMERICAL';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correctAnswer: any;
  explanation: string;
  formula_latex?: string;
  solution_latex?: string;
  explanation_latex?: string;
  option_latex?: string;
  diagram_formula_latex?: string;
  diagram_svg?: string;
  [key: string]: any;
}

export interface Test {
  id: string;
  title: string;
  category: string;
  subject: string;
  duration: number; // in seconds
  marks: number;
  totalQuestions: number;
  expiryDate: number; // timestamp
  status: 'draft' | 'scheduled' | 'published' | 'archived' | 'live';
  testType?: 'free' | 'premium';
  visibility?: 'global' | 'batch' | 'individual';
  batchId?: string;
  studentId?: string;
  folderId?: string;
  [key: string]: any;
}

export interface TestAttempt {
  id: string;
  userId: string;
  testId: string;
  status: 'in-progress' | 'completed';
  startTime: number;
  endTime?: number;
  answers: Record<string, any>;
  marks?: number;
}
