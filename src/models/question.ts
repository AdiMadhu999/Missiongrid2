export type QuestionType = 'single_mcq' | 'multiple_mcq' | 'true_false' | 'assertion_reason' | 'match_following' | 'numerical';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type QuestionStatus = 'draft' | 'approved' | 'verified' | 'published' | 'archived';

export interface QuestionOption {
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  subject: string;
  chapter: string;
  topic: string;
  subtopic?: string;
  difficulty: Difficulty;
  options?: QuestionOption[];
  correctAnswer?: string;
  explanation?: string;
  examApproach?: string;
  marks: number;
  status: QuestionStatus;
  tags: string[];
  updatedAt: string;
  createdAt?: string;
  createdBy?: string;
  youtubeLink?: string;
  pdfLink?: string;
  driveLink?: string;
  websiteLink?: string;
  imageUrl?: string;
  solutionImageUrl?: string;
  source?: string;
  formula_latex?: string;
  solution_latex?: string;
  explanation_latex?: string;
  option_latex?: string;
  diagram_formula_latex?: string;
  diagram_svg?: string;
  [key: string]: any;
}
