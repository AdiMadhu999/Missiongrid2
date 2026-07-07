import React, { useState, useRef, useEffect } from 'react';
import { User as UserIcon, LogOut, Settings, Award, History, Activity, Zap, Trophy, Camera, Loader2, ShieldCheck, Crown, Download } from 'lucide-react';
import { motion } from 'motion/react';
import type { User } from '../../models/user';
import { getStudentCode } from '../../utils/privacy';
import { auth } from '../../services/firebase';
import ProfileSettingsModal from './ProfileSettingsModal';
import { TargetService } from '../../services/target';
import { updateUserProfile } from '../../services/users';
import { useAuth } from '../../providers/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { DailyStreakWidget } from '../../components/common/DailyStreakWidget';
import { safeDate } from '../../utils/date';
import { MissionService } from '../../services/mission';
import type { DailyMissionReport } from '../../models/mission';
import { BatchService } from '../../services/batch';
import { APP_VERSION, GIT_COMMIT, BUILD_TIMESTAMP } from '../../version';
import { useCachedQuery } from '../../hooks/useCachedQuery';

interface Props {
  userProfile: User;
  onSettings: () => void;
}

export default function StudentProfile({ userProfile, onSettings }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const missionsQuery = useCachedQuery<DailyMissionReport[]>({
    queryKey: ['studentProfileMissions', userProfile.id || ''],
    queryFn: async () => {
      return new Promise<DailyMissionReport[]>((resolve) => {
         if (!userProfile.id) return resolve([]);
         const unsub = MissionService.subscribeStudentReports(userProfile.id || userProfile.uid!, (data) => {
            unsub();
            resolve(data);
         }, () => {
            unsub();
            resolve([]);
         });
      });
    },
    enabled: !!userProfile.id,
    persistKey: userProfile.id ? `student_profile_missions_${userProfile.id}` : undefined,
    subscribeFn: (callback) => {
       if (!userProfile.id) return () => {};
       return MissionService.subscribeStudentReports(userProfile.id || userProfile.uid!, callback, (err) => {
          console.error(err);
       });
    }
  });
  
  const missions = missionsQuery.data || [];
  const loadingMissions = missionsQuery.isLoading && !missionsQuery.data;

  const batchQuery = useCachedQuery<string>({
    queryKey: ['studentProfileBatch', userProfile.batchId || ''],
    queryFn: async () => {
      if (!userProfile.batchId) return 'General';
      try {
        const b = await BatchService.getBatchById(userProfile.batchId);
        return b?.batchName || b?.batchCode || 'General';
      } catch {
        return 'General';
      }
    },
    enabled: !!userProfile.batchId,
    persistKey: userProfile.batchId ? `student_profile_batch_${userProfile.batchId}` : undefined,
  });
  
  const batchName = batchQuery.data || 'General';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = auth.currentUser?.uid || userProfile.uid;
    if (!file || !uid) return;

    setUploading(true);
    try {
        const { url } = await TargetService.uploadFile(file, `profiles/${uid}`);
        await updateUserProfile(userProfile.id || userProfile.mobile!, { photoUrl: url });
        window.location.reload(); 
    } catch (err) {
        console.error("Failed to upload photo:", err);
    } finally {
        setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/50 p-4 pb-36 overflow-y-auto">
      {/* Dynamic Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-white mb-6 relative overflow-hidden"
      >
        {/* Background Decorative element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
        
        <div className="flex justify-between items-start mb-8 relative z-10">
           <div className="flex items-center space-x-5">
             <div className="relative group">
                <div className="w-20 h-20 rounded-3xl bg-slate-50 border-2 border-white flex items-center justify-center shadow-xl overflow-hidden rotate-3 group-hover:rotate-0 transition-transform duration-300">
                    {userProfile.photoUrl ? (
                    <img src={userProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                    <UserIcon className="w-8 h-8 text-slate-300" />
                    )}
                </div>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-2xl border-4 border-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95"
                >
                    {uploading ? <Loader2 size={14} className="animate-spin"/> : <Camera size={14} />}
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handlePhotoUpload}
                />
             </div>
             <div>
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">{userProfile.name}</h2>
               <div className="flex flex-col gap-1 mt-1.5">
                 <div className="flex items-center gap-2">
                   <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                    Batch: {batchName} 
                   </span>
                 </div>
                 <p className="text-[10px] font-mono font-bold text-slate-400">ID: {userProfile.studentCode || getStudentCode(userProfile)}</p>
               </div>
             </div>
           </div>
           <div className="flex gap-1">
            <button onClick={onSettings} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all">
                <Settings className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all">
                <LogOut className="w-5 h-5" />
            </button>
           </div>
        </div>
        
        {/* Premium Membership Card */}
        <div className="bg-slate-900 text-slate-100 rounded-[2.5rem] p-6 shadow-xl border border-slate-800 relative overflow-hidden mb-6 z-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl">
                <Crown className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold">Premium Identity</span>
            </div>
            
            {userProfile.isPremium ? (
              <span className="bg-amber-400/10 text-amber-400 border border-amber-400/30 text-[9px] font-black tracking-wider px-3 py-1 rounded-full uppercase">
                PREMIUM ACTIVE
              </span>
            ) : (
              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[9px] font-black tracking-wider px-3 py-1 rounded-full uppercase">
                FREE ACCOUNT
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">Premium Plan</span>
              <span className="font-extrabold text-white">{userProfile.premiumPlan || 'Free Tier'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">Premium Start Date</span>
              <span className="font-mono text-slate-200 font-semibold">
                {userProfile.premiumStartDate ? new Date(userProfile.premiumStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">Premium Expiry Date</span>
              <span className="font-mono text-slate-200 font-semibold">
                {userProfile.premiumExpiryDate ? new Date(userProfile.premiumExpiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-3 mt-3">
              <span className="text-slate-400 font-bold">Remaining Premium Days</span>
              <span className="font-black text-amber-400 text-sm">
                {userProfile.isPremium ? `${userProfile.remainingPremiumDays ?? 0} Days` : '0 Days'}
              </span>
            </div>
          </div>
        </div>

         <DailyStreakWidget streak={userProfile.currentStreak || 0} />

        <button
          onClick={() => window.dispatchEvent(new Event('open-pwa-install'))}
          className="mt-4 w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Download size={14} />
          INSTALL AS WEB APP (PWA)
        </button>

        <a
          href={`/app-release.apk?v=${APP_VERSION}&t=${Date.now()}`}
          download={`app-release-${APP_VERSION}.apk`}
          className="mt-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/15"
        >
          <Download size={14} />
          DOWNLOAD NATIVE ANDROID APP (v{APP_VERSION})
        </a>
        <div className="text-[10px] text-center text-slate-400 mt-1 font-mono">
          Latest APK Build: {BUILD_TIMESTAMP} ({GIT_COMMIT})
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 relative z-10">
           <div className="bg-slate-50/80 p-4 rounded-3xl border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-200/50 flex items-center justify-center">
                 <History size={14} className="text-slate-400" />
               </div>
               <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Joined</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">{userProfile.createdAt ? safeDate(userProfile.createdAt).toLocaleDateString() : 'Awaiting'}</p>
               </div>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <ShieldCheck size={14} className="text-emerald-500" />
               </div>
               <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Status</p>
                  <p className="text-xs font-black text-emerald-600 mt-1 uppercase">Consistent</p>
               </div>
            </div>
         </div>
      </motion.div>

      {/* Modern Quick Actions */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Dashboard Modules</h3>
          <div className="h-px bg-slate-200 flex-1 ml-4" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Timeline', icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50', path: '/app/history' }
          ].map((item) => (
            <motion.button 
              key={item.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => item.path && navigate(item.path)}
              className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center gap-2 hover:border-indigo-200 hover:shadow-md transition-all group"
            >
              <div className={`p-3 rounded-2xl ${item.bg} group-hover:scale-110 transition-transform duration-300`}>
                 <item.icon className={`w-6 h-6 ${item.color}`}/>
              </div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{item.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Activity Feed Container */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-[2.5rem] p-6 border border-slate-200/60 shadow-sm"
      >
           <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 flex items-center gap-2.5 text-sm uppercase tracking-wider">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full" /> Performance Feed
              </h3>
              <button className="text-[10px] font-black text-indigo-600 uppercase">View All</button>
           </div>
           
           <div className="space-y-4">
              {loadingMissions ? (
                <div className="text-center py-10 animate-pulse text-[10px] font-black text-slate-400">SYNCING FEED...</div>
              ) : missions.length === 0 ? (
                <div className="text-center py-10">
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No mission records found</p>
                </div>
              ) : missions.map((m, idx) => (
                <div key={m.id || m.date || idx} className="p-4 rounded-2xl bg-white border border-slate-100 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        m.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 
                        m.status === 'Warning' ? 'bg-rose-50 text-rose-600' :
                        m.status === 'Absent' ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                         {m.status === 'Approved' ? <ShieldCheck size={18} /> : <Award size={18} />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 leading-none">{m.status}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">{m.date}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-indigo-600">+{m.marks} pts</p>
                   </div>
                </div>
              ))}
           </div>
      </motion.div>

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
