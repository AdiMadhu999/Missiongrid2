import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Users, User as UserIcon, UserCheck, Shield, HelpCircle, RefreshCw, Flame, Target, Star, BarChart3, ClipboardCheck, Calendar, Megaphone, X, MessageSquare, Volume2, Play, Pause, Check, Trophy, Award, AlertTriangle, CalendarCheck, CalendarX, Info, Lock, ShieldAlert, BellRing, Settings, LogOut, Camera, Loader2, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { BatchService } from '../services/batch';
import { getUsersByBatch, updateUserProfile } from '../services/users';
import { db, auth } from '../services/firebase';
import { doc, onSnapshot, updateDoc, increment, collection, query, where, or, limit, getDoc } from 'firebase/firestore';
import { Batch, DailyMissionReport } from '../models/mission';
import { MissionService } from '../services/mission';
import { Announcement } from '../models/system';
import { User } from '../models/user';
import { QuickActionsPanel } from '../components/common/QuickActionsPanel';
import ApplyLeaveModal from './student/ApplyLeaveModal';
import { motion, AnimatePresence } from 'motion/react';
import { safeStorage } from '../lib/storage';
import { getStudentCode } from '../utils/privacy';
import { safeDate } from '../utils/date';
import { TargetService } from '../services/target';
import { DailyStreakWidget } from '../components/common/DailyStreakWidget';
import { MotivationCard } from '../components/common/MotivationCard';
import { PremiumStatusWidget } from '../components/student/PremiumStatusWidget';
import ProfileSettingsModal from './profile/ProfileSettingsModal';
import { useCachedQuery } from '../hooks/useCachedQuery';

