import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Users, User as UserIcon, UserCheck, Shield, HelpCircle, RefreshCw, Flame, Target, Star, BarChart3, ClipboardCheck, Calendar, Megaphone, X, MessageSquare, Volume2, Play, Pause, Check, Trophy, Award, AlertTriangle, CalendarCheck, CalendarX, Info, Lock, ShieldAlert, BellRing, Settings, LogOut, Camera, Loader2, History, Clock } from 'lucide-react';
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
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  const uId = userProfile?.id || '';

  const handleLogout = async () => {
    await logout();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uploadId = userProfile?.id;
    if (!file || !uploadId) return;

    setUploading(true);
    try {
        const { url } = await TargetService.uploadFile(file, `profiles/${uploadId}`);
        await updateUserProfile(uploadId, { photoUrl: url });
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
    persistKey: uId ? `student_dashboard_base_cache_${uId}` : undefined,
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
    persistKey: uId ? `student_metrics_cache_${uId}` : undefined,
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
  const reportsQuery = useCachedQuery<DailyMissionReport[]>({
    queryKey: ['studentReports', uId],
    queryFn: async () => [],
    enabled: !!currentUser && !!uId,
    persistKey: uId ? `student_reports_cache_${uId}` : undefined,
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
    queryKey: ['studentWarnings', uId || ''],
    queryFn: async () => [],
    enabled: !!uId,
    persistKey: uId ? `student_warnings_cache_${uId}` : undefined,
    subscribeFn: (callback) => {
      const qWarnings = query(collection(db, 'warnings'), where('studentId', '==', uId), limit(50));
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
    queryKey: ['studentLeaves', uId || ''],
    queryFn: async () => [],
    enabled: !!uId,
    persistKey: uId ? `student_leaves_cache_${uId}` : undefined,
    subscribeFn: (callback) => {
      const qLeaves = query(collection(db, 'leaveRequests'), where('studentId', '==', uId), limit(50));
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

      {/* Bengali Guide Section */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-[2.5rem] p-6 shadow-sm border border-indigo-100/50 relative overflow-hidden mb-4 mt-4">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400 rounded-full blur-[60px] opacity-20" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-400 rounded-full blur-[60px] opacity-20" />
        
        <h2 className="text-lg font-black text-slate-900 mb-5 flex items-center gap-2 relative z-10">
          <span className="text-xl">🌟</span> ছাত্র গাইডলাইন (সম্পূর্ণ গাইড)
        </h2>

        <div className="space-y-4 relative z-10">
          {/* A. Mission submission rule */}
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-3xl border border-indigo-100 shadow-sm flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
              ১
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">মিশন সাবমিশন নিয়ম (Mission Submission)</h3>
              <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                Premium সুবিধা বজায় রাখতে হলে প্রতিদিনের Mission নিয়মিত সম্পন্ন করে Submission করতে হবে।
              </p>
            </div>
          </div>

          {/* B. 10 days compliance rule */}
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-3xl border border-blue-100 shadow-sm flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
              ২
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">১০ দিনের কমপ্লায়েন্স (10 Days Compliance)</h3>
              <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                যদি কোনো শিক্ষার্থী টানা ১০ দিন Mission Submission না করেন, তাহলে তিনি তার Premium Access হারাবেন।
              </p>
            </div>
          </div>

          {/* C. Leave rule */}
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-3xl border border-amber-100 shadow-sm flex gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
              ৩
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">ছুটির নিয়ম (Leave Rule)</h3>
              <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                প্রয়োজনে ড্যাশবোর্ডের Quick Actions থেকে "Apply for Emergency Leave" ব্যবহার করে ছুটির আবেদন করতে পারবেন।
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Student Day Workflow Visual */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 mb-4 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[80px] opacity-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500 rounded-full blur-[80px] opacity-10" />
        
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-5 relative z-10">
          <span className="text-lg">🗺️</span> Student Day Workflow
        </h2>
        
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[1.125rem] before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-200 before:via-pink-200 before:to-rose-100 z-10">
          
          {/* Step 1 */}
          <div className="relative flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-indigo-500 border-4 border-white shadow-sm flex items-center justify-center text-white shrink-0 z-10 relative">
              <Target size={14} />
            </div>
            <div className="flex-1 bg-gradient-to-br from-indigo-50/80 to-white p-3 rounded-2xl border border-indigo-100/50 shadow-sm flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div>
                <h4 className="font-bold text-indigo-950 text-xs">Start Your Day</h4>
                <p className="text-[10px] text-indigo-700/80 font-semibold">Check your mission & start preparing</p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-emerald-500 border-4 border-white shadow-sm flex items-center justify-center text-white shrink-0 z-10 relative">
              <BookOpen size={14} />
            </div>
            <div className="flex-1 bg-gradient-to-br from-emerald-50/80 to-white p-3 rounded-2xl border border-emerald-100/50 shadow-sm flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div>
                <h4 className="font-bold text-emerald-950 text-xs">Attempt Test</h4>
                <p className="text-[10px] text-emerald-700/80 font-semibold">Practice what you prepared</p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-amber-500 border-4 border-white shadow-sm flex items-center justify-center text-white shrink-0 z-10 relative">
              <Clock size={14} />
            </div>
            <div className="flex-1 bg-gradient-to-br from-amber-50/80 to-white p-3 rounded-2xl border border-amber-100/50 shadow-sm flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div>
                <h4 className="font-bold text-amber-950 text-xs">Deep Work</h4>
                <p className="text-[10px] text-amber-700/80 font-semibold">Use focus timer for study sessions</p>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="relative flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-pink-500 border-4 border-white shadow-sm flex items-center justify-center text-white shrink-0 z-10 relative">
              <HelpCircle size={14} />
            </div>
            <div className="flex-1 bg-gradient-to-br from-pink-50/80 to-white p-3 rounded-2xl border border-pink-100/50 shadow-sm flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div>
                <h4 className="font-bold text-pink-950 text-xs">Have a Doubt?</h4>
                <p className="text-[10px] text-pink-700/80 font-semibold">Ask mentor privately or publicly</p>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="relative flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-violet-500 border-4 border-white shadow-sm flex items-center justify-center text-white shrink-0 z-10 relative">
              <Users size={14} />
            </div>
            <div className="flex-1 bg-gradient-to-br from-violet-50/80 to-white p-3 rounded-2xl border border-violet-100/50 shadow-sm flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div>
                <h4 className="font-bold text-violet-950 text-xs">Discussion & Guide</h4>
                <p className="text-[10px] text-violet-700/80 font-semibold">Discuss preparation & check guides</p>
              </div>
            </div>
          </div>

          {/* Step 6 */}
          <div className="relative flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-blue-500 border-4 border-white shadow-sm flex items-center justify-center text-white shrink-0 z-10 relative">
              <ClipboardCheck size={14} />
            </div>
            <div className="flex-1 bg-gradient-to-br from-blue-50/80 to-white p-3 rounded-2xl border border-blue-100/50 shadow-sm flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div>
                <h4 className="font-bold text-blue-950 text-xs">Mission Report</h4>
                <p className="text-[10px] text-blue-700/80 font-semibold">Submit your daily mission report</p>
              </div>
            </div>
          </div>

          {/* Step 7 */}
          <div className="relative flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-teal-500 border-4 border-white shadow-sm flex items-center justify-center text-white shrink-0 z-10 relative">
              <Check size={14} />
            </div>
            <div className="flex-1 bg-gradient-to-br from-teal-50/80 to-white p-3 rounded-2xl border border-teal-100/50 shadow-sm flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div>
                <h4 className="font-bold text-teal-950 text-xs">Target Complete</h4>
                <p className="text-[10px] text-teal-700/80 font-semibold">Mark your target as completed</p>
              </div>
            </div>
          </div>

          {/* Step 8 */}
          <div className="relative flex items-start gap-4 pt-2">
            <div className="w-9 h-9 rounded-full bg-rose-500 border-4 border-white shadow-sm flex items-center justify-center text-white shrink-0 z-10 relative">
              <CalendarX size={14} />
            </div>
            <div className="flex-1 bg-gradient-to-br from-rose-50/80 to-white p-3 rounded-2xl border border-rose-100/50 shadow-sm flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div>
                <h4 className="font-bold text-rose-950 text-xs">Unable to Study?</h4>
                <p className="text-[10px] text-rose-700/80 font-semibold">Apply for emergency leave</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="text-center pb-8 pt-4 space-y-1">
        <p className="text-[12px] text-slate-600 font-extrabold italic">"কঠোর পরিশ্রম আর অধ্যবসায়ই সফলতার একমাত্র চাবিকাঠি।"</p>
        <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">MissionGrid by Adi Madhu</p>
      </div>
      
      {showLeaveModal && <ApplyLeaveModal onClose={() => setShowLeaveModal(false)} userProfile={userProfile as User} />}

      </div>

      {/* 1. CHANNEL SELECTION MODAL */}
      <AnimatePresence>
        {showJoinModal && (
          <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[110] p-4 font-sans text-slate-900 leading-normal">
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
          <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[110] p-4 font-sans text-slate-900">
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
          <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[110] p-4 font-sans text-slate-900">
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
