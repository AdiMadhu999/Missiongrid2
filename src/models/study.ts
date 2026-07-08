export interface StudySession {
  id: string;
  userId: string;
  batchId: string;
  startTime: number; // Firestore timestamp
  pausedTime?: number;
  totalPausedDuration: number;
  status: 'active' | 'paused' | 'ended';
  endTime?: number;
  duration: number; // in seconds
  dayKey: string; // YYYY-MM-DD
}
