export interface LeaveRequest {
  id?: string;
  studentId: string;
  studentName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestDate: string;
  startDate: string; // Leave Date
  numberOfDays: number;
  attachmentUrl?: string;
  endDate?: string; // Optional but good to retain
}
