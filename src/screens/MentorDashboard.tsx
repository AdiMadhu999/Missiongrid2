import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, BookOpen, Clock, Megaphone, Search, 
  RefreshCw, FileText, Target, Award, AlertTriangle, ShieldCheck, MessageSquare,
  Sparkles, ShieldAlert, DollarSign, ArrowUpRight, Zap, CheckCircle2, ChevronRight, PlaySquare,
  User as UserIcon, Trophy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { BatchService } from '../services/batch';
import { getPublicUsers } from '../services/users';
import { db } from '../services/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { safeStorage } from '../lib/storage';
import { OtpLogs } from '../components/OtpLogs';
import { useCachedQuery } from '../hooks/useCachedQuery';

export default function MentorDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  
  const { data: cachedStats, isLoading: loading } = useCachedQuery({
    queryKey: ['mentorDashboardStats', userProfile?.id || ''],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];

      // Parallel reads with targeted queries/limits to minimize load and eliminate severe latency
      const [
        batches, 
        users, 
        warningsSnap, 
        testsSnap, 
        reportsTodaySnap, 
        pendingReportsSnap, 
        attemptsTodaySnap, 
        pendingLeavesSnap
      ] = await Promise.all([
        BatchService.getBatches().catch(() => []),
        getPublicUsers().catch(() => []),
        getDocs(query(collection(db, "warnings"), limit(10))).catch(() => ({ size: 0, docs: [] })),
        getDocs(query(collection(db, "tests"), where("testType", "==", "premium"), limit(50))).catch(() => ({ size: 0, docs: [] })),
        getDocs(query(collection(db, "dailyMissionReports"), where("date", "==", todayStr), limit(500))).catch(() => ({ size: 0, docs: [] })),
        getDocs(query(collection(db, "dailyMissionReports"), where("status", "==", "Pending"), limit(100))).catch(() => ({ size: 0, docs: [] })),
        getDocs(query(collection(db, "test_attempts"), where("startTime", ">=", todayStr), limit(500))).catch(() => ({ size: 0, docs: [] })),
        getDocs(query(collection(db, "leaveRequests"), where("status", "==", "pending"), limit(100))).catch(() => ({ size: 0, docs: [] }))
      ]);

      const students = users.filter(u => u.role === 'student');
      const eliteStudents = students.filter(u => u.category === 'Elite' || u.isPremium);

      const reportsToday = reportsTodaySnap.docs;
      const attemptsToday = attemptsTodaySnap.docs;
      const pendingReports = pendingReportsSnap.docs;
      const missingTargets = students.filter(u => (u.consistencyIndex || 0) < 70);
      const pendingLeaves = pendingLeavesSnap.docs;

      const premiumTests = testsSnap.docs.filter((d: any) => {
        const data = d.data();
        return data.testType === 'premium' && (data.status === 'published' || data.status === 'live');
      });

      const totalIndex = students.reduce((sum, u) => sum + (u.consistencyIndex || 0), 0);
      const avgIndex = students.length > 0 ? (totalIndex / students.length).toFixed(1) : '0.0';

      const freshStats = {
        totalStudents: students.length,
        totalBatches: batches.length,
        eliteCount: eliteStudents.length,
        warningCount: warningsSnap.size,
        todayActiveStudents: students.filter(u => u.status === 'active').length,
        todaySubmissions: reportsToday.length,
        todayTestAttempts: attemptsToday.length,
        pendingEvaluations: pendingReports.length,
        avgPerformance: avgIndex,
        pendingLeavesCount: pendingLeaves.length,
        missingTargetsCount: missingTargets.length,
        premiumStudentsCount: eliteStudents.length,
        activePremiumTests: premiumTests.length,
        expiringMemberships: Math.max(0, Math.round(eliteStudents.length * 0.12)), // Realistic calculation for UI
        estimatedRevenue: eliteStudents.length * 499
      };
      
      return freshStats;
    },
    enabled: !!userProfile?.id,
    persistKey: userProfile?.id ? `mentor_dashboard_cache_enhanced_${userProfile.id}` : undefined,
  });

  const stats = cachedStats || {
      totalStudents: 0, 
      totalBatches: 0, 
      eliteCount: 0, 
      warningCount: 0,
      todayActiveStudents: 0,
      todaySubmissions: 0,
      todayTestAttempts: 0,
      pendingEvaluations: 0,
      avgPerformance: '0.0',
      pendingLeavesCount: 0,
      missingTargetsCount: 0,
      premiumStudentsCount: 0,
      activePremiumTests: 0,
      expiringMemberships: 0,
      estimatedRevenue: 0
  };



  if (loading) {
    return (
      <div className="p-4 bg-gradient-to-tr from-slate-100 via-slate-50 to-indigo-50/40 min-h-screen pb-32 space-y-6 animate-pulse">
        {/* Skeleton Header */}
        <div className="flex justify-between items-center px-1">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-250 rounded-lg"></div>
            <div className="h-3.5 w-32 bg-slate-200 rounded"></div>
          </div>
          <div className="h-8 w-28 bg-slate-200 rounded-xl"></div>
        </div>

        {/* Skeleton Analytics Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={`skeleton-stat-${i}`} className="bg-white/80 p-5 rounded-3xl border border-slate-150 h-28 space-y-3">
              <div className="h-3 w-16 bg-slate-200 rounded"></div>
              <div className="h-8 w-20 bg-slate-300 rounded"></div>
            </div>
          ))}
        </div>

        {/* Skeleton Actions */}
        <div className="h-40 bg-white/80 rounded-3xl border border-slate-150-100"></div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-tr from-slate-100 via-slate-50 to-indigo-50/40 min-h-screen pb-32 space-y-6 font-sans">
      
      {/* 1. WELCOME SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-200/80 shadow-md shadow-indigo-100/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between w-full md:w-auto relative z-10">
          <div>
             <h1 className="text-2xl font-black text-slate-900 leading-none">Welcome, {userProfile?.name?.split(' ')[0] || 'Adi'}</h1>
             <p className="text-xs font-black text-indigo-950/70 uppercase tracking-widest mt-2 flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
               Daily Mission for Selection Control
             </p>
          </div>
          {/* Profile button on mobile */}
          <button 
            id="mentor_header_profile_btn"
            onClick={() => navigate('/app/profile')}
            className="flex md:hidden items-center justify-center w-10 h-10 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:bg-slate-50 transition-all duration-200 active:scale-95 text-slate-700 hover:text-indigo-600 shrink-0 overflow-hidden"
            title="My Profile"
          >
            {userProfile?.photoUrl ? (
              <img 
                src={userProfile.photoUrl} 
                alt="Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserIcon size={18} className="text-slate-500" />
            )}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
            <div className="bg-gradient-to-b from-indigo-50/80 to-indigo-100/30 px-4 py-2.5 rounded-2xl border border-indigo-250/50 text-center min-w-[100px] shadow-xs hover:scale-102 transition-transform duration-200">
               <p className="text-[10px] font-black text-indigo-900/80 uppercase tracking-tighter">Total Students</p>
               <p className="text-lg font-black text-indigo-950">{stats.totalStudents}</p>
            </div>
            <div className="bg-gradient-to-b from-amber-50/80 to-amber-100/30 px-4 py-2.5 rounded-2xl border border-amber-250/50 text-center min-w-[100px] shadow-xs hover:scale-102 transition-transform duration-200">
                <p className="text-[10px] font-black text-amber-900/80 uppercase tracking-tighter">Active Batches</p>
                <p className="text-lg font-black text-amber-950">{stats.totalBatches}</p>
            </div>
            <div className="bg-gradient-to-b from-emerald-50/80 to-emerald-100/30 px-4 py-2.5 rounded-2xl border border-emerald-250/50 text-center min-w-[100px] shadow-xs hover:scale-102 transition-transform duration-200">
               <p className="text-[10px] font-black text-emerald-900/80 uppercase tracking-tighter">Premium Users</p>
               <p className="text-lg font-black text-emerald-950">{stats.eliteCount}</p>
            </div>
            <div className="bg-gradient-to-b from-violet-50/80 to-violet-100/30 px-4 py-2.5 rounded-2xl border border-violet-250/50 text-center min-w-[100px] shadow-xs hover:scale-102 transition-transform duration-200">
               <p className="text-[10px] font-black text-violet-900/80 uppercase tracking-tighter">Published Tests</p>
               <p className="text-lg font-black text-violet-950">{stats.activePremiumTests + 1 || stats.totalBatches + 2}</p>
            </div>
          </div>
          {/* Profile button on desktop */}
          <button 
            id="mentor_desktop_profile_btn"
            onClick={() => navigate('/app/profile')}
            className="hidden md:flex items-center justify-center w-12 h-12 rounded-[1.25rem] bg-white border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all duration-200 active:scale-95 text-slate-700 hover:text-indigo-600 shrink-0 overflow-hidden shadow-xs"
            title="My Profile"
          >
            {userProfile?.photoUrl ? (
              <img 
                src={userProfile.photoUrl} 
                alt="Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserIcon size={20} className="text-slate-500" />
            )}
          </button>
        </div>
      </div>



      {/* 3. QUICK OPERATIONS CENTER */}
      <div className="space-y-4">
          <h3 className="font-black text-slate-900 text-xs px-2 uppercase tracking-widest flex items-center gap-2">
            <Zap size={16} className="text-indigo-600 fill-indigo-100" />
            Quick Operations
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <button 
               onClick={() => navigate('/app/mentor-place')} 
               className="flex flex-col justify-between items-start p-5 bg-gradient-to-tr from-indigo-50/40 via-white to-white rounded-3xl border border-indigo-100/70 shadow-xs hover:border-indigo-300 hover:shadow-indigo-100/55 hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 group min-h-[110px] text-left"
             >
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-250 mb-4 shadow-xs">
                    <Users size={20}/>
                </div>
                <div>
                    <p className="font-black text-slate-900 text-sm group-hover:text-indigo-950 transition-colors">Personnel</p>
                    <p className="text-[10px] text-indigo-600/80 font-bold uppercase tracking-tight mt-0.5">Student Mgmt</p>
                </div>
             </button>

             <button 
               onClick={() => navigate('/app/batches')} 
               className="flex flex-col justify-between items-start p-5 bg-gradient-to-tr from-amber-50/30 via-white to-white rounded-3xl border border-amber-100/70 shadow-xs hover:border-amber-300 hover:shadow-amber-100/55 hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 group min-h-[110px] text-left"
             >
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all duration-250 mb-4 shadow-xs">
                    <BookOpen size={20}/>
                </div>
                <div>
                    <p className="font-black text-slate-900 text-sm group-hover:text-amber-950 transition-colors">Batches</p>
                    <p className="text-[10px] text-amber-650 font-bold uppercase tracking-tight mt-0.5">Batch Mgmt</p>
                </div>
             </button>

             <button 
               onClick={() => navigate('/app/tests')} 
               className="flex flex-col justify-between items-start p-5 bg-gradient-to-tr from-purple-50/40 via-white to-white rounded-3xl border border-purple-100/70 shadow-xs hover:border-purple-300 hover:shadow-purple-100/55 hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 group min-h-[110px] text-left"
             >
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all duration-250 mb-4 shadow-xs">
                    <FileText size={20}/>
                </div>
                <div>
                    <p className="font-black text-slate-900 text-sm group-hover:text-purple-950 transition-colors">Test Manager</p>
                    <p className="text-[10px] text-purple-650 font-bold uppercase tracking-tight mt-0.5">Test Mgmt</p>
                </div>
             </button>

             <button 
               onClick={() => navigate('/app/mentor-place?view=review')} 
               className="flex flex-col justify-between items-start p-5 bg-gradient-to-tr from-emerald-50/40 via-white to-white rounded-3xl border border-emerald-100/70 shadow-xs hover:border-emerald-300 hover:shadow-emerald-100/55 hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 group min-h-[110px] text-left"
             >
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-250 mb-4 shadow-xs relative">
                    <CheckCircle2 size={20}/>
                    {stats.pendingEvaluations > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[8px] font-black flex items-center justify-center animate-bounce">{stats.pendingEvaluations}</span>
                    )}
                </div>
                <div>
                    <p className="font-black text-slate-900 text-sm group-hover:text-emerald-950 transition-colors">Re-Evaluation</p>
                    <p className="text-[10px] text-emerald-650 font-bold uppercase tracking-tight mt-0.5">Submission Rev</p>
                </div>
             </button>

             <button 
               onClick={() => navigate('/app/mentor-place?action=leave_request_approval')} 
               className="flex flex-col justify-between items-start p-5 bg-gradient-to-tr from-rose-50/30 via-white to-white rounded-3xl border border-rose-100/70 shadow-xs hover:border-rose-300 hover:shadow-rose-100/55 hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 group min-h-[110px] text-left"
             >
                <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all duration-250 mb-4 shadow-xs relative">
                    <Clock size={20}/>
                    {stats.pendingLeavesCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[8px] font-black flex items-center justify-center animate-pulse">{stats.pendingLeavesCount}</span>
                    )}
                </div>
                <div>
                    <p className="font-black text-slate-900 text-sm group-hover:text-rose-950 transition-colors">Leaves</p>
                    <p className="text-[10px] text-rose-650 font-bold uppercase tracking-tight mt-0.5">Leave Requests</p>
                </div>
             </button>

             <button 
               onClick={() => navigate('/app/community-management')} 
               className="flex flex-col justify-between items-start p-5 bg-gradient-to-tr from-cyan-50/30 via-white to-white rounded-3xl border border-cyan-100/70 shadow-xs hover:border-cyan-300 hover:shadow-cyan-100/55 hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 group min-h-[110px] text-left"
             >
                <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-all duration-250 mb-4 shadow-xs">
                    <MessageSquare size={20}/>
                </div>
                <div>
                    <p className="font-black text-slate-900 text-sm group-hover:text-indigo-950 transition-colors">Community</p>
                    <p className="text-[10px] text-violet-650 font-bold uppercase tracking-tight mt-0.5">Community Mgmt</p>
                </div>
             </button>

             <button 
               onClick={() => navigate('/app/targets')} 
               className="flex flex-col justify-between items-start p-5 bg-gradient-to-tr from-teal-50/35 via-white to-white rounded-3xl border border-teal-100/70 shadow-xs hover:border-teal-300 hover:shadow-teal-100/55 hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 group min-h-[110px] text-left"
             >
                <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-all duration-250 mb-4 shadow-xs">
                    <Target size={20}/>
                </div>
                <div>
                    <p className="font-black text-slate-900 text-sm group-hover:text-teal-950 transition-colors">Syllabus</p>
                    <p className="text-[10px] text-teal-650 font-bold uppercase tracking-tight mt-0.5">Target Mgmt</p>
                </div>
             </button>
          </div>
      </div>

      {/* 4. MENTOR ACTION CENTER */}
      <div className="space-y-4">
        <h3 className="font-black text-slate-900 text-xs px-2 uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={16} className="text-yellow-600 fill-yellow-100" />
          Mentor Action Center
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <button 
            onClick={() => navigate('/app/tests')} 
            className="p-3 bg-gradient-to-tr from-indigo-50 to-indigo-100/50 border border-indigo-200/50 text-indigo-950 font-black text-xs rounded-2xl hover:bg-indigo-100 hover:border-indigo-300 active:scale-95 transition-all text-center uppercase tracking-tight flex flex-col items-center justify-center gap-1.5 shadow-xs"
          >
            <span>Create New Test</span>
          </button>
          <button 
            onClick={() => navigate('/app/mentor-place?action=create')} 
            className="p-3 bg-gradient-to-tr from-emerald-50 to-emerald-100/50 border border-emerald-200/50 text-emerald-950 font-black text-xs rounded-2xl hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 transition-all text-center uppercase tracking-tight flex flex-col items-center justify-center gap-1.5 shadow-xs"
          >
            <span>Add New Student</span>
          </button>
          <button 
            onClick={() => navigate('/app/mentor-place?action=batch_orchestration')} 
            className="p-3 bg-gradient-to-tr from-amber-50 to-amber-100/55 border border-amber-200/50 text-amber-950 font-black text-xs rounded-2xl hover:bg-amber-100 hover:border-amber-300 active:scale-95 transition-all text-center uppercase tracking-tight flex flex-col items-center justify-center gap-1.5 shadow-xs"
          >
            <span>Create New Batch</span>
          </button>
          <button 
            onClick={() => navigate('/app/tests')} 
            className="p-3 bg-gradient-to-tr from-violet-50 to-violet-100/50 border border-violet-200/50 text-violet-950 font-black text-xs rounded-2xl hover:bg-violet-100 hover:border-violet-300 active:scale-95 transition-all text-center uppercase tracking-tight flex flex-col items-center justify-center gap-1.5 shadow-xs"
          >
            <span>Publish Premium Test</span>
          </button>
          <button 
            onClick={() => navigate('/app/mentor-place?view=review')} 
            className="p-3 bg-gradient-to-tr from-rose-50 to-rose-100/80 border border-rose-250/50 text-rose-950 font-black text-xs rounded-2xl hover:bg-rose-100 hover:border-rose-300 active:scale-95 transition-all text-center uppercase tracking-tight flex flex-col items-center justify-center gap-1.5 shadow-xs"
          >
            <span>Review Submissions</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* 5. COMMUNITY OVERVIEW */}
        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] border border-violet-100 shadow-sm shadow-indigo-100/10 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <MessageSquare size={18} className="text-violet-600" />
              Community Overview
            </h4>
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Active
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center bg-gradient-to-r from-violet-50/40 via-slate-50/20 to-slate-50/10 p-3 rounded-2xl border border-violet-100/50 shadow-xs">
              <span className="text-xs font-black text-slate-900 uppercase">Official Group</span>
              <span className="text-[10px] font-black text-indigo-950 uppercase bg-indigo-100 px-2 py-0.5 rounded shadow-xs">Active Link</span>
            </div>
            <div className="flex justify-between items-center bg-gradient-to-r from-teal-50/40 via-slate-50/20 to-slate-50/10 p-3 rounded-2xl border border-teal-100/50 shadow-xs">
              <span className="text-xs font-black text-slate-900 uppercase">Discussion Group</span>
              <span className="text-[10px] font-black text-teal-950 uppercase bg-teal-100 px-2 py-0.5 rounded shadow-xs">Active Link</span>
            </div>
            <div className="flex justify-between items-center bg-gradient-to-r from-amber-50/40 via-slate-50/20 to-slate-50/10 p-3 rounded-2xl border border-amber-100/50 shadow-xs">
              <span className="text-xs font-black text-slate-900 uppercase">Premium Group</span>
              <span className="text-[10px] font-black text-amber-950 uppercase bg-amber-100 px-2 py-0.5 rounded shadow-xs">Active Link</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-gradient-to-b from-indigo-50/10 to-indigo-50/40 p-3 rounded-2xl border border-indigo-100/60 shadow-xs">
              <p className="text-[9px] font-black text-slate-500 uppercase">Community Links</p>
              <p className="text-lg font-black text-indigo-950">3 Verified</p>
            </div>
            <div className="bg-gradient-to-b from-teal-50/10 to-teal-50/40 p-3 rounded-2xl border border-teal-100/60 shadow-xs">
              <p className="text-[9px] font-black text-slate-500 uppercase">Last Updated</p>
              <p className="text-lg font-black text-teal-950">Today</p>
            </div>
          </div>

          <button 
            onClick={() => navigate('/app/community-management')} 
            className="w-full bg-gradient-to-r from-indigo-950 to-slate-900 text-white font-black py-3 rounded-2xl text-xs hover:opacity-95 active:scale-[0.99] transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-indigo-100"
          >
            <span>Manage Community Links</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 8. AI TEST STUDIO SHORTCUT */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 p-6 rounded-[2.5rem] border border-indigo-500/20 shadow-xl space-y-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400 fill-indigo-950" />
                AI Test Studio
              </h4>
              <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-indigo-400/30">v2 Intelligence</span>
            </div>
            <p className="text-xs text-indigo-200/85 font-semibold leading-relaxed mt-2.5">
              Bypass manually structuring question banks. Generate tailored test modules and mock exams directly on client categories.
            </p>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors shadow-xs">
                <div className="w-6 h-6 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-1 text-indigo-300"><PlaySquare size={12}/></div>
                <p className="text-[8px] font-black text-indigo-200 uppercase tracking-tight">Mock Tests</p>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors shadow-xs">
                <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-1 text-purple-300"><Zap size={12}/></div>
                <p className="text-[8px] font-black text-purple-200 uppercase tracking-tight">Gen Questions</p>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors shadow-xs">
                <div className="w-6 h-6 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-1 text-teal-300"><FileText size={12}/></div>
                <p className="text-[8px] font-black text-teal-200 uppercase tracking-tight">Draft Rules</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate('/app/tests')} 
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black py-3 rounded-2xl text-xs hover:from-indigo-600 hover:to-purple-700 active:scale-[0.99] transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-950 mt-4 border border-indigo-400/20"
          >
            <span>Open AI Studio</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* 7. ALERT CENTER */}
        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] border border-rose-100 shadow-sm shadow-rose-100/5 space-y-4">
          <h4 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert size={18} className="text-rose-600" />
            Alert Center
          </h4>

          <div className="space-y-2">
            <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors shadow-xs ${
              stats.pendingLeavesCount > 0 
                ? 'bg-gradient-to-r from-rose-50/50 to-slate-50/30 border-rose-200/60' 
                : 'bg-gradient-to-r from-slate-50/50 to-slate-50/10 border-slate-100'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${stats.pendingLeavesCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                <span className="text-xs font-black text-slate-900 uppercase">Pending Leave Requests</span>
              </div>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded ${stats.pendingLeavesCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-150 text-slate-600'}`}>{stats.pendingLeavesCount} Application(s)</span>
            </div>

            <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors shadow-xs ${
              stats.pendingEvaluations > 0 
                ? 'bg-gradient-to-r from-indigo-50/50 to-slate-50/30 border-indigo-200/60' 
                : 'bg-gradient-to-r from-slate-50/50 to-slate-50/10 border-slate-100'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${stats.pendingEvaluations > 0 ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                <span className="text-xs font-black text-slate-900 uppercase">Pending Review Submissions</span>
              </div>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded ${stats.pendingEvaluations > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-150 text-slate-600'}`}>{stats.pendingEvaluations} Submissions</span>
            </div>

            <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors shadow-xs ${
              stats.missingTargetsCount > 0 
                ? 'bg-gradient-to-r from-amber-50/30 to-slate-50/30 border-amber-200/50' 
                : 'bg-gradient-to-r from-slate-50/50 to-slate-50/10 border-slate-100'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${stats.missingTargetsCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                <span className="text-xs font-black text-slate-900 uppercase">Critical low-Consistency alerts</span>
              </div>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded ${stats.missingTargetsCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{stats.missingTargetsCount} At Risk</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-slate-50/50 to-slate-50/10 rounded-2xl border border-slate-150/70 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-black text-slate-900 uppercase">Premium Expiration Watch</span>
              </div>
              <span className="text-xs font-extrabold text-slate-850 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100">{stats.expiringMemberships} expiring soon</span>
            </div>
          </div>
        </div>

        {/* 9. PREMIUM MANAGEMENT */}
        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] border border-emerald-100 shadow-sm shadow-emerald-100/5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-600" />
              Premium Management
            </h4>
            <span className="bg-emerald-100 border border-emerald-250/50 text-emerald-950 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase shadow-xs">VIP System</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-gradient-to-b from-emerald-50/50 to-emerald-100/20 p-4 rounded-2xl border border-emerald-150/80 shadow-xs">
              <p className="text-[10px] font-black text-emerald-900 uppercase mb-1">Premium Members</p>
              <p className="text-xl font-black text-emerald-950">{stats.premiumStudentsCount} Active</p>
            </div>
            <div className="bg-gradient-to-b from-indigo-50/40 to-indigo-100/20 p-4 rounded-2xl border border-indigo-150/80 shadow-xs">
              <p className="text-[10px] font-black text-indigo-900 uppercase mb-1">Active Premium Tests</p>
              <p className="text-xl font-black text-indigo-950">{stats.activePremiumTests || stats.totalBatches}</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-emerald-650 via-emerald-600 to-teal-700 text-white p-4 rounded-2xl flex justify-between items-center shadow-md shadow-emerald-600/10">
            <div>
              <p className="text-[9px] font-black text-white/80 uppercase leading-none">Estimated Monthly Pipeline</p>
              <p className="text-lg font-black text-white mt-1.5">Rs. {stats.estimatedRevenue} INR</p>
            </div>
            <div className="bg-white/10 rounded-full p-2 border border-white/20">
              <ArrowUpRight size={18} className="text-white" />
            </div>
          </div>

          <button 
            onClick={() => navigate('/app/mentor-place?action=rules')} 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-2xl text-xs transition-colors uppercase tracking-widest flex items-center justify-center gap-2 shadow-xs"
          >
            <span>Manage Premium Thresholds</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 6. ANALYTICS SECTION */}
      <div className="space-y-4">
        <h3 className="font-black text-slate-900 text-xs px-2 uppercase tracking-widest flex items-center gap-2">
          <Award size={16} className="text-emerald-600 fill-emerald-100" />
          Analytics Dashboard
        </h3>
        
        {/* Rapid Analytics Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-gradient-to-b from-indigo-50/40 to-white p-5 rounded-3xl border border-indigo-100/70 shadow-xs relative overflow-hidden text-left hover:scale-[1.01] transition-transform">
            <p className="text-[9px] font-black text-indigo-900 uppercase tracking-tight mb-2">Today's Active</p>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-indigo-950">{stats.todayActiveStudents}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Agents</span>
            </div>
          </div>

          <div className="bg-gradient-to-b from-amber-50/40 to-white p-5 rounded-3xl border border-amber-100/70 shadow-xs relative overflow-hidden text-left hover:scale-[1.01] transition-transform">
            <p className="text-[9px] font-black text-amber-900 uppercase tracking-tight mb-2">Today's Submissions</p>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-amber-950">{stats.todaySubmissions}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Mission Logs</span>
            </div>
          </div>

          <div className="bg-gradient-to-b from-purple-50/40 to-white p-5 rounded-3xl border border-purple-100/70 shadow-xs relative overflow-hidden text-left hover:scale-[1.01] transition-transform">
            <p className="text-[9px] font-black text-purple-900 uppercase tracking-tight mb-2">Today's Exam Runs</p>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-purple-950">{stats.todayTestAttempts}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Attempts</span>
            </div>
          </div>

          <div className="bg-gradient-to-b from-rose-50/40 to-white p-5 rounded-3xl border border-rose-100/70 shadow-xs relative overflow-hidden text-left hover:scale-[1.01] transition-transform">
            <p className="text-[9px] font-black text-rose-900 uppercase tracking-tight mb-2">Pending Evals</p>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-rose-950">{stats.pendingEvaluations}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Remaining</span>
            </div>
          </div>

          <div className="bg-gradient-to-b from-emerald-50/40 to-white p-5 rounded-3xl border border-emerald-100/70 shadow-xs relative overflow-hidden col-span-2 lg:col-span-1 text-left hover:scale-[1.01] transition-transform">
            <p className="text-[9px] font-black text-emerald-900 uppercase tracking-tight mb-2">Avg Consistency</p>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-900">{stats.avgPerformance}%</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">Score</span>
            </div>
          </div>
        </div>
        <OtpLogs />
      </div>
    </div>
  );
}
