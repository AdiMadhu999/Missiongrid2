import React from 'react';
import { useAuth } from '../providers/AuthProvider';
import MissionHub from './study/MissionSubmissionView';
import MissionReviewWorkspace from './mentor/MissionReviewWorkspace';
import { Loader2 } from 'lucide-react';
import { PremiumUpgradeScreen } from '../components/student/PremiumUpgradeScreen';

export default function MissionViewDistributor() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identifying Role...</p>
      </div>
    );
  }

  const role = (userProfile?.role || '').toLowerCase();
  const isMentor = role === 'mentor' || role === 'primary-mentor' || role === 'staff' || role === 'admin' || role === 'examiner';
  
  if (isMentor) {
    return (
      <MissionReviewWorkspace 
        batchId={userProfile?.batchId || ''} 
        onBack={() => window.history.back()} 
      />
    );
  }

  // Strict Premium Access Control for Students
  if (!userProfile?.isPremium) {
    return <PremiumUpgradeScreen featureName="Daily Missions & Mentor Evaluations" />;
  }

  return <MissionHub onBack={() => window.history.back()} />;
}
