import React from 'react';
import { Calendar, Crown, Sparkles, Smartphone, Shield, User, Globe, Laptop, ArrowUpCircle, Award } from 'lucide-react';
import { motion } from 'motion/react';
import { useSystemSettings } from '../../hooks/useSystemSettings';

interface PremiumStatusWidgetProps {
  userProfile: any;
}

export function PremiumStatusWidget({ userProfile }: PremiumStatusWidgetProps) {
  if (!userProfile) return null;

  const { data: systemSettings } = useSystemSettings();

  const isActivePremium = !!userProfile.isPremium;
  const premiumStatus = userProfile.premiumStatus || (isActivePremium ? 'PREMIUM' : 'FREE');
  
  const calculateRemainingDays = (expiryStr: string) => {
    if (!expiryStr) return 0;
    const expiryDate = new Date(expiryStr);
    const now = new Date();
    // Reset to start of day for accurate day counting
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiryMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
    const diffTime = expiryMidnight.getTime() - nowMidnight.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };
  
  const remainingDays = calculateRemainingDays(userProfile.premiumExpiryDate);

  const formatWithFallback = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="premium-status-widget" className="bg-slate-900 text-slate-100 rounded-[2.5rem] p-6 shadow-xl border border-slate-800 overflow-hidden relative">
      {/* Background Glow Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-slate-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header Section */}
      <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Award className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">MissionGrid Identity & Verification</span>
            <h3 className="text-lg font-black text-white tracking-tight">STUDENT IDENTITY CARD</h3>
          </div>
        </div>

        {/* Account Status Badge */}
        <div className="flex items-center gap-2">
          <span className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Verified Student
          </span>
        </div>
      </div>

      {/* Card Content Grid */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
        {/* Left Column: Student Details */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">Student Name</p>
              <p className="font-bold text-slate-200 truncate">{userProfile.name || 'Student'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">Registered Mobile</p>
              <p className="font-mono text-sm text-slate-300 font-bold">
                {userProfile.mobile ? `+91 ${userProfile.mobile.slice(-10)}` : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">MissionGrid Student ID</p>
              <p className="font-mono font-black text-indigo-400 text-sm tracking-wide">
                {userProfile.missionGridStudentId || userProfile.studentCode || 'GEN-ID-PENDING'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Batch Details & Compliance */}
        <div className="space-y-3.5 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">Registration Date</p>
              <p className="text-xs text-slate-300 font-bold">
                {formatWithFallback(userProfile.createdAt || userProfile.premiumStartDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">Current Enrolled Batch</p>
              <p className="font-bold text-slate-200 truncate">{userProfile.currentBatch || userProfile.batchId || 'Aspirants'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">Consistency Compliance</p>
              <p className="text-xs text-slate-300">
                Missed Days : <span className="font-black text-slate-200">
                  {userProfile.consecutiveMissedDays ?? userProfile.consecutiveMissedMissions ?? 0}
                </span>
                <span className="text-slate-500 font-mono mx-1.5">|</span>
                Last Sub : <span className="font-bold text-slate-200">{formatWithFallback(userProfile.lastSubmissionDate || userProfile.lastMissionSubmissionDate)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">System Clearance Status</p>
              <p className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                ACTIVE & COMPLIANT
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section: Audited Device Info */}
      <div className="relative border-t border-slate-800 pt-4 mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono">
          <Laptop className="w-3.5 h-3.5 text-slate-600" />
          <span className="truncate max-w-[280px] sm:max-w-md">
            Security Logged: {userProfile.operatingSystem || 'Web'} / {userProfile.browser || 'Browser'} ({userProfile.currentIP || userProfile.registrationIP || 'Secure IP'})
          </span>
        </div>
        <div className="text-[9px] font-mono text-slate-600 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 uppercase tracking-widest select-none">
          PERMANENT / NON-EDITABLE
        </div>
      </div>
    </div>
  );
}
