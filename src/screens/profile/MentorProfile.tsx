import React, { useState, useRef } from 'react';
import { User as UserIcon, LogOut, Settings, Users, ShieldCheck, Target, Activity, ClipboardList, Zap, History, Award, Briefcase, Camera, Loader2 } from 'lucide-react';
import type { User } from '../../models/user';
import { auth } from '../../services/firebase';
import ProfileSettingsModal from './ProfileSettingsModal';
import { useAuth } from '../../providers/AuthProvider';
import { TargetService } from '../../services/target';
import { updateUserProfile } from '../../services/users';
import { safeDate } from '../../utils/date';

interface Props {
  userProfile: User;
}

export default function MentorProfile({ userProfile }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userProfile: viewerProfile, logout } = useAuth();
  
  const isSelf = viewerProfile?.mobile === userProfile.mobile;
  const isMentorOrExaminer = viewerProfile?.role === 'mentor' || viewerProfile?.role === 'primary-mentor';
  const showManagement = isSelf || (viewerProfile?.role === 'mentor' && viewerProfile?.mobile === '9912345678'); // Example logic for primary

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = auth.currentUser?.uid || userProfile.id;
    if (!file || !uid || !userProfile.mobile) return;

    setUploading(true);
    try {
        const { url } = await TargetService.uploadFile(file, `profiles/${uid}`);
        await updateUserProfile(userProfile.mobile, { photoUrl: url });
        window.location.reload(); 
    } catch (err) {
        console.error("Failed to upload photo:", err);
    } finally {
        setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      {/* Brand Header & Developer Console Trigger */}
      <div className="flex items-center justify-between px-1 mb-4 select-none" id="mentor-logo-header">
        <div className="flex items-center gap-2 cursor-pointer" id="logo-trigger" title="Tap 7 times for Developer Console">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-100 logo" id="mentor-profile-logo">
            <span className="text-white font-black text-xs">MG</span>
          </div>
          <span className="text-xs font-extrabold text-slate-800 tracking-wider font-sans" id="brand-name-logo">MissionGrid</span>
        </div>
        <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
          Mentor Control Panel
        </span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-6">
        <div className="flex justify-between items-start mb-6">
           <div className="flex items-center space-x-4">
              <div className="relative group">
                <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shadow-inner overflow-hidden">
                    {userProfile.photoUrl ? (
                    <img src={userProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                    <UserIcon className="w-7 h-7 text-slate-400" />
                    )}
                </div>
                {isSelf && (
                    <>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="absolute -bottom-1 -right-1 p-1.5 bg-indigo-600 text-white rounded-full border-2 border-white shadow-sm hover:bg-indigo-700 transition-colors"
                        >
                            {uploading ? <Loader2 size={12} className="animate-spin"/> : <Camera size={12} />}
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handlePhotoUpload}
                        />
                    </>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{userProfile.name}</h2>
                <div className="text-sm text-slate-500 capitalize">{userProfile.role} • {userProfile.batchId ? `Batch ${userProfile.batchId}` : 'No Batch'}</div>
              </div>
           </div>
           
           {isSelf && (
               <div className="flex gap-2">
                    <button onClick={() => setShowSettings(true)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <Settings className="w-5 h-5" />
                    </button>
                    <button onClick={() => logout()} className="text-slate-400 hover:text-rose-600 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
               </div>
           )}
        </div>
        
        {/* Summary Row */}
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Batches</div>
              <div className="text-xl font-black text-slate-900">{userProfile.batchId ? '1' : 'N/A'}</div>
           </div>
           <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Students</div>
              <div className="text-xl font-black text-slate-900">N/A</div>
           </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
           <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Member Since</div>
              <div className="text-xs font-bold text-slate-900">{userProfile.createdAt ? safeDate(userProfile.createdAt).toLocaleDateString() : 'N/A'}</div>
           </div>
           <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Profile Completion</div>
              <div className="text-xs font-bold text-slate-900">{userProfile.isProfileCompleted ? '100%' : '50%'}</div>
           </div>
        </div>
      </div>

      {/* About & Education */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">About</h3>
        <p className="text-sm text-slate-600 mb-4">{userProfile.aboutMe || 'No description provided.'}</p>
        <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">Education</h3>
        <p className="text-sm text-slate-600">{userProfile.education || 'N/A'}</p>
      </div>

      {/* Management Cards (Visible only to mentor themselves) */}
      {showManagement && (
        <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3 px-1 uppercase tracking-wider">Management Passport</h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">Examiners</p>
                    <p className="text-lg font-bold">N/A</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">Target Success</p>
                    <p className="text-lg font-bold">N/A</p>
                </div>
            </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 mb-6">
          <button className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center gap-1">
             <Users className="w-5 h-5 text-indigo-600"/>
             <span className="text-[10px] font-bold text-slate-700">Batch Mon</span>
          </button>
          <button className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center gap-1">
             <ClipboardList className="w-5 h-5 text-amber-600"/>
             <span className="text-[10px] font-bold text-slate-700">Account.</span>
          </button>
          <button className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center gap-1">
             <Zap className="w-5 h-5 text-emerald-600"/>
             <span className="text-[10px] font-bold text-slate-700">Rank</span>
          </button>
      </div>

      {/* Achievement Panel */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-6">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
               <Award className="w-4 h-4 text-amber-500" /> Milestones
           </h3>
           <div className="space-y-4">
               <div className="flex items-center gap-3">
                   <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><Briefcase size={16}/></div>
                   <div className="text-sm">2 Years of Mentoring</div>
               </div>
           </div>
      </div>

      {/* Recent Activity Panel */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
               <History className="w-4 h-4 text-slate-500" /> Recent Activity
           </h3>
           <div className="space-y-4">
              <div className="text-sm text-slate-500 flex justify-between">
                  <span>Latest Announcement</span>
                  <span className="font-bold text-slate-900">Cycle 4 Start</span>
              </div>
              <div className="text-sm text-slate-500 flex justify-between">
                  <span>New Student Joined</span>
                  <span className="font-bold text-slate-900">Batch Gen-2</span>
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
