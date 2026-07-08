export type BackupStatus = 'ready' | 'running' | 'completed' | 'failed' | 'scheduled';

export interface BackupRecord {
  id: string;
  date: string;
  time: string;
  createdBy: string;
  type: 'manual' | 'scheduled';
  status: BackupStatus;
  moduleCount: number;
  remarks?: string;
}