export default function StudentDashboard() {
  const { userProfile, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = auth.currentUser?.uid || userProfile?.uid;
    if (!file || !uid) return;

    setUploading(true);
    try {
        const { url } = await TargetService.uploadFile(file, `profiles/${uid}`);
        await updateUserProfile(userProfile?.id || userProfile?.mobile!, { photoUrl: url });
        window.location.reload(); 
    } catch (err) {
        console.error("Failed to upload photo:", err);
    } finally {
        setUploading(false);
    }
  };

  // Community config cache-first states
  // Dialog/Modal states for community features
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showPremiumUpgradeModal, setShowPremiumUpgradeModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // 1. Base Dashboard Data (Batch, Peers)
  const baseDataQuery = useCachedQuery<{ batch: Batch | null; peers: User[] }>({
    queryKey: ['studentDashboardBase', userProfile?.batchId || ''],
    queryFn: async () => {
      if (!userProfile?.batchId) return { batch: null, peers: [] };
      const [b, batchPeers] = await Promise.all([
        BatchService.getBatchById(userProfile.batchId),
        getUsersByBatch(userProfile.batchId)
      ]);
      const filteredPeers = batchPeers.filter(u => u.id !== userProfile.id && u.mobile !== userProfile.mobile);
      return { batch: b, peers: filteredPeers };
    },
    enabled: !!currentUser && !!userProfile?.batchId,
    persistKey: userProfile?.uid ? `student_dashboard_base_cache_${userProfile.uid}` : undefined,
  });

  const batch = baseDataQuery.data?.batch || null;
  const peers = baseDataQuery.data?.peers || [];

  // 1.5. Read pre-aggregated student metrics (exactly one Firestore read on startup, with offline-first cache)
  const metricsQuery = useCachedQuery<any>({
    queryKey: ['studentMetrics', userProfile?.id || ''],
    queryFn: async () => {
      if (!userProfile?.id) return null;
      const snap = await getDoc(doc(db, 'student_metrics', userProfile.id));
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    },
    enabled: !!currentUser && !!userProfile?.id,
    persistKey: userProfile?.uid ? `student_metrics_cache_${userProfile.uid}` : undefined,
    subscribeFn: (callback) => {
      if (!userProfile?.id) return () => {};
      return onSnapshot(
        doc(db, 'student_metrics', userProfile.id),
        (snap) => {
          if (snap.exists()) {
            callback(snap.data());
          }
        },
        (err) => console.error("Error subscribing to student metrics:", err)
      );
    }
  });

  const metrics = metricsQuery.data || null;

  // Derive live stats reactively from userProfile
  const stats = {
    consistency: Math.round(userProfile?.consistencyIndex || 0),
    streak: metrics?.streak || userProfile?.currentStreak || 0,
    reputation: metrics?.totalMissionPoints || userProfile?.missionPoints || 0,
  };

  // 2. Real-time subscription for student reports / missions timeline
  const uId = userProfile?.id || userProfile?.uid || currentUser?.uid || '';
  const reportsQuery = useCachedQuery<DailyMissionReport[]>({
    queryKey: ['studentReports', uId],
    queryFn: async () => [],
    enabled: !!currentUser && !!uId,
    persistKey: userProfile?.uid ? `student_reports_cache_${userProfile.uid}` : undefined,
    subscribeFn: (callback) => {
      return MissionService.subscribeStudentReports(
        uId,
        (reports) => {
          callback(reports);
        },
        (error) => console.error("Error subscribing to student reports:", error)
      );
    }
  });

  const recentReports = reportsQuery.data || [];

  // 3. Load global community config
  const communityConfigQuery = useCachedQuery<any>({
    queryKey: ['communityConfigGlobal'],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'community_config', 'global'));
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    },
    enabled: !!currentUser,
    persistKey: 'community_config_cache',
  });

  const communityConfig = communityConfigQuery.data || null;

  // 4. Load premium community config
  const premiumConfigQuery = useCachedQuery<any>({
    queryKey: ['communityConfigPremium'],
    queryFn: async () => {
      if (!userProfile?.isPremium) return null;
      const snap = await getDoc(doc(db, 'community_config', 'premium'));
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    },
    enabled: !!currentUser && !!userProfile?.isPremium,
    persistKey: 'community_premium_cache',
  });

  const premiumConfig = premiumConfigQuery.data || null;

  // 5. Subscribe to student's warnings
  const warningsQuery = useCachedQuery<any[]>({
    queryKey: ['studentWarnings', currentUser?.uid || ''],
    queryFn: async () => [],
    enabled: !!currentUser?.uid,
    persistKey: currentUser?.uid ? `student_warnings_cache_${currentUser.uid}` : undefined,
    subscribeFn: (callback) => {
      const qWarnings = query(
        collection(db, 'warnings'),
        or(
          where('uid', '==', currentUser!.uid),
          where('studentId', '==', currentUser!.uid)
        ),
        limit(50)
      );
      return onSnapshot(
        qWarnings,
        (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          callback(list);
        },
        (err) => console.error("Error subscribing to warnings on dashboard:", err)
      );
    }
  });

  const studentWarnings = warningsQuery.data || [];

  // 6. Subscribe to student's leave requests
  const leavesQuery = useCachedQuery<any[]>({
    queryKey: ['studentLeaves', currentUser?.uid || ''],
    queryFn: async () => [],
    enabled: !!currentUser?.uid,
    persistKey: currentUser?.uid ? `student_leaves_cache_${currentUser.uid}` : undefined,
    subscribeFn: (callback) => {
      const qLeaves = query(
        collection(db, 'leaveRequests'),
        or(
          where('uid', '==', currentUser!.uid),
          where('studentId', '==', currentUser!.uid)
        ),
        limit(50)
      );
      return onSnapshot(
        qLeaves,
        (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => new Date(b.requestDate || 0).getTime() - new Date(a.requestDate || 0).getTime());
          callback(list);
        },
        (err) => console.error("Error subscribing to leave requests on dashboard:", err)
      );
    }
  });

  const studentLeaves = leavesQuery.data || [];

  const loading = baseDataQuery.isLoading && !baseDataQuery.data;



  const trackCommunityClick = async (type: 'main' | 'group') => {
    try {
      const globalRef = doc(db, 'community_config', 'global');
      if (type === 'main') {
        await updateDoc(globalRef, { totalClicks: increment(1) });
      } else {
        await updateDoc(globalRef, { totalAttempts: increment(1) });
      }
    } catch (err) {
      console.warn("Analytics tracking skipped:", err);
    }
  };

  const handleGroupMeJoin = async (url: string) => {
    if (!url) return;
    await trackCommunityClick('group');
    
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      const codeMatch = url.match(/\/join\/([^\/?#]+)/);
      if (codeMatch && codeMatch[1]) {
        const code = codeMatch[1];
        const deepLink = `groupme://join/${code}`;
        
        const start = Date.now();
        window.location.href = deepLink;
        
        setTimeout(() => {
          if (Date.now() - start < 2200) {
            window.open(url, '_blank');
          }
        }, 2000);
        return;
      }
    }
    
    window.open(url, '_blank');
  };

  const getTenDaySlots = () => {
    const slots = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const cycleDay = (userProfile as any)?.cycleDay || 1;
    
    // Day 1 of the cycle is today minus (cycleDay - 1) days
    for (let i = 1; i <= 10; i++) {
      const d = new Date();
      // Offset from today: if we are at cycleDay 2, Day 1 is -1, Day 2 is 0, Day 3 is +1
      d.setDate(d.getDate() + (i - cycleDay));
      const dateStr = d.toISOString().split('T')[0];
      
      const foundReport = recentReports.find(r => r.date === dateStr);
      
      let status: 'complete' | 'missed' | 'protected' | 'pending' = 'pending';
      let marks = 0;
      
      if (foundReport) {
        marks = foundReport.marks || 0;
        if (foundReport.status === 'Approved') {
          status = 'complete';
        } else if (foundReport.status === 'Warning') {
          status = 'missed';
        } else if (foundReport.status === 'Protected Day' || foundReport.status === 'Emergency Leave' || (foundReport.status as any) === 'Protected') {
          status = 'protected';
        } else {
          status = 'complete'; 
        }
      } else {
        if (dateStr < todayStr) {
          status = 'missed'; 
        } else {
          status = 'pending'; 
        }
      }
      
      slots.push({
        date: dateStr,
        status,
        label: i === 10 ? 'Protected' : `Day ${i}`,
        marks
      });
    }
    return slots;
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6 max-w-lg mx-auto pb-32 animate-pulse">
        {/* Skeleton Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-32 bg-slate-200 rounded-lg"></div>
            <div className="h-3 w-40 bg-slate-200 rounded"></div>
          </div>
          <div className="h-8 w-24 bg-slate-200 rounded-2xl"></div>
        </div>

        {/* Skeleton Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={`skeleton-dash-grid-${i}`} className="bg-slate-100 p-4 rounded-3xl border border-slate-200/50 flex flex-col items-center space-y-2">
              <div className="w-10 h-10 bg-slate-350 rounded-2xl"></div>
              <div className="w-10 h-2 bg-slate-200 rounded"></div>
              <div className="w-16 h-4 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>

        {/* Skeleton Action Logger */}
        <div className="bg-slate-150 h-20 rounded-[2.5rem] border border-slate-205/50 flex items-center justify-between p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-200 rounded-2xl"></div>
            <div className="space-y-2">
              <div className="w-32 h-3.5 bg-slate-200 rounded"></div>
              <div className="w-48 h-2 bg-slate-200 rounded"></div>
            </div>
          </div>
          <div className="w-20 h-10 bg-slate-250 rounded-2xl"></div>
        </div>

        {/* Skeleton Progress */}
        <div className="bg-slate-100 p-5 rounded-[2.5rem] border border-slate-200/50 space-y-3">
          <div className="w-32 h-3.5 bg-slate-200 rounded"></div>
          <div className="w-full h-3 bg-slate-200 rounded-full"></div>
          <div className="w-56 h-2 bg-slate-200 rounded"></div>
        </div>

        {/* Skeleton Leaderboard */}
        <div className="bg-slate-100 p-5 rounded-[2.5rem] border border-slate-250/30 space-y-3">
          <div className="w-40 h-3.5 bg-slate-250 rounded"></div>
          {[1, 2, 3].map(i => (
            <div key={`skeleton-leaderboard-${i}`} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200">
              <div className="flex gap-2 items-center">
                <div className="w-6 h-6 bg-slate-200 rounded-lg"></div>
                <div className="w-24 h-3 bg-slate-250 rounded"></div>
              </div>
              <div className="w-10 h-3 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="p-4 space-y-3 max-w-lg mx-auto pb-32">
      
      {/* Merged Student Identity & Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] p-6 shadow-xs border border-slate-150 mb-4 relative overflow-hidden"
      >
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
        
        <div className="flex justify-between items-start mb-6 relative z-10">
           <div className="flex items-center space-x-4">
             <div className="relative group">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border-2 border-white flex items-center justify-center shadow-md overflow-hidden transition-transform duration-300">
                    {userProfile?.photoUrl ? (
                      <img src={userProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-slate-300" />
                    )}
                </div>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-2 -right-2 p-1.5 bg-indigo-600 text-white rounded-xl border-2 border-white shadow-md hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                    title="Change Photo"
                >
                    {uploading ? <Loader2 size={10} className="animate-spin"/> : <Camera size={10} />}
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
               <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{userProfile?.name || 'Candidate'}</h2>
               <div className="flex flex-col gap-1 mt-1.5">
                 <div className="flex items-center gap-2">
                   <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                    Batch: {batch?.batchName || batch?.batchCode || 'General'} 
                   </span>
                 </div>
                 <p className="text-[10px] font-mono font-bold text-slate-400">ID: {userProfile ? (userProfile.studentCode || getStudentCode(userProfile)) : 'Awaiting ID'}</p>
               </div>
             </div>
           </div>
           
           {/* Actions: Settings and Logout */}
           <div className="flex gap-1">
            <button 
              onClick={() => setShowSettings(true)} 
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title="Settings"
            >
                <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={handleLogout} 
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              title="Logout"
            >
                <LogOut className="w-5 h-5" />
            </button>
           </div>
        </div>

        {/* Joined Date & Consistency Status Block */}
        <div className="grid grid-cols-2 gap-3 mt-2 relative z-10">
           <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-200/50 flex items-center justify-center text-slate-400 shrink-0">
                 <History size={14} />
               </div>
               <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Joined</p>
                  <p className="text-[11px] font-bold text-slate-700 mt-1">{userProfile?.createdAt ? safeDate(userProfile.createdAt).toLocaleDateString() : 'Awaiting'}</p>
               </div>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-2.5">
               <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                  <UserCheck size={14} />
               </div>
               <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Status</p>
                  <p className="text-[11px] font-black text-emerald-600 mt-1 uppercase leading-none">Active</p>
               </div>
            </div>
         </div>
      </motion.div>

      <MotivationCard />
      
      {/* Premium Engine and Security Profile Panel */}
      <PremiumStatusWidget userProfile={userProfile} />

      <div id="official-notice-board" className="bg-white p-4 rounded-[1.5rem] border border-slate-200/85 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
              <BellRing size={16} />
            </div>
            <div>
              <h3 className="text-[11px] font-black text-slate-900 tracking-tight uppercase">Mentor Guidance</h3>
              <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">Mentor-Student Coordination</p>
            </div>
          </div>
          {(studentWarnings.some(w => w.status === 'Active') || !!userProfile?.restrictedFromSubmitting) && (
            <span className="flex h-2 w-2 relative">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {/* 1. Account status notice if not active */}
          {userProfile?.status && userProfile.status !== 'active' && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              userProfile.status === 'suspended' || userProfile.status === 'blocked'
                ? 'bg-rose-50/50 border-rose-150 text-rose-900'
                : 'bg-amber-50/50 border-amber-150 text-amber-900'
            }`}>
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-[10px] uppercase tracking-wider">Account Status Restriction</p>
                <p className="text-[10px] font-semibold mt-0.5 opacity-90 leading-tight">
                  Your official profile authorization status has been marked as <span className="font-extrabold uppercase">{userProfile.status}</span> by your mentor.
                </p>
              </div>
            </div>
          )}

          {/* 2. Submission Ban Notice */}
          {!!userProfile?.restrictedFromSubmitting && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-150 text-rose-900 flex items-start gap-2.5">
              <Lock className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-extrabold text-[10px] uppercase tracking-wider text-rose-700">Submission Ban Active</p>
                <p className="text-[10px] font-semibold mt-0.5 leading-tight">
                  You are temporarily restricted from checking-in your daily tasks. Please contact your mentor immediately to resolve this block.
                </p>
              </div>
            </div>
          )}

          {/* 3. Warnings / Strikes */}
          {studentWarnings.map((w, idx) => {
            const isActive = w.status === 'Active';
            return (
              <div 
                key={`student-warning-${w.id || idx}`}
                className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all ${
                  isActive 
                    ? 'bg-rose-50/30 border-rose-200 text-rose-950 shadow-sm' 
                    : 'bg-slate-50/50 border-slate-200 text-slate-700'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? 'text-rose-600' : 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-black text-[10px] uppercase tracking-wider ${isActive ? 'text-rose-800' : 'text-slate-600'}`}>
                      {isActive ? '⚠️ Official Warning (Active Strike)' : '✅ Warning Resolved'}
                    </p>
                    <span className="text-[8px] text-slate-400 font-bold shrink-0">
                      {w.date ? new Date(w.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold mt-0.5 leading-tight">
                    Reason: "{w.reason}"
                  </p>
                  <p className="text-[8px] text-slate-400 mt-1 font-bold">
                    Issued by: {w.mentorName || 'Mentor'}
                  </p>
                </div>
              </div>
            );
          })}

          {/* 4. Leave Applications (Instant Approval / Rejection notices) */}
          {studentLeaves.slice(0, 3).map((l, idx) => {
            const isApproved = l.status === 'approved';
            const isRejected = l.status === 'rejected';
            const isPending = l.status === 'pending';
            
            return (
              <div 
                key={`student-leave-${l.id || idx}`}
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  isApproved 
                    ? 'bg-emerald-50/40 border-emerald-150 text-emerald-900' 
                    : isRejected 
                      ? 'bg-rose-50/40 border-rose-150 text-rose-900'
                      : 'bg-amber-50/40 border-amber-150 text-amber-900'
                }`}
              >
                {isApproved ? (
                  <CalendarCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : isRejected ? (
                  <CalendarX className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                ) : (
                  <Calendar className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-black text-[10px] uppercase tracking-wider ${
                      isApproved ? 'text-emerald-800' : isRejected ? 'text-rose-800' : 'text-amber-800'
                    }`}>
                      {isApproved ? 'Leave Approved' : isRejected ? 'Leave Rejected' : 'Leave Request Pending'}
                    </p>
                    <span className="text-[8px] text-slate-400 font-bold shrink-0">
                      {l.requestDate ? new Date(l.requestDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold mt-0.5 leading-tight">
                    Dates: <span className="font-extrabold">{l.startDate}</span> to <span className="font-extrabold">{l.endDate}</span>
                  </p>
                  {l.reason && (
                    <p className="text-[10px] font-medium mt-0.5 leading-snug opacity-85 italic">
                      Reason: "{l.reason}"
                    </p>
                  )}
                  {l.remark && (
                    <div className="mt-1.5 p-1.5 rounded-lg bg-white/60 border border-slate-100 text-[9px]">
                      <span className="font-bold text-slate-500 block text-[8px] uppercase tracking-wider">Mentor Remark:</span>
                      <p className="italic font-medium text-slate-900">"{l.remark}"</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 5. Grace Exemptions */}
          {(!!userProfile?.exemptFromPenalty || !!userProfile?.excusedFromAttendance) && (
            <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-150 text-indigo-900 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-indigo-800">
                <Info size={14} /> Active Grace Considerations
              </div>
              <div className="space-y-1.5 pl-1">
                {!!userProfile?.exemptFromPenalty && (
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-emerald-600 font-bold">✓</span> Auto-Penalty Exemption is Active (Protects consistency history).
                  </div>
                )}
                {!!userProfile?.excusedFromAttendance && (
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-emerald-600 font-bold">✓</span> Long-term Health/Emergency Waiver is Active.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. Normal State (All Quiet) */}
          {studentWarnings.length === 0 && studentLeaves.length === 0 && !userProfile?.restrictedFromSubmitting && !userProfile?.exemptFromPenalty && !userProfile?.excusedFromAttendance && (!userProfile?.status || userProfile.status === 'active') && (
            <div className="p-4 border border-dashed border-slate-200 rounded-2xl text-center">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Profile Status Normal</p>
              <p className="text-[10px] text-slate-400 mt-1">No active warnings, pending leaves, or restrictions on your profile.</p>
            </div>
          )}
        </div>
      </div>


      {/* 2nd: Emergency Leave */}
      <button onClick={() => setShowLeaveModal(true)} className="w-full flex items-center gap-3 p-4 bg-white rounded-3xl border border-indigo-100 shadow-sm text-indigo-700 font-bold text-sm">
         <Calendar size={20} /> Apply for Emergency Leave
      </button>

      {/* Community Card Integration */}
      {(!communityConfig || (communityConfig.showCommunityCard !== false && communityConfig.communityStatus !== 'Disabled')) && (
        <div 
          id="student_community_card"
          className="bg-white p-6 rounded-[2.5rem] border border-indigo-150/50 shadow-xs space-y-4"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0">
              💬
            </div>
            <div className="text-left">
              <h3 className="text-base font-black text-slate-950">
                {communityConfig?.communityName || "Join Our Community"}
              </h3>
              <p className="text-xs text-slate-800 font-semibold leading-relaxed mt-1">
                {communityConfig?.communityDescription || "Connect with fellow MissionGrid aspirants, participate in discussions, receive updates, ask doubts, and stay accountable throughout your preparation journey."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button 
              id="join_community_main_btn"
              onClick={async () => {
                await trackCommunityClick('main');
                setShowJoinModal(true);
              }}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider py-4 rounded-3xl shadow-md hover:shadow-lg hover:shadow-violet-200/40 transition-all flex items-center justify-center gap-1.5 active:scale-95 duration-200"
            >
              Join Community
            </button>
            <button 
              id="community_rules_main_btn"
              onClick={() => setShowRulesModal(true)}
              className="flex-1 bg-slate-50 border border-slate-200 hover:bg-slate-150 transition-colors text-slate-900 text-xs font-black uppercase tracking-wider py-4 rounded-3xl flex items-center justify-center gap-1.5 active:scale-95 duration-200"
            >
              Community Rules
            </button>
          </div>
        </div>
      )}

      {/* Performance Feed Container */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-[2.5rem] p-6 border border-slate-200/60 shadow-xs"
      >
           <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 flex items-center gap-2.5 text-sm uppercase tracking-wider">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full" /> Performance Feed
              </h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reports History</span>
           </div>
           
           <div className="space-y-4">
              {loading && recentReports.length === 0 ? (
                <div className="text-center py-10 animate-pulse text-[10px] font-black text-slate-400">SYNCING FEED...</div>
              ) : recentReports.length === 0 ? (
                <div className="text-center py-10">
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No mission records found</p>
                </div>
              ) : recentReports.slice(0, 10).map((m, idx) => (
                <div key={m.id || m.date || idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100/50 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        m.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 
                        m.status === 'Warning' ? 'bg-rose-50 text-rose-600' :
                        m.status === 'Absent' ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                         {m.status === 'Approved' ? <UserCheck size={18} /> : <Award size={18} />}
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

      {/* Quick Actions */}
      <QuickActionsPanel 
        userProfile={userProfile} 
      />
      
      {showLeaveModal && <ApplyLeaveModal onClose={() => setShowLeaveModal(false)} userProfile={userProfile as User} />}



      </div>

      {/* 1. CHANNEL SELECTION MODAL */}
      <AnimatePresence>
        {showJoinModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 font-sans text-slate-900 leading-normal">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl border border-slate-150 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-950 tracking-tight">Select Community</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Explore Force Channels</p>
                </div>
                <button 
                  onClick={() => setShowJoinModal(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-700"
                >
                  <X size={20} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1">
                {/* Official announcements channel */}
                {(!communityConfig || communityConfig.showOfficialGroup !== false) && (
                  <button
                    onClick={() => {
                      handleGroupMeJoin(communityConfig?.officialGroupLink || "https://groupme.com/join_official_placeholder");
                      setShowJoinModal(false);
                    }}
                    className="w-full p-4 rounded-3xl border border-slate-200 bg-slate-50 hover:bg-violet-50/20 hover:border-violet-300 transition-all flex items-center gap-4 group text-left"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Megaphone size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-black text-slate-950">Official Base Channel</p>
                      <p className="text-[9.5px] text-slate-550 font-semibold leading-normal mt-0.5">Primary announcements, guidelines, daily assignments & evaluations.</p>
                    </div>
                  </button>
                )}

                {/* Discussion group channel */}
                {(!communityConfig || communityConfig.showDiscussionGroup !== false) && (
                  <button
                    onClick={() => {
                      handleGroupMeJoin(communityConfig?.discussionGroupLink || "https://groupme.com/join_discussion_placeholder");
                      setShowJoinModal(false);
                    }}
                    className="w-full p-4 rounded-3xl border border-slate-200 bg-slate-50 hover:bg-violet-50/20 hover:border-violet-300 transition-all flex items-center gap-4 group text-left"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Users size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-black text-slate-950">Study Discussion Forum</p>
                      <p className="text-[9.5px] text-slate-550 font-semibold leading-normal mt-0.5">Discuss daily doubts, share study targets, seek mock review peer advice.</p>
                    </div>
                  </button>
                )}

                {/* Premium Squad Circle channel */}
                {(!communityConfig || communityConfig.showPremiumGroup !== false) && (
                  <>
                    {userProfile?.isPremium ? (
                      <button
                        onClick={() => {
                          handleGroupMeJoin(premiumConfig?.premiumGroupLink || "https://groupme.com/join_premium_placeholder");
                          setShowJoinModal(false);
                        }}
                        className="w-full p-4 rounded-3xl border border-violet-200 bg-violet-50/20 hover:bg-violet-500/10 transition-all flex items-center gap-4 group text-left"
                      >
                        <div className="w-11 h-11 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-lg shrink-0 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                          <Star size={18} className="fill-current" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-black text-violet-900">Premium Squad Circle</p>
                          <p className="text-[9.5px] text-violet-750 font-semibold leading-normal mt-0.5">Exclusive AMAs, priority expert mentor reviews, leak sheets, streak waivers.</p>
                        </div>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowJoinModal(false);
                          setShowPremiumUpgradeModal(true);
                        }}
                        className="w-full p-4 rounded-3xl border border-dashed border-violet-300 bg-violet-50/45 hover:bg-violet-500/10 transition-all flex items-center gap-4 group text-left"
                      >
                        <div className="w-11 h-11 rounded-2xl bg-violet-105 text-violet-650 flex items-center justify-center font-bold text-lg shrink-0">
                          <Shield size={18} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <p className="text-xs font-black text-slate-900">Premium Squad Circle</p>
                            <span className="text-[8px] bg-violet-200 text-violet-850 font-black tracking-widest uppercase px-1.5 py-0.5 rounded-sm">LOCKED</span>
                          </div>
                          <p className="text-[9.5px] text-violet-750 font-bold leading-normal mt-1">Unlock Premium Community Group</p>
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. PREMIUM PERSUASION MODAL */}
      <AnimatePresence>
        {showPremiumUpgradeModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 font-sans text-slate-900">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl border border-slate-150 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-950 tracking-tight">Upgrade Potential</h3>
                  <p className="text-[10px] font-bold text-violet-650 uppercase tracking-widest mt-0.5">Unlock Premium Squad Circle</p>
                </div>
                <button 
                  onClick={() => setShowPremiumUpgradeModal(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-700"
                >
                  <X size={20} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                <div className="p-4 bg-violet-50/40 rounded-3xl border border-violet-100 text-center">
                  <Star size={32} className="text-amber-500 fill-amber-500 mx-auto mb-2 animate-bounce" />
                  <p className="text-xs font-black text-violet-905">Double Your Success Rate</p>
                  <p className="text-[10.5px] text-slate-800 font-semibold leading-relaxed mt-1">
                    Premium candidates get priority support and maintain a 92% consistency index.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">✓</div>
                    <div>
                      <p className="text-xs font-black text-slate-900">Live Mentorship AMA Hub</p>
                      <p className="text-[10px] text-slate-550 font-bold mt-0.5">Solve doubts instantly with Adi Madhu expert coordinators.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">✓</div>
                    <div>
                      <p className="text-xs font-black text-slate-950">Streak Double-Protection</p>
                      <p className="text-[10px] text-slate-550 font-bold mt-0.5">Automatic waivers for authorized emergencies without index penalty.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">✓</div>
                    <div>
                      <p className="text-xs font-black text-slate-900">Elite Material Vaults</p>
                      <p className="text-[10px] text-slate-555 font-bold mt-0.5">Access golden leak sheets, mock question libraries & formula banks.</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl text-center">
                  <p className="text-[9.5px] text-slate-800 font-bold leading-normal uppercase">
                    Connect with your Primary Mentor immediately to upgrade your status to Premium and unlock exclusive squad circles today!
                  </p>
                </div>
              </div>

              <button 
                onClick={() => {
                  alert("Please contact your designated mentor or coordinator to proceed with status elevation.");
                  setShowPremiumUpgradeModal(false);
                }}
                className="w-full mt-6 bg-violet-600 hover:bg-violet-750 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl shadow-md transition-all active:scale-95 duration-200"
              >
                Request Elevation Now
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. RULE REGISTER MODAL */}
      <AnimatePresence>
        {showRulesModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 font-sans text-slate-900">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl border border-slate-150 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-950 tracking-tight">Community Rules</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Conduct Code & Discipline</p>
                </div>
                <button 
                  onClick={() => setShowRulesModal(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-700"
                >
                  <X size={20} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="font-black text-slate-950 flex items-center gap-1.5 uppercase tracking-wide text-[10.5px]">
                      <span className="text-violet-600">1.</span> Strict Focus & Accountability
                    </p>
                    <p className="text-slate-750 font-medium leading-relaxed mt-1">
                      No spamming, promotions, or advertisements allowed. This community is strictly dedicated to ssc and mock study preparations.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="font-black text-slate-950 flex items-center gap-1.5 uppercase tracking-wide text-[10.5px]">
                      <span className="text-violet-600">2.</span> Mutual Growth & Respect
                    </p>
                    <p className="text-slate-750 font-medium leading-relaxed mt-1">
                      Always lift your peers. Respect coordinators and coordinate schedules professionally. Slurs or misbehaviours yield instant bans.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="font-black text-slate-950 flex items-center gap-1.5 uppercase tracking-wide text-[10.5px]">
                      <span className="text-violet-600">3.</span> Daily Output Sharing
                    </p>
                    <p className="text-slate-750 font-medium leading-relaxed mt-1">
                      Share daily mock insights, evaluate notes with accountability peers, and motivate others in our base forum.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="font-black text-slate-950 flex items-center gap-1.5 uppercase tracking-wide text-[10.5px]">
                      <span className="text-violet-600">4.</span> Document Privacy Guard
                    </p>
                    <p className="text-slate-755 font-medium leading-relaxed mt-1">
                      Keep mock materials, coordination tips, and private links within this unit. Sharing outside is standard grounds for dismissal.
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowRulesModal(false)}
                className="w-full mt-6 bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-all active:scale-95 duration-200 hover:bg-slate-850"
              >
                I Understand Rules
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Settings Modal */}
      {showSettings && userProfile && (
          <ProfileSettingsModal 
            userProfile={userProfile as any} 
            onClose={() => setShowSettings(false)} 
            onSaved={() => setShowSettings(false)} 
          />
      )}
    </div>
  );
}
