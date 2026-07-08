export type WarningStatus = 'Active' | 'Resolved';

export interface Warning {
  id: string;
  studentId: string;
  studentName: string;
  reason: string;
  mentorId: string;
  mentorName: string;
  date: string;
  status: WarningStatus;
}
