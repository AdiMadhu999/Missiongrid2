import React, { useState, useEffect, useMemo } from 'react';
import { 
  Crown, Sparkles, Check, Search, Filter, Calendar, 
  Trash2, RotateCcw, History, CalendarClock, ChevronDown, 
  X, AlertTriangle, AlertCircle, Clock, CheckCircle, HelpCircle, UserCheck
} from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, addDoc, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { User } from '../../models/user';
import { Batch } from '../../models/mission';
import { useAuth } from '../../providers/AuthProvider';
import toast from 'react-hot-toast';

interface PremiumManagementDashboardProps {
  users: User[];
  batches: Batch[];
  onRefresh: () => Promise<void>;
}

interface PremiumHistoryLog {
  id?: string;
  studentId: string;
  studentName: string;
  mobile?: string;
  changedBy: string;
  changedByName: string;
  action: string;
  previousStatus: string;
  newStatus: string;
  durationDays?: number;
  reason: string;
  timestamp: string;
  date: string;
  time: string;
}

export const PremiumManagementDashboard: React.FC<PremiumManagementDashboardProps> = ({ 
  users, 
  batches, 
  onRefresh 
}) => {
  const { userProfile } = useAuth();
  
  // Local UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'premium' | 'free' | 'expiring_soon' | 'inactive_lost'>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  
  // Interactive Modal Actions
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'grant' | 'extend' | 'restore' | 'remove' | 'reset_missed' | 'history' | null>(null);
  
  // Form submission inputs
  const [customDays, setCustomDays] = useState('30');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // History logs states
  const [historyLogs, setHistoryLogs] = useState<PremiumHistoryLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Parse students list (filtering out mentors/staff)
  const students = useMemo(() => {
    return users.filter(u => {
      const roleLower = (u.role || '').toLowerCase();
      return roleLower === 'student' || roleLower === 'aspirant' || (!roleLower);
    });
  }, [users]);

  // Calculate Premium Summary Cards
  const stats = useMemo(() => {
    const total = students.length;
    let premiumCount = 0;
    let freeCount = 0;
    let expiringSoonCount = 0;
    let lostInactivityCount = 0;

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    students.forEach(s => {
      const isPremium = !!s.isPremium || s.premiumStatus === 'active' || s.premiumStatus === 'PREMIUM';
      
      if (isPremium) {
        premiumCount++;
        // Check if expiring within next 7 days
        if (s.premiumExpiryDate) {
          try {
            const expiry = new Date(s.premiumExpiryDate);
            if (expiry > now && expiry <= sevenDaysFromNow) {
              expiringSoonCount++;
            }
          } catch (e) {
            console.warn(e);
          }
        }
      } else {
        freeCount++;
        // Check if lost due to inactivity
        const isLostByInactivity = s.premiumRemovalReason === 'inactivity' || 
          (s.consecutiveMissedDays !== undefined && s.consecutiveMissedDays >= 10) ||
          (s.consecutiveMissedMissions !== undefined && s.consecutiveMissedMissions >= 10);
        
        if (isLostByInactivity) {
          lostInactivityCount++;
        }
      }
    });

    return {
      total,
      premium: premiumCount,
      free: freeCount,
      expiringSoon: expiringSoonCount,
      lostInactivity: lostInactivityCount
    };
  }, [students]);

  // Handle Search and Filter application
  const filteredStudents = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    return students.filter(s => {
      // 1. Search text filter
      const text = searchTerm.trim().toLowerCase();
      if (text) {
        const nameMatch = (s.name || '').toLowerCase().includes(text);
        const mobileMatch = (s.mobile || '').includes(text);
        const codeMatch = (s.studentCode || '').toLowerCase().includes(text);
        const idMatch = (s.id || '').toLowerCase().includes(text);
        if (!nameMatch && !mobileMatch && !codeMatch && !idMatch) {
          return false;
        }
      }

      // 2. Batch filter
      if (batchFilter !== 'all' && s.batchId !== batchFilter) {
        return false;
      }

      // 3. Status filter
      const isPremium = !!s.isPremium || s.premiumStatus === 'active' || s.premiumStatus === 'PREMIUM';
      if (statusFilter === 'premium' && !isPremium) {
        return false;
      }
      if (statusFilter === 'free' && isPremium) {
        return false;
      }
      if (statusFilter === 'expiring_soon') {
        if (!isPremium || !s.premiumExpiryDate) return false;
        try {
          const expiry = new Date(s.premiumExpiryDate);
          if (!(expiry > now && expiry <= sevenDaysFromNow)) {
            return false;
          }
        } catch {
          return false;
        }
      }
      if (statusFilter === 'inactive_lost') {
        if (isPremium) return false;
        const isLostByInactivity = s.premiumRemovalReason === 'inactivity' || 
          (s.consecutiveMissedDays !== undefined && s.consecutiveMissedDays >= 10) ||
          (s.consecutiveMissedMissions !== undefined && s.consecutiveMissedMissions >= 10);
        if (!isLostByInactivity) return false;
      }

      return true;
    });
  }, [students, searchTerm, statusFilter, batchFilter]);

  // Fetch log history for selected student
  useEffect(() => {
    if (selectedStudent && actionType === 'history') {
      setLoadingHistory(true);
      const studentIdentifier = selectedStudent.id || selectedStudent.uid || '';
      
      const q = query(
        collection(db, 'premium_history'),
        where('studentId', '==', studentIdentifier),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      getDocs(q)
        .then(snap => {
          const logs: PremiumHistoryLog[] = [];
          snap.forEach(d => {
            logs.push({ id: d.id, ...d.data() } as PremiumHistoryLog);
          });
          setHistoryLogs(logs);
        })
        .catch(err => {
          console.error("Failed to load premium history:", err);
          toast.error("Could not fetch status history logs.");
        })
        .finally(() => {
          setLoadingHistory(false);
        });
    }
  }, [selectedStudent, actionType]);

  // Reset inputs when student/action changes
  useEffect(() => {
    setReason('');
    setCustomDays('30');
  }, [selectedStudent, actionType]);

  // Date helper
  const formatDateString = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Status reason helper
  const getStatusReasonLabel = (student: User) => {
    const isPremium = !!student.isPremium || student.premiumStatus === 'active' || student.premiumStatus === 'PREMIUM';
    if (isPremium) return 'Active';
    
    if (student.premiumRemovalReason === 'inactivity') return 'Inactivity';
    
    const consecutiveMissed = student.consecutiveMissedDays || student.consecutiveMissedMissions || 0;
    if (consecutiveMissed >= 10) return 'Inactivity';
    
    if (student.premiumExpiryDate) {
      try {
        const expiry = new Date(student.premiumExpiryDate);
        if (expiry < new Date()) return 'Expired';
      } catch {}
    }

    return 'Free Account';
  };

  // Perform Mentor Premium Actions
  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    const targetStudentId = selectedStudent.id || selectedStudent.uid || selectedStudent.mobile!;
    const studentName = selectedStudent.name || 'Student';
    const mentorName = userProfile?.name || 'Mentor';
    const mentorId = userProfile?.id || userProfile?.id || 'mentor';

    if (!reason.trim()) {
      toast.error('Please specify a reason for this audit change.');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Recording premium updates...');

    try {
      const now = new Date();
      const timestampIso = now.toISOString();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];

      let publicUpdates: any = {};
      let previousStatusStr = selectedStudent.isPremium ? 'PREMIUM' : 'FREE';
      let newStatusStr = previousStatusStr;
      let durationNum: number | undefined = undefined;

      if (actionType === 'grant' || actionType === 'restore') {
        const days = parseInt(customDays, 10);
        if (isNaN(days) || days <= 0) {
          throw new Error('Please specify a valid positive number of days.');
        }
        durationNum = days;
        newStatusStr = 'PREMIUM';

        const expiry = new Date();
        expiry.setDate(expiry.getDate() + days);

        publicUpdates = {
          isPremium: true,
          premium: true,
          premiumStatus: 'active',
          premiumExpiryDate: expiry.toISOString(),
          premiumStartDate: timestampIso,
          premiumDays: days,
          remainingPremiumDays: days,
          consecutiveMissedDays: 0,
          consecutiveMissedMissions: 0,
          premiumRemovalReason: '',
          lastPremiumChangeDate: timestampIso,
          premiumChangedBy: mentorName
        };
      } 
      else if (actionType === 'extend') {
        const days = parseInt(customDays, 10);
        if (isNaN(days) || days <= 0) {
          throw new Error('Please specify a valid positive number of days.');
        }
        durationNum = days;
        newStatusStr = 'PREMIUM';

        // Start from current expiry if it is in the future, otherwise from today
        let baseDate = new Date();
        if (selectedStudent.isPremium && selectedStudent.premiumExpiryDate) {
          const currentExpiry = new Date(selectedStudent.premiumExpiryDate);
          if (currentExpiry > baseDate) {
            baseDate = currentExpiry;
          }
        }

        baseDate.setDate(baseDate.getDate() + days);

        publicUpdates = {
          isPremium: true,
          premium: true,
          premiumStatus: 'active',
          premiumExpiryDate: baseDate.toISOString(),
          premiumStartDate: timestampIso,
          consecutiveMissedDays: 0,
          consecutiveMissedMissions: 0,
          premiumRemovalReason: '',
          lastPremiumChangeDate: timestampIso,
          premiumChangedBy: mentorName
        };
      } 
      else if (actionType === 'remove') {
        newStatusStr = 'FREE';
        publicUpdates = {
          isPremium: false,
          premium: false,
          premiumStatus: 'FREE',
          premiumRemovalReason: 'manual',
          lastPremiumChangeDate: timestampIso,
          premiumChangedBy: mentorName,
          premiumExpiryDate: timestampIso // Mark as expired today
        };
      } 
      else if (actionType === 'reset_missed') {
        publicUpdates = {
          consecutiveMissedDays: 0,
          consecutiveMissedMissions: 0,
          lastPremiumChangeDate: timestampIso,
          premiumChangedBy: mentorName
        };
      }

      // 1. Write the user document updates to Firestore
      const userDocRef = doc(db, 'users', targetStudentId);
      await updateDoc(userDocRef, {
        ...publicUpdates,
        updatedAt: timestampIso
      });

      // Write private mirror document updates as well if exists
      try {
        const privateDocRef = doc(db, 'users_private', targetStudentId);
        await updateDoc(privateDocRef, {
          updatedAt: timestampIso
        });
      } catch (privErr) {
        console.warn('Private document updates bypassed:', privErr);
      }

      // 2. Add an audit document into premium_history
      const actionNameMap = {
        grant: 'Grant Premium',
        extend: 'Extend Premium',
        restore: 'Restore Premium',
        remove: 'Remove Premium',
        reset_missed: 'Reset Missed Days'
      };

      const auditPayload: PremiumHistoryLog = {
        studentId: targetStudentId,
        studentName: studentName,
        mobile: selectedStudent.mobile,
        changedBy: mentorId,
        changedByName: mentorName,
        action: actionNameMap[actionType as keyof typeof actionNameMap] || 'Premium Status Change',
        previousStatus: previousStatusStr,
        newStatus: newStatusStr,
        durationDays: durationNum,
        reason: reason.trim(),
        timestamp: timestampIso,
        date: dateStr,
        time: timeStr
      };

      await addDoc(collection(db, 'premium_history'), auditPayload);

      toast.success('Successfully logged premium operations!', { id: toastId });
      setSelectedStudent(null);
      setActionType(null);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Operation failed. Please try again.', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto font-sans leading-normal">
      {/* 1. Dashboard summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 sm:p-6 bg-white border-b border-slate-100">
        <div className="bg-slate-50/70 p-4 rounded-3xl border border-slate-100/50 hover:shadow-xs transition-all">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Students</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.total}</span>
        </div>
        <div className="bg-amber-50/40 p-4 rounded-3xl border border-amber-100/40 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-amber-700/70 uppercase tracking-widest">Premium Active</span>
            <Crown size={12} className="text-amber-500 fill-amber-500" />
          </div>
          <span className="text-2xl font-black text-amber-650 mt-1 block">{stats.premium}</span>
        </div>
        <div className="bg-slate-55 p-4 rounded-3xl border border-slate-150/40 hover:shadow-xs transition-all">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Free Accounts</span>
          <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.free}</span>
        </div>
        <div className="bg-rose-50/40 p-4 rounded-3xl border border-rose-100/40 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-rose-700/70 uppercase tracking-widest">Expiring 7 Days</span>
            <Calendar size={12} className="text-rose-500" />
          </div>
          <span className="text-2xl font-black text-rose-650 mt-1 block">{stats.expiringSoon}</span>
        </div>
        <div className="bg-violet-50/45 p-4 rounded-3xl border border-violet-100/45 col-span-2 md:col-span-1 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-violet-750 uppercase tracking-widest">Lost (Inactivity)</span>
            <AlertTriangle size={12} className="text-violet-500" />
          </div>
          <span className="text-2xl font-black text-violet-700 mt-1 block">{stats.lostInactivity}</span>
        </div>
      </div>

      {/* 2. Operations & Filter Bar */}
      <div className="p-4 sm:p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        {/* Realtime Search input */}
        <div className="relative w-full sm:max-w-xs group">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input 
            type="text"
            placeholder="Search student ID, name or mobile..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl py-3 pl-11 pr-4 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-300 transition-all font-sans"
          />
        </div>

        {/* Dynamic Filters */}
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 custom-scrollbar">
          {/* Status filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-2xl text-xs font-bold shrink-0 text-slate-700">
            <Filter size={11} className="text-slate-400 mr-2" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="premium">👑 Premium Only</option>
              <option value="free">🆓 Free Only</option>
              <option value="expiring_soon">⚠️ Expiring Next 7 Days</option>
              <option value="inactive_lost">🚫 Lost By Inactivity</option>
            </select>
          </div>

          {/* Batch filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-2xl text-xs font-bold shrink-0 text-slate-700">
            <CalendarClock size={11} className="text-slate-400 mr-2" />
            <select
              value={batchFilter}
              onChange={e => setBatchFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 cursor-pointer max-w-[150px]"
            >
              <option value="all">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.batchName || b.batchCode}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Detailed Students Table */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <Search size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No matching students found</p>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6">Student Details</th>
                    <th className="py-4 px-4">Current Batch</th>
                    <th className="py-4 px-4">Premium Status</th>
                    <th className="py-4 px-4">Expiration Date</th>
                    <th className="py-4 px-4 text-center">Missed Days</th>
                    <th className="py-4 px-4 text-center">Audit Reason</th>
                    <th className="py-4 px-6 text-center">Operational Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => {
                    const isPremium = !!student.isPremium || student.premiumStatus === 'active' || student.premiumStatus === 'PREMIUM';
                    const batchName = batches.find(b => b.id === student.batchId)?.batchName || 'No Batch';
                    const studentId = student.id || student.uid || student.mobile!;
                    const statusReason = getStatusReasonLabel(student);
                    const missedDays = student.consecutiveMissedDays || student.consecutiveMissedMissions || 0;

                    return (
                      <tr key={studentId} className="hover:bg-slate-50/30 transition-colors">
                        {/* Student profile */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-100 border border-slate-150 flex-shrink-0">
                              {student.photoUrl ? (
                                <img src={student.photoUrl} alt={student.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-500 font-bold text-sm uppercase">
                                  {(student.name || 'S').charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-800 text-sm truncate">{student.name}</div>
                              <div className="text-[10px] font-mono font-medium text-slate-400 mt-0.5">
                                ID: {student.studentCode || 'No Code'} • Mob: {student.mobile || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Batch */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2.5 py-1 rounded-xl text-[10px] font-black bg-slate-100 text-slate-600 uppercase tracking-wide">
                            {batchName}
                          </span>
                        </td>

                        {/* Status Label */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isPremium 
                              ? 'bg-amber-50 text-amber-600 border-amber-200/50' 
                              : 'bg-slate-100 text-slate-500 border-slate-200/50'
                          }`}>
                            {isPremium ? (
                              <>
                                <Crown size={10} className="fill-amber-500 text-amber-500" />
                                Premium
                              </>
                            ) : (
                              <>
                                🆓 Free
                              </>
                            )}
                          </span>
                        </td>

                        {/* Expiration Date */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-bold text-slate-700 font-sans">
                            {isPremium ? formatDateString(student.premiumExpiryDate) : 'N/A'}
                          </div>
                          {isPremium && student.premiumExpiryDate && (
                            <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                              {(() => {
                                try {
                                  const diff = new Date(student.premiumExpiryDate).getTime() - Date.now();
                                  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                  return days > 0 ? `${days} Days Left` : 'Expired Today';
                                } catch {
                                  return '';
                                }
                              })()}
                            </div>
                          )}
                        </td>

                        {/* Missed days */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`text-xs font-black font-sans ${missedDays >= 10 ? 'text-rose-600' : missedDays > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                            {missedDays} {missedDays === 1 ? 'Day' : 'Days'}
                          </span>
                        </td>

                        {/* Audit status reason */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider ${
                            statusReason === 'Active' ? 'bg-emerald-55 text-emerald-700' :
                            statusReason === 'Inactivity' ? 'bg-violet-55 text-violet-700' :
                            statusReason === 'Expired' ? 'bg-rose-55 text-rose-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {statusReason}
                          </span>
                        </td>

                        {/* Action Buttons list */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center justify-center gap-1">
                            {/* Actions Dropdown Trigger inside a tidy context menu bar */}
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
                                setActionType(isPremium ? 'extend' : 'grant');
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                            >
                              {isPremium ? 'Extend' : 'Grant'}
                            </button>
                            
                            {/* Quick Restore if Expired/Lost */}
                            {!isPremium && (
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setActionType('restore');
                                }}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                              >
                                Restore
                              </button>
                            )}

                            {/* Reset Missed */}
                            {missedDays > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setActionType('reset_missed');
                                }}
                                className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl transition-all"
                                title="Reset consecutive missed days"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}

                            {/* View History Log */}
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
                                setActionType('history');
                              }}
                              className="p-1.5 bg-slate-50 hover:bg-slate-150 text-slate-400 hover:text-slate-700 rounded-xl transition-all"
                              title="Audit History Log"
                            >
                              <History size={14} />
                            </button>

                            {/* Revoke/Remove Premium */}
                            {isPremium && (
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setActionType('remove');
                                }}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl transition-all"
                                title="Revoke Premium Access"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. MENTOR CONTROL DRAWER / DIALOG MODAL */}
      {selectedStudent && actionType && actionType !== 'history' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 -xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] border border-slate-150 p-6 sm:p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
            <button
              onClick={() => {
                setSelectedStudent(null);
                setActionType(null);
              }}
              className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                <Crown className="w-6 h-6 fill-amber-500 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">
                  {actionType === 'grant' && 'Grant Premium'}
                  {actionType === 'extend' && 'Extend Premium'}
                  {actionType === 'restore' && 'Restore Premium'}
                  {actionType === 'remove' && 'Revoke Premium'}
                  {actionType === 'reset_missed' && 'Reset Consecutive Missed Days'}
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Action for {selectedStudent.name}
                </p>
              </div>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-4">
              {/* Duration Options */}
              {(actionType === 'grant' || actionType === 'extend' || actionType === 'restore') && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Duration Days</label>
                  <div className="grid grid-cols-4 gap-2 mt-1.5">
                    {['30', '180'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCustomDays(val)}
                        className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                          customDays === val 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                            : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {val} Days
                      </button>
                    ))}
                    <input
                      type="number"
                      placeholder="Custom"
                      value={['30', '180'].includes(customDays) ? '' : customDays}
                      onChange={e => setCustomDays(e.target.value)}
                      className="py-2 px-3 rounded-xl text-xs font-bold text-slate-800 border border-slate-200 text-center outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              )}

              {/* Confirm Text Box for destructive action */}
              {actionType === 'remove' && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start gap-3 text-justify">
                  <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-rose-800 uppercase tracking-wider">Warning Action</p>
                    <p className="text-[11px] text-rose-600 font-bold mt-1 leading-relaxed">
                      You are revoking Premium access immediately. The student's access status will become **FREE**. 
                    </p>
                  </div>
                </div>
              )}

              {/* Reset Missed explanation */}
              {actionType === 'reset_missed' && (
                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100 flex items-start gap-3">
                  <RotateCcw size={20} className="text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-teal-800 uppercase tracking-wider">Reset Counters</p>
                    <p className="text-[11px] text-teal-600 font-bold mt-1 leading-relaxed">
                      This resets the student's consecutive missed days back to 0. This is helpful if a student was inactive but got permission to re-submit missions.
                    </p>
                  </div>
                </div>
              )}

              {/* Reason input */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Reason / Note (For Audit Logs)</label>
                <textarea
                  required
                  placeholder={
                    actionType === 'remove' ? 'Explain why you are revoking access...' :
                    actionType === 'reset_missed' ? 'Explain why missed days are reset...' :
                    'Enter payment reference or support justification...'
                  }
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-300 transition-all font-sans min-h-[90px] mt-1.5"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setActionType(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-3 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md ${
                    actionType === 'remove' 
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-100' 
                      : actionType === 'reset_missed'
                      ? 'bg-teal-650 hover:bg-teal-600 shadow-teal-100'
                      : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-100'
                  }`}
                >
                  {submitting ? 'Updating...' : 'Submit Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. AUDIT HISTORY LOG DRAWER */}
      {selectedStudent && actionType === 'history' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 -xs flex items-center justify-end p-0">
          <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col font-sans animate-slide-left relative">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Audit Change Log</h3>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">
                  {selectedStudent.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setActionType(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-650 rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Audit History...</p>
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-250">
                  <History size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No audit logs found</p>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">Status changes are recorded here in real-time.</p>
                </div>
              ) : (
                <div className="relative border-l border-slate-200 pl-4 space-y-6">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="relative">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[21px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-indigo-600 shadow-sm" />

                      {/* Log Body */}
                      <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 text-indigo-700 uppercase tracking-wider">
                            {log.action}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-slate-400 mt-0.5 whitespace-nowrap">
                            {formatDateString(log.timestamp)}
                          </span>
                        </div>

                        {/* Status Change info */}
                        <div className="flex items-center gap-2 mt-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-600">
                          <div>
                            Prev: <span className="font-extrabold text-slate-800">{log.previousStatus}</span>
                          </div>
                          <span className="text-slate-300">→</span>
                          <div>
                            New: <span className="font-extrabold text-slate-800">{log.newStatus}</span>
                          </div>
                          {log.durationDays && (
                            <>
                              <span className="w-1 h-1 bg-slate-200 rounded-full" />
                              <div>
                                Duration: <span className="font-black text-indigo-600">{log.durationDays} Days</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Reason */}
                        <div className="text-xs font-semibold text-slate-800 mt-2 text-justify leading-relaxed">
                          "{log.reason}"
                        </div>

                        {/* Audit Details */}
                        <div className="text-[9px] font-bold text-slate-400 mt-2 flex items-center gap-1">
                          <span>Updated By:</span>
                          <span className="text-slate-600 font-extrabold">{log.changedByName}</span>
                          <span>at {log.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setActionType(null);
                }}
                className="w-full py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all hover:bg-slate-800 text-center"
              >
                Close Logs Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
