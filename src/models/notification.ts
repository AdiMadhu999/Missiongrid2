export interface AppNotification {
  id: string;
  receiverId: string;
  senderId: string;
  activityType: 'MentorPost' | 'Doubt' | 'DailyTest' | 'Reply' | 'Solved';
  activityId: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: any;
}
