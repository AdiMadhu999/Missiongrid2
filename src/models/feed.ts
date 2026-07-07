export type FeedItemType = 'Doubt' | 'MissionReport' | 'DailyTest' | 'MentorPost';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  authorId: string;
  authorName: string;
  createdAt: any;
  batchId?: string;
  visibility: 'global' | 'batch';
  content?: string;
  attachments?: { url: string; type: 'image' | 'pdf' | 'video' | 'link'; name: string }[];
  metadata?: Record<string, any>;
}

export type MentorPostType = 'announcement' | 'article' | 'video' | 'image' | 'pdf' | 'test' | 'link' | 'voiceNote';

export interface MentorPost extends FeedItem {
  type: 'MentorPost';
  title: string;
  postType: MentorPostType;
  publishedStatus: 'published' | 'draft';
  pinnedStatus: boolean;
  youtubeLink?: string;
  externalLink?: string;
}

export interface DailyTest extends FeedItem {
  type: 'DailyTest';
  testName: string;
  duration: number;
  questionCount: number;
  shareToCommunity?: boolean;
  testId?: string;
}

export interface Reply {
  authorId: string;
  authorName: string;
  content: string;
  createdAt: any;
}

export interface Doubt extends FeedItem {
  type: 'Doubt';
  title: string;
  status: 'Solved' | 'Unsolved';
  replies?: Reply[];
  solvedBy?: string;
}
