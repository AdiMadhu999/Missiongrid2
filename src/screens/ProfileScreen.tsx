import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import MentorProfile from './profile/MentorProfile';
import ExaminerProfile from './profile/ExaminerProfile';
import StudentProfile from './profile/StudentProfile';
import SettingsScreen from './settings/SettingsScreen';

export default function ProfileScreen() {
  const { userProfile } = useAuth();
  const [view, setView] = useState<'profile' | 'settings'>('profile');

  if (!userProfile) {
    return <div className="flex h-full items-center justify-center p-4">Loading profile...</div>;
  }

  if (view === 'settings') {
    return <SettingsScreen onBack={() => setView('profile')} />;
  }

  const profileProps = { userProfile, onSettings: () => setView('settings') };

  if (userProfile.role === 'mentor') {
    return <MentorProfile {...profileProps} />;
  }
  
  if (userProfile.role === 'examiner') {
    return <ExaminerProfile {...profileProps} />;
  }

  return <StudentProfile {...profileProps} />;
}
