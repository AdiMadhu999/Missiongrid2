// Base models and types for the application
export interface User {
  id?: string;
  uid?: string;
  name: string;
  email: string;
  mobile?: string;
  studentCode?: string;
  dailyScores?: { date: string; obtained: number; emergency?: boolean }[];
  photoUrl?: string;
  role: 'student' | 'mentor' | 'examiner' | 'primary-mentor' | 'aspirant' | 'staff' | 'admin';
  batchId?: string;
  mentorId?: string;
  examinerId?: string;
  status: 'inactive' | 'active' | 'suspended' | 'removed' | 'pending' | 'blocked' | 'restricted';
  pin?: string;
  loginHistory?: { timestamp: string; type: 'success' | 'failed' | 'reset' }[];
  missionPoints: number;
  currentRank: number;
  previousRank?: number;
  globalRank?: number;
  previousGlobalRank?: number;
  longestStreak?: number;
  totalActiveDaysCount?: number;
  category: 'Elite' | 'Base' | 'Review Category';
  currentStreak: number;
  streakUpdatedAt: string;
  reputationScore: number;
  consistencyIndex: number; // percentage 0-100
  cyclePoints?: number; // points from the current 10-day cycle
  attendanceIndex?: number; // percentage 0-100
  restrictedFromSubmitting?: boolean;
  restrictedFromPosting?: boolean;
  restrictedFromInteractions?: boolean;
  exemptFromPenalty?: boolean;
  excusedFromAttendance?: boolean;
  achievements?: string[]; // IDs of achievements
  notificationPreferences?: {
    email: boolean;
    app: boolean;
  };
  themePreference?: 'light' | 'dark' | 'system';
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  education?: string;
  aboutMe?: string;
  socialLinks?: { twitter?: string; linkedIn?: string; github?: string };
  profileVisibility?: 'public' | 'batch' | 'mentor' | 'private';
  isPremium?: boolean;
  premiumStatus?: 'PREMIUM' | 'FREE' | 'active' | string;
  premiumType?: string;
  mentorName?: string;
  mentorMobile?: string;
  currentBatch?: string;
  remainingPremiumDays?: number;
  premiumStartDate?: string;
  premiumExpiryDate?: string;
  premiumExpiredDate?: string;
  premiumPlan?: string;
  consecutiveMissedMissions?: number;
  consecutiveMissedDays?: number;
  lastMissionSubmissionDate?: string | null;
  lastSubmissionDate?: string | null;
  lastSubmissionAt?: string;
  lastSectionSubmissionAt?: Record<string, string>;
  manualPremiumOverride?: boolean;
  lastPremiumChangeDate?: string;
  premiumChangedBy?: string;
  premiumRemovalReason?: string;
  lastValidationDate?: string;
  lastVerificationDate?: string;
  premiumRevokedDate?: string;
  premiumSource?: string;
  batchChangedDate?: string;
  batchChangedBy?: string;
  registrationDate?: string;
  missionGridStudentId?: string; // New field
  registrationIP?: string;
  currentIP?: string;
  lastLoginIP?: string;
  deviceInfo?: string;
  deviceId?: string;
  lastLoginDateTime?: string;
  isProfileCompleted?: boolean; // Added for profile setup flow
  isEmailVerified?: boolean; // Added for mentor email verification
  isPrimaryMentor?: boolean; // Added: for primary mentor identification
  testAccess?: 'free' | 'premium';
  missionsApproved?: number;
  membership?: 'free' | 'premium';
  isEnrolled?: boolean;
  joinedMissionGridAt?: string;
  createdAt: string;
  updatedAt: string;
}

