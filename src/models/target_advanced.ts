export interface TargetAssignment {
  id: string;
  targetId: string;
  userId: string;
  batchId: string;
  assignedAt: string;
  deadline: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'missed';
}

export interface TargetProgress {
  id: string;
  targetId: string;
  studentId: string;
  status: 'Not Started' | 'Started' | 'Completed' | 'Late' | 'Protected';
  taskStatuses: Record<string, 'Not Started' | 'Completed'>;
  completionPercentage: number;
  personalNotes?: string;
  mentorRemarks?: string;
  updatedAt: string;
  completedDate?: string;
  completedTime?: string;
}

export interface TargetArchive {
  id: string;
  targetId: string;
  studentId: string;
  archivedAt: string;
  dataSnapshot: any; // snapshot of the target at archive time
}

export interface TargetAnalytics {
  id: string;
  targetId: string;
  batchId: string;
  completionRate: number;
  averageScore?: number;
  missedCount: number;
  topPerformers: string[]; // studentIds
}

export interface TargetNotification {
  id: string;
  userId: string;
  type: 'assigned' | 'updated' | 'deadline_near' | 'missed' | 'special_mission';
  title: string;
  message: string;
  targetId?: string;
  read: boolean;
  createdAt: string;
}
