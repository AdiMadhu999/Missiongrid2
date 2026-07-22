export interface StudentStats {
  studentId: string;
  accountabilityScore: number;
  missionPoints: number;
  totalPoints: number;
  currentRank: number;
  tenDayPerformance: number;
  tenDayProgress: number;
  streak: number;
  attendance: number;
  reviewCategory: 'Elite' | 'Stable' | 'Watchlist' | 'Critical';
  eliteStatus: 'Elite' | 'Base' | 'Risk';
  missionsApproved: number;
  missionsPending: number;
  testsCompleted: number;
  averageTestScore: number;
  warningCount: number;
  lastSubmission: string;
  status: 'inactive' | 'active' | 'suspended' | 'removed' | 'pending' | 'blocked' | 'restricted';
  updatedAt: string;
}
