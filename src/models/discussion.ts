export interface Comment {
  id: string;
  activityId: string;
  activityType: 'MentorPost' | 'Doubt' | 'DailyTest';
  authorId: string;
  authorName: string;
  authorRole: 'mentor' | 'student';
  text: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'pdf';
  parentId?: string; // For replies
  createdAt: any;
  updatedAt: any;
}
