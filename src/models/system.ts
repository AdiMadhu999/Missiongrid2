export interface Holiday {
  id: string;
  date: string;
  label: string;
  type: 'Institution' | 'Maintenance' | 'Other';
}

export interface Poll {
  question: string;
  options: string[];
  votes: Record<string, string>; // userId -> optionIndex
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  createdAt: string;
  type?: 'text' | 'poll' | 'voice';
  poll?: Poll;
  audioUrl?: string;
  seenBy?: string[];
}

export interface SystemSettings {
  emergencyThreshold: number; // e.g., 50 (if score below 50, trigger protocol)
  consistencyMultiplier: number;
  elitePointRequirement: number;
  institutionalHolidays: string[]; // ISO Strings
  maintenanceMode: boolean;
  announcements: Announcement[];
  currentCycleStartDate?: string;
  currentCycleNumber?: number;
  appVersion?: string;
}
