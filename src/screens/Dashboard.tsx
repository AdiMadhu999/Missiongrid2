import React from 'react';
import { useAuth } from '../providers/AuthProvider';

import MentorDashboard from './MentorDashboard';
import StudentDashboard from './StudentDashboard';
import ExaminerDashboard from './ExaminerDashboard';
import PlaceholderScreen from './PlaceholderScreen';

export default function Dashboard() {
  const { userProfile } = useAuth();
  
  if (!userProfile) return null;

  const role = (userProfile.role || '').toLowerCase();
  
  console.log("Routing dashboard for role:", role);
  
  return (
    <>
      {role === 'mentor' || role === 'primary-mentor' || role === 'staff' ? (
        <MentorDashboard />
      ) : role === 'examiner' ? (
        <ExaminerDashboard />
      ) : role === 'student' ? (
        <StudentDashboard />
      ) : (
        <PlaceholderScreen title="Access Denied" description="Role not recognized." />
      )}
    </>
  );
}
