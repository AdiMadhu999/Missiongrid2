export type AuditEventType = 'login' | 'logout' | 'registration' | 'batch_creation' | 'batch_assignment' | 'daily_target' | 'submission' | 'approval' | 'rejection' | 'request' | 'announcement' | 'recognition' | 'achievement' | 'rank_update' | 'profile_update' | 'setting_update' | 'module_status' | 'backup' | 'restore' | 'target_update';

export interface AuditRecord {
  id: string;
  eventType: AuditEventType;
  userId: string;
  userName: string;
  role: 'student' | 'examiner' | 'mentor' | 'primary_mentor';
  batchId?: string;
  date: string;
  time: string;
  action: string;
  status: 'success' | 'failed' | 'pending';
  remarks?: string;
}
