// Core models mapping to the Mission Selection Specification version 1.0

export interface Batch {
  id?: string;
  batchName: string;
  batchCode: string;
  description: string;
  mentorId: string;
  examinerIds: string[];
  studentIds: string[];
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  createdBy: string;
  communityLink?: string;
}

export interface Task {
  id: string;
  name: string;
  type: 'Study' | 'Practice' | 'Mock Test' | 'Chapter Test' | 'Revision' | 'Backlog' | 'Special';
  priority: 'High' | 'Medium' | 'Low';
  estimatedMinutes: number;
  linkedResourceId?: string;
  linkedTestId?: string;
  linkedSubmissionId?: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Pending Submission' | 'Submitted' | 'Reviewed' | 'Protected';
  mentorNote?: string;
}

export interface DailyTarget {
  id: string; // targetId
  title: string;
  description: string;
  specialNotice?: string;
  pdfLinks: string[];
  imageLinks: string[];
  youtubeLinks: string[];
  websiteLinks: string[];
  createdBy: string;
  creatorName?: string;
  batchId?: string; // for batch visibility
  studentId?: string; // for individual visibility
  visibility: 'global' | 'batch' | 'individual';
  status: 'draft' | 'published' | 'archived' | 'scheduled';
  isPinned: boolean;
  theme?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet';
  createdAt: string;
  updatedAt: string;
  tasks: Task[];
  
  // Custom interactive classroom coordinates fields
  missionDay?: string;
  targetDay?: number | null;
  mentorName?: string;
  motivationalQuote?: string;
  announcement?: string;
  subjectsData?: Record<string, any>;
  extraWork?: string;
  tomorrowReminder?: string;
  scheduledFor?: string;
  voiceUrl?: string;
}

export interface TargetProgress {
  id: string;
  targetId: string;
  studentId: string;
  status: 'Not Started' | 'Started' | 'Completed';
  taskStatuses: Record<string, 'Not Started' | 'Completed'>;
  updatedAt: string;
}

export interface TargetReaction {
  id: string;
  targetId: string;
  userId: string;
  type: 'Like' | 'Fire' | 'Clap' | 'Heart';
  createdAt: string;
}

export interface Submission {
  id: string; // submissionId
  userId: string;
  batchId?: string;
  submissionType: 'Accountability' | 'General' | 'Emergency' | 'To Do List' | 'Rough Sheet' | 'Study Time' | 'Active Learning' | '50 Active Learning' | 'Extra Work' | 'Backlog Cover' | 'Synonyms' | 'Antonyms' | 'Idioms' | 'One Word' | 'Voice/Narration' | 'Cloze Test';
  description: string;
  storageUrls: string[];
  storageFiles?: { url: string; path: string; name: string }[];
  status: 'Pending' | 'Approved' | 'Rejected' | 'Resubmission Required';
  marks: number;
  userName?: string;
  userMobile?: string;
  studentCode?: string;
  userRole?: string;
  remarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
  dayKey: string;
}

export interface MultimediaSolution {
  text?: {
    short?: string;
    detailed?: string;
    tips?: string;
    mistakes?: string;
  };
  images?: string[];
  pdfUrl?: string;
  pdfName?: string;
  audioUrl?: string;
  audioName?: string;
  youtubeUrl?: string;
  links?: { title: string; url: string }[];
}

export interface Question {
  id: string;
  type: 'MCQ' | 'MSQ' | 'Integer' | 'Paragraph' | 'Subjective' | 'Mixed' | 'Boolean' | 'Fill';
  text: string;
  options?: string[]; // For MCQ, MSQ
  correctAnswers?: string[]; // For auto-evaluation
  points: number;
  negativePoints?: number;
  imageUrl?: string; // Legacy
  imageUrls?: string[]; // New: support multiple images
  explanation?: string; // Legacy - simplified explanation
  solution?: MultimediaSolution; // New: rich multimedia solution
  topic?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  isVerified?: boolean;
  attachments?: {
    type: 'pdf' | 'image' | 'youtube' | 'link';
    url: string;
    title?: string;
  }[];
  stepwiseSolution?: string[];
  keyConcept?: string;
  diagramMetadata?: {
    needsDiagram: boolean;
    shape?: string;
    labels?: string[];
  };
  diagram_svg?: string;
  formula_latex?: string;
  solution_latex?: string;
  explanation_latex?: string;
  option_latex?: string;
  diagram_formula_latex?: string;
  uncertaintyFlag?: boolean;
  qualityReport?: string;
  [key: string]: any;
}

