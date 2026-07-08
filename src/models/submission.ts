import { serverTimestamp } from 'firebase/firestore';

export type SubmissionStatus = 'Pending Review' | 'Approved' | 'Rejected' | 'Correction Required';

export interface MissionSubmission {
  id?: string;
  studentId: string;
  studentName: string;
  firebaseUid: string;
  registeredMobile: string;
  batchId: string;
  preparationDay: number;
  targetDay: number;
  submissionDate: string; // ISO Date (YYYY-MM-DD)
  submissionTime: string; // HH:MM:SS
  submittedAt: any; // Server Timestamp
  deviceInstallationId: string;
  ipAddress?: string;
  status: SubmissionStatus;
  submissionVersion: string;
  studyProofUrl: string;
  remarks?: string;
  mentorRemarks?: string;
  updatedAt?: any;
  // Compatibility fields
  attachments?: {
    url: string;
    type: 'image' | 'pdf';
    name: string;
    path: string;
  }[];
  marks?: number;
}
