import React, { useState } from 'react';
import { User as UserIcon, LogOut, Settings, ClipboardList, CheckSquare, Search, History, Award, Briefcase } from 'lucide-react';
import type { User } from '../../models/user';
import { auth } from '../../services/firebase';
import ProfileSettingsModal from './ProfileSettingsModal';
import { useAuth } from '../../providers/AuthProvider';
import { safeDate } from '../../utils/date';

interface Props {
  userProfile: User;
}

export default function ExaminerProfile({ userProfile }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const { userProfile: viewerProfile, logout } = useAuth();
  
  const isSelf = viewerProfile?.id === userProfile.id;
  const isMentor = viewerProfile?.role === 'mentor';
  const showManagement = isSelf || isMentor;

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-6">
        <div className="flex justify-between items-start mb-6">
           <div className="flex items-center space-x-4">
             <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shadow-inner overflow-hidden">
                {userProfile.photoUrl ? (
                   <img src={userProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                   <UserIcon className="w-7 h-7 text-slate-400" />
                )}
             </div>
             <div>
               <h2 className="text-xl font-bold text-slate-900">{userProfile.name}</h2>
               <div className="text-sm text-slate-500 capitalize">{userProfile.role} • Batch {userProfile.batchId}</div>
             </div>
           </div>
           
           {isSelf && (
             <button onClick={() => logout()} className="text-slate-400 hover:text-rose-600 transition-colors">
                 <LogOut className="w-5 h-5" />
             </button>
           )}
        </div>
        
        {/* Summary Row */}
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Batches</div>
              <div className="text-xl font-black text-slate-900">2</div>
           </div>
           <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Evaluations</div>
              <div className="text-xl font-black text-slate-900">145</div>
           </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
           <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Member Since</div>
              <div className="text-xs font-bold text-slate-900">{userProfile.createdAt ? safeDate(userProfile.createdAt).toLocaleDateString() : 'N/A'}</div>
           </div>
           <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Profile Completion</div>
              <div className="text-xs font-bold text-slate-900">90%</div>
           </div>
        </div>
      </div>

      {/* Management Passport (Visible only to examiner themselves or mentor) */}
      {showManagement && (
        <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3 px-1 uppercase tracking-wider">Academic Passport</h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">Review Activity</p>
                    <p className="text-lg font-bold">145 Scripts</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">Responsibility</p>
                    <p className="text-lg font-bold">Academic Monitor</p>
                </div>
            </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 mb-6">
          <button className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center gap-1">
             <Search className="w-5 h-5 text-indigo-600"/>
             <span className="text-[10px] font-bold text-slate-700">Batch Mon</span>
          </button>
          <button className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center gap-1">
             <ClipboardList className="w-5 h-5 text-amber-600"/>
             <span className="text-[10px] font-bold text-slate-700">Scripts</span>
          </button>
          <button className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center gap-1">
             <CheckSquare className="w-5 h-5 text-emerald-600"/>
             <span className="text-[10px] font-bold text-slate-700">Progress</span>
          </button>
      </div>

      {/* Achievements Panel */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-6">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
               <Award className="w-4 h-4 text-amber-500" /> Milestones
           </h3>
           <div className="space-y-4">
               <div className="flex items-center gap-3">
                   <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><Briefcase size={16}/></div>
                   <div className="text-sm">Academic Contributor</div>
               </div>
           </div>
      </div>

      {/* Recent Activity Panel */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
               <History className="w-4 h-4 text-slate-500" /> Recent Activity
           </h3>
           <div className="space-y-4">
              <div className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                  Evaluation history is clean.
              </div>
           </div>
      </div>

      {showSettings && (
         <ProfileSettingsModal 
            userProfile={userProfile} 
            onClose={() => setShowSettings(false)} 
            onSaved={() => setShowSettings(false)} 
         />
      )}
    </div>
  );
}