export interface Test {
  id: string;
  title: string;
  description: string;
  subject: string;
  duration: number; // in minutes
  maximumMarks: number;
  passingMarks: number;
  instructions: string;
  negativeMarking: boolean;
  randomization: boolean;
  startTime?: string;
  endTime?: string;
  scheduledFor?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  tags: string[];
  notes?: string;
  visibility: 'global' | 'batch' | 'individual';
  batchId?: string;
  batchIds?: string[];
  studentId?: string;
  status: 'draft' | 'published' | 'live' | 'completed' | 'archived' | 'scheduled';
  testType?: 'free' | 'premium';
  questions: Question[];
  expiryDate?: string;
  rankVisibility?: boolean;
  attachments: string[];
  isPractice?: boolean;
  solutions?: {
    text?: string;
    pdfUrl?: string;
    videoUrl?: string;
    links?: string[];
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  type?: string; // Added: for test categorization

  category?: string;
  folderId?: string; // Added: for folder-based organization
  isPublic?: boolean;
  shareableId?: string;
  oneAttemptOnly?: boolean;
  maxAttempts?: number;
  registrationRequired?: boolean;
  passwordProtected?: boolean;
  testPassword?: string;
  showResultImmediately?: boolean;
  showSolutions?: boolean;
  enableLeaderboard?: boolean;
  examName?: string;
  chapterName?: string;
  pdfSharingEnabled?: boolean;
  pdfDownloadType?: "questions" | "smart_book";
  analytics?: {
    views?: number;
    registrations?: number;
    started?: number;
    completed?: number;
    totalScore?: number;
    averageScore?: number;
    conversions?: number;
  };
  [key: string]: any;
}

export interface Answer {
  questionId: string;
  value: any; // Single option, multiple options, integer string, or subjective text
  status?: 'evaluated' | 'pending'; // For subjective
  timeSpent?: number; // Added: time spent on this question
  marksAwarded?: number;
  evaluatorRemarks?: string;
  isCorrect?: boolean;
}

export interface TestAttempt {
  id: string;
  userId: string;
  testId: string;
  status: 'in_progress' | 'started' | 'submitted' | 'evaluated' | 'in-progress' | 'completed';
  answers: Record<string, Answer>; // map by questionId for fast updates
  marks: number;
  percentage: number;
  correct: number;
  wrong: number;
  skipped: number;
  timeTaken: number;
  attemptNumber: number;
  userName?: string;
  userPhotoURL?: string;
  testTitle?: string;
  batchId?: string;
  bestScoreSoFar?: number;
  rank?: number;
  percentile?: number;
  improvementFromPrevious?: number; // Score difference
  startedAt: string;
  submittedAt?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  
  // Resumption metadata
  lastQuestionIdx?: number;
  visitedQuestions?: string[]; // IDs of visited questions
  markedForReview?: string[]; // IDs of questions marked for review
  lastHeartbeatAt?: string;
  activeSessionToken?: string; // To handle multi-tab protection
  updatedAt?: string;
  sectionElapsed?: Record<string, number>;
  isPracticeAttempt?: boolean;
  practiceType?: 'incorrect' | 'incorrect_unattempted' | 'all';
  parentAttemptId?: string;
  practiceQuestionIds?: string[];
  isPremium?: boolean; // Added: derived from user status
  category?: string; // Added: user category
}

export interface MissionSection {
  submitted: boolean;
  submittedAt?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Needs Improvement' | 'Not Submitted' | 'Submitted';
  marks: number;
  maxMarks: number;
  remarks?: string;
  notes?: string;
  attachments: {
    url: string;
    type: 'image' | 'pdf';
    name: string;
    path: string;
  }[];
}

export type MissionStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Resubmit Required' | 'Late Submission' | 'Protected Day' | 'Emergency Leave' | 'Warning' | 'Absent' | 'Submitted' | 'Not Submitted' | 'Needs Improvement';

export interface StateChange {
  status: MissionStatus;
  changedAt: string;
  changedBy: string;
}

export interface DailyMissionReport {
  id?: string;
  userId: string;
  userName?: string;
  userMobile?: string;
  userPhoto?: string;
  batchId?: string;
  preparationDay?: number;
  targetDay?: number;
  deviceInstallationId?: string;
  submissionTime?: string;
  date: string; // YYYY-MM-DD
  dayKey: string; // same as date for one-per-day enforcement
  note?: string;
  attachments: {
    url: string;
    type: 'image' | 'pdf';
    name: string;
    path: string;
  }[];
  status: MissionStatus;
  marks: number; // 0-50
  remarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
  updatedAt?: string; // Added: for tracking updates
  ipAddress?: string; // Added: for automatic capture
  submissionVersion?: string; // Added: for production tracking
  stateChangeHistory?: StateChange[];
  sections?: Record<string, MissionSection>;
  reactions?: Record<string, number>; // Added: reaction counts
}

export interface EmergencyIntimation {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  reasonType: 'medical' | 'family' | 'exam' | 'special';
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  createdAt: Date;
}
