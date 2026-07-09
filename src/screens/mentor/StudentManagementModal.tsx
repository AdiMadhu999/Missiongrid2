import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, ShieldAlert, ShieldCheck, Key, History, Activity, Laptop, Database, ToggleLeft, ToggleRight, Calendar, AlertTriangle, ArrowRight, CheckCircle2, User, HelpCircle, Info, Copy, Check, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { User as UserType } from '../../models/user';
import { Batch } from '../../models/mission';
import { BatchService } from '../../services/batch';
import { updateUserProfile, deleteUserProfile } from '../../services/users';
import { db, auth } from '../../services/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { PremiumService, PremiumHistoryLog, SecurityHistoryLog } from '../../services/premium';
import { useAuth } from '../../providers/AuthProvider';

const StudentManagementModal = ({ 
  user, 
  onClose, 
  onSaved 
}: { 
  user: UserType; 
  onClose: () => void; 
  onSaved: () => void; 
}) => {
  const { userProfile: mentorProfile } = useAuth();
  const studentId = user.id || user.uid || (user as any).mobile || '';

  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState(user.batchId || '');
  const [name, setName] = useState(user.name || '');
  const [status, setStatus] = useState(user.status || 'active');
  const [role, setRole] = useState(user.role || 'student');
  const [testAccess, setTestAccess] = useState<'free' | 'premium'>(
    user.isPremium ? 'premium' : ((user as any).testAccess || 'free')
  );
  
  // Premium properties inside student's profile (from state or user prop)
  const [isPremium, setIsPremium] = useState(!!user.isPremium);
  const [premiumStatus, setPremiumStatus] = useState<string>(user.premiumStatus || (user.isPremium ? 'PREMIUM' : 'FREE'));
  const [premiumType, setPremiumType] = useState<string>(user.premiumType || 'FREE_TRIAL');
  const [premiumStartDate, setPremiumStartDate] = useState<string>(user.premiumStartDate || 'N/A');
  const [premiumExpiryDate, setPremiumExpiryDate] = useState<string>(user.premiumExpiryDate || 'N/A');
  const [remainingPremiumDays, setRemainingPremiumDays] = useState<number>(user.remainingPremiumDays !== undefined ? user.remainingPremiumDays : 0);
  const [registrationDate, setRegistrationDate] = useState<string>(user.registrationDate || 'N/A');
  const [mobile, setMobile] = useState<string>(user.mobile || 'N/A');
  const [currentBatch, setCurrentBatch] = useState<string>(user.currentBatch || 'Aspirants');

  const [consecutiveMissed, setConsecutiveMissed] = useState<number>(user.consecutiveMissedDays !== undefined ? user.consecutiveMissedDays : (user.consecutiveMissedMissions || 0));
  const [lastSubmission, setLastSubmission] = useState<string | null>(user.lastSubmissionDate || user.lastMissionSubmissionDate || null);
  const [manualOverride, setManualOverride] = useState<boolean>(!!user.manualPremiumOverride);

  // Custom action inputs
  const [customDays, setCustomDays] = useState<number>(30);
  const [extendDays, setExtendDays] = useState<number>(30);
  const [actionReason, setActionReason] = useState<string>('Manual Action');

  // Private profile states (audit info)
  const [privateProfile, setPrivateProfile] = useState<any>(null);
  const [premiumHistory, setPremiumHistory] = useState<PremiumHistoryLog[]>([]);
  const [securityHistory, setSecurityHistory] = useState<SecurityHistoryLog[]>([]);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'basic' | 'premium' | 'security'>('basic');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    // Load Batches
    BatchService.getBatches().then(setBatches);

    // Load private profile data for registration/current IP, devices
    if (studentId) {
      getDoc(doc(db, 'users_private', studentId))
         .then(snap => {
           if (snap.exists()) {
             setPrivateProfile(snap.data());
           }
         })
         .catch(err => console.error("Error reading private student profile:", err));

      // Load histories
      PremiumService.getPremiumHistory(studentId).then(setPremiumHistory);
      PremiumService.getSecurityHistory(studentId).then(setSecurityHistory);
    }
  }, [studentId]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(studentId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const reloadHistories = async () => {
    if (studentId) {
      const pLogs = await PremiumService.getPremiumHistory(studentId);
      const sLogs = await PremiumService.getSecurityHistory(studentId);
      setPremiumHistory(pLogs);
      setSecurityHistory(sLogs);
      
      // Also fetch updated user profile data if available
      const updatedUserSnap = await getDoc(doc(db, 'users', studentId));
      if (updatedUserSnap.exists()) {
        const uData = updatedUserSnap.data() as any;
        setIsPremium(!!uData.isPremium);
        setPremiumStatus(uData.premiumStatus || (uData.isPremium ? 'PREMIUM' : 'FREE'));
        setPremiumType(uData.premiumType || 'None');
        setPremiumStartDate(uData.premiumStartDate || 'N/A');
        setPremiumExpiryDate(uData.premiumExpiryDate || 'N/A');
        setRemainingPremiumDays(uData.remainingPremiumDays !== undefined ? uData.remainingPremiumDays : 0);
        setConsecutiveMissed(uData.consecutiveMissedDays !== undefined ? uData.consecutiveMissedDays : (uData.consecutiveMissedMissions || 0));
        setLastSubmission(uData.lastSubmissionDate || uData.lastMissionSubmissionDate || null);
        setManualOverride(!!uData.manualPremiumOverride);
        setRegistrationDate(uData.registrationDate || 'N/A');
        setMobile(uData.mobile || 'N/A');
        setCurrentBatch(uData.currentBatch || '');
      }
    }
  };

  // Base configurations updates
  const handleUpdateBasic = async () => {
    setLoading(true);
    try {
      const selectedBatch = batches.find(b => b.id === batchId);
      const batchName = selectedBatch ? (selectedBatch.batchName || selectedBatch.batchCode) : 'Aspirants';

      await updateUserProfile(studentId, { 
        name,
        role,
        batchId, 
        currentBatch: batchName,
        status, 
        testAccess,
        isPremium: testAccess === 'premium',
        registrationDate: registrationDate || undefined
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to update student configuration');
    } finally {
      setLoading(false);
    }
  };

  // Premium actions triggers
  const handleGrantPremium = async (days: number) => {
    setLoading(true);
    try {
      const mentorId = mentorProfile?.id || auth.currentUser?.uid || 'mentor';
      const mentorName = mentorProfile?.name || 'Mentor';
      await PremiumService.mentorGrantPremium(studentId, name, days, mentorId, mentorName, actionReason);
      await reloadHistories();
      onSaved();
    } catch (err: any) {
      alert("Error granting premium: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePremium = async () => {
    if (!window.confirm("Are you sure you want to remove this student's Premium Access immediately?")) return;
    setLoading(true);
    try {
      const mentorId = mentorProfile?.id || auth.currentUser?.uid || 'mentor';
      const mentorName = mentorProfile?.name || 'Mentor';
      await PremiumService.mentorRemovePremium(studentId, name, mentorId, mentorName, actionReason);
      await reloadHistories();
      onSaved();
    } catch (err: any) {
      alert("Error removing premium: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtendPremium = async (days: number) => {
    setLoading(true);
    try {
      const mentorId = mentorProfile?.id || auth.currentUser?.uid || 'mentor';
      const mentorName = mentorProfile?.name || 'Mentor';
      await PremiumService.mentorExtendPremium(studentId, name, days, mentorId, mentorName, actionReason);
      await reloadHistories();
      onSaved();
    } catch (err: any) {
      alert("Error extending premium: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePremium = async () => {
    setLoading(true);
    try {
      const mentorId = mentorProfile?.id || auth.currentUser?.uid || 'mentor';
      const mentorName = mentorProfile?.name || 'Mentor';
      await PremiumService.mentorRestorePremium(studentId, name, mentorId, mentorName, actionReason);
      await reloadHistories();
      onSaved();
    } catch (err: any) {
      alert("Error restoring premium: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetMissedDays = async () => {
    setLoading(true);
    try {
      const mentorId = mentorProfile?.id || auth.currentUser?.uid || 'mentor';
      const mentorName = mentorProfile?.name || 'Mentor';
      await PremiumService.mentorResetMissedDays(studentId, name, mentorId, mentorName, actionReason || 'Manual Reset of Missed Days');
      await reloadHistories();
      onSaved();
    } catch (err: any) {
      alert("Error resetting missed days: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertPremiumToFree = async () => {
    setLoading(true);
    try {
      const mentorId = mentorProfile?.id || auth.currentUser?.uid || 'mentor';
      const mentorName = mentorProfile?.name || 'Mentor';
      await PremiumService.mentorConvertPremiumToFree(studentId, name, mentorId, mentorName, actionReason);
      await reloadHistories();
      onSaved();
    } catch (err: any) {
      alert("Error converting premium to free: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertFreeToPremium = async () => {
    setLoading(true);
    try {
      const mentorId = mentorProfile?.id || auth.currentUser?.uid || 'mentor';
      const mentorName = mentorProfile?.name || 'Mentor';
      await PremiumService.mentorConvertFreeToPremium(studentId, name, mentorId, mentorName, actionReason);
      await reloadHistories();
      onSaved();
    } catch (err: any) {
      alert("Error converting free to premium: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOverride = async (overrideValue: boolean) => {
    setLoading(true);
    try {
      const mentorId = mentorProfile?.id || auth.currentUser?.uid || 'mentor';
      const mentorName = mentorProfile?.name || 'Mentor';
      await PremiumService.mentorToggleOverride(studentId, overrideValue, mentorId, mentorName);
      await reloadHistories();
      onSaved();
    } catch (err: any) {
      alert("Error toggling override: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate days remaining
  const getDaysLeft = () => {
    if (!isPremium || !premiumExpiryDate || premiumExpiryDate === 'N/A') return 0;
    const diff = new Date(premiumExpiryDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[70] p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] p-6 sm:p-8 w-full max-w-4xl shadow-2xl border border-slate-100 flex flex-col md:flex-row gap-6 max-h-[92vh] overflow-hidden"
      >
        {/* Left Side: Student summary card & Tab selection */}
        <div className="w-full md:w-1/3 flex flex-col border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-6 flex-shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-lg">
                {name?.substring(0, 1).toUpperCase()}
              </div>
              <div className="truncate max-w-[140px]">
                <h3 className="font-black text-slate-900 tracking-tight leading-tight truncate">{name}</h3>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{user.category || 'Student'}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors md:hidden"><X size={18}/></button>
          </div>

          {/* Quick ID Copy */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between mb-4 flex-shrink-0 text-[10px]">
            <span className="font-mono text-slate-500 truncate max-w-[160px]">UID: {studentId}</span>
            <button onClick={handleCopyId} className="p-1 hover:bg-slate-200 text-slate-500 rounded transition-all">
              {copiedId ? <span className="text-emerald-600 font-extrabold text-[8px] uppercase">Copied!</span> : <Copy size={12} />}
            </button>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 mb-4 flex-1">
            <button 
              onClick={() => setActiveTab('basic')}
              className={`flex-1 md:flex-initial py-3 px-4 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2.5 transition-all ${
                activeTab === 'basic' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
              }`}
            >
              <User size={14} /> Basic Config
            </button>
            <button 
              onClick={() => setActiveTab('premium')}
              className={`flex-1 md:flex-initial py-3 px-4 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2.5 transition-all ${
                activeTab === 'premium' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
              }`}
            >
              <ShieldCheck size={14} /> Premium Engine
            </button>
            <button 
              onClick={() => setActiveTab('security')}
              className={`flex-1 md:flex-initial py-3 px-4 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2.5 transition-all ${
                activeTab === 'security' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
              }`}
            >
              <Activity size={14} /> Security Logs
            </button>
          </nav>

          {/* Close for Desktop only */}
          <button onClick={onClose} className="hidden md:flex items-center justify-center gap-2 w-full border border-slate-200 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 text-slate-600 transition-colors flex-shrink-0">
            Cancel & Close
          </button>
        </div>

        {/* Right Side: Tab Details content */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col min-h-0 custom-scrollbar pb-4 md:pb-0">
          <AnimatePresence mode="wait">
            {activeTab === 'basic' && (
              <motion.div
                key="basic"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4 flex-1"
              >
                <div>
                  <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase mb-1">Student Profile & Credentials Dossier</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">View metadata credentials and update core configuration</p>
                </div>

                {/* Candidate Credentials Bento Box */}
                <div className="bg-slate-50/70 p-4 rounded-3xl border border-slate-150 space-y-3.5">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-150 pb-1.5 flex items-center gap-1.5">
                    <Database size={13} className="text-indigo-600" /> Student Verification Dossier
                  </h5>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Student ID</span>
                      <p className="text-[10.5px] font-mono font-black text-slate-800 truncate mt-0.5">{studentId}</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Mobile Number</span>
                      <p className="text-[10.5px] font-black text-slate-800 mt-0.5">{mobile || 'N/A'}</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Registration Date</span>
                      <p className="text-[10.5px] font-black text-slate-800 mt-0.5">
                        {registrationDate || 'N/A'}
                      </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Allotted Batch</span>
                      <p className="text-[10.5px] font-black text-indigo-600 truncate mt-0.5">{currentBatch || 'Aspirants'}</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center col-span-2">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Device Installation ID</span>
                      <p className="text-[10px] font-mono font-black text-slate-700 truncate mt-0.5">{privateProfile?.deviceId || user.deviceId || 'Not Logged'}</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center col-span-2">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Device Details</span>
                      <p className="text-[9.5px] font-mono font-medium text-slate-600 leading-normal mt-0.5 break-all">{privateProfile?.deviceInfo || user.deviceInfo || 'Not Logged'}</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Last Connection IP</span>
                      <p className="text-[10.5px] font-mono font-black text-slate-800 mt-0.5">{privateProfile?.currentIP || privateProfile?.lastLoginIP || 'Not Logged'}</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Registration IP</span>
                      <p className="text-[10.5px] font-mono font-black text-slate-800 mt-0.5">{privateProfile?.registrationIP || 'Not Logged'}</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Last Login Time</span>
                      <p className="text-[10px] font-black text-slate-700 truncate mt-0.5">
                        {user.lastLoginDateTime || privateProfile?.lastLoginDateTime 
                          ? new Date(user.lastLoginDateTime || privateProfile?.lastLoginDateTime).toLocaleDateString()
                          : 'Never'
                        }
                      </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Last Report Submission</span>
                      <p className="text-[10px] font-black text-slate-700 truncate mt-0.5">
                        {lastSubmission 
                          ? new Date(lastSubmission).toLocaleDateString()
                          : 'Never'
                        }
                      </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center col-span-2">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Premium Status Info</span>
                      <p className="text-[10.5px] font-black text-indigo-700 mt-0.5">
                        {isPremium ? `⭐ Premium Active (${premiumExpiryDate || 'N/A'})` : '🆓 Free Tier'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Editable Profile Settings */}
                <div className="space-y-3.5 pt-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Student Name</label>
                    <input
                      className="w-full bg-slate-100 border border-transparent rounded-2xl py-3 px-4 text-xs font-black outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>

                                    <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">User Role (Security Priority)</label>
                    <select 
                      className="w-full bg-slate-100 border border-transparent rounded-2xl py-3 px-4 text-xs font-black outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all text-slate-800 cursor-pointer"
                      value={role}
                      onChange={e => setRole(e.target.value as any)}
                    >
                      <option value="student">Student</option>
                      <option value="aspirant">Aspirant</option>
                      <option value="mentor">Mentor</option>
                      <option value="primary-mentor">Primary Mentor</option>
                      <option value="examiner">Examiner</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Allotted Batch</label>
                    <select 
                      className="w-full bg-slate-100 border border-transparent rounded-2xl py-3 px-4 text-xs font-black outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800 cursor-pointer"
                      value={batchId}
                      onChange={e => setBatchId(e.target.value)}
                    >
                      <option value="">No Batch Assigned</option>
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.batchName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Registration Date (Adjust student target timeline)</label>
                    <input
                      type="date"
                      className="w-full bg-slate-100 border border-transparent rounded-2xl py-3 px-4 text-xs font-black outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
                      value={registrationDate && registrationDate !== 'N/A' ? registrationDate : ''}
                      onChange={e => setRegistrationDate(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Account Access Status</label>
                      <div className="flex gap-1">
                        {['active', 'inactive', 'restricted'].map(s => (
                          <button 
                            key={s}
                            type="button"
                            onClick={() => setStatus(s as any)}
                            className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                              status === s 
                                ? (s === 'active' 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' 
                                    : s === 'inactive'
                                      ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm'
                                      : 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm')
                                : 'bg-slate-100 text-slate-400 border-transparent hover:bg-slate-200 hover:text-slate-500'
                            }`}
                          >
                            {s === 'active' ? '🟢 Active' : s === 'inactive' ? '🔴 Inactive' : '⚠️ Restricted'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Legacy Test Access</label>
                      <div className="flex gap-1.5">
                        {['free', 'premium'].map(s => (
                          <button 
                            key={s}
                            type="button"
                            onClick={() => setTestAccess(s as any)}
                            className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                              testAccess === s 
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm' 
                                : 'bg-slate-100 text-slate-400 border-transparent hover:bg-slate-200 hover:text-slate-500'
                            }`}
                          >
                            {s === 'premium' ? '⭐ Premium' : '🟢 Free'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col gap-2.5 mt-auto">
                  <button onClick={handleUpdateBasic} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all">
                    {loading ? 'Saving Changes...' : 'Save Configuration'}
                  </button>

                  <button 
                    onClick={async () => {
                      if (window.confirm(`Are you absolutely sure you want to remove ${name} from this list?`)) {
                        setLoading(true);
                        try {
                          await deleteUserProfile(studentId);
                          onSaved();
                          onClose();
                        } catch (err) {
                          console.error(err);
                          alert('Failed to remove student.');
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    disabled={loading} 
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-black py-3 rounded-2xl transition-all text-[9px] uppercase tracking-widest border border-rose-100"
                  >
                    Remove Student
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'premium' && (
              <motion.div
                key="premium"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4 flex-1"
              >
                <div>
                  <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase mb-1">Premium Engine Access Console</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Configure Student Premium Status, Expiry and History</p>
                </div>

                {/* A. Bento Student Details Grid */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60 pb-1.5 flex items-center gap-1.5">
                    <User size={13} className="text-indigo-600" /> Student Profile & Premium Details
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Student ID</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono font-black text-slate-700 truncate max-w-[120px]">{studentId}</span>
                        <button onClick={handleCopyId} className="text-indigo-600 hover:text-indigo-700 p-0.5 shrink-0">
                          {copiedId ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Student Name</span>
                      <p className="text-[10px] font-black text-slate-800 truncate mt-0.5">{name}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Mobile Number</span>
                      <p className="text-[10px] font-black text-slate-800 mt-0.5">{mobile || user.mobile || 'N/A'}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Current Batch</span>
                      <p className="text-[10px] font-black text-slate-800 truncate mt-0.5">{currentBatch || 'Aspirants'}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Registration Date</span>
                      <p className="text-[10px] font-black text-slate-800 mt-0.5">{registrationDate || user.registrationDate || (user.createdAt ? user.createdAt.split('T')[0] : 'N/A')}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Premium Status</span>
                      <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded mt-0.5 uppercase tracking-wide ${isPremium ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-150 text-slate-600'}`}>
                        {isPremium ? '⭐ PREMIUM' : 'FREE'}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Premium Type</span>
                      <p className="text-[10px] font-black text-slate-800 mt-0.5 uppercase tracking-wider">{premiumType || user.premiumType || 'None'}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Premium Start Date</span>
                      <p className="text-[10px] font-black text-slate-800 mt-0.5">{premiumStartDate || user.premiumStartDate || 'N/A'}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Premium Expiry Date</span>
                      <p className="text-[10px] font-black text-slate-800 mt-0.5">{premiumExpiryDate || user.premiumExpiryDate || 'N/A'}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Days Remaining</span>
                      <p className="text-[10px] font-black text-indigo-600 mt-0.5">{isPremium ? `${getDaysLeft()} Days` : '0 Days'}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Consecutive Missed Days</span>
                      <p className={`text-[10px] font-black mt-0.5 ${consecutiveMissed >= 8 ? 'text-rose-600' : consecutiveMissed >= 5 ? 'text-amber-500' : 'text-slate-800'}`}>
                        {consecutiveMissed} Days
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Last Submission Date</span>
                      <p className="text-[10px] font-black text-slate-800 mt-0.5">{lastSubmission || 'Never'}</p>
                    </div>
                  </div>
                </div>

                {/* B. Action Reason Input */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                    Action Reason <span className="text-indigo-600 font-extrabold">(REQUIRED FOR AUDIT LOGGING)</span>
                  </label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Enter explicit reason for change (e.g., Campaign activation, Extension due to batch change)"
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-[11px] font-bold text-slate-700 px-3 py-2.5 rounded-xl outline-none transition-all"
                  />
                </div>

                {/* C. Compliance Overrides Auto-Checks */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-3xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">Compliance Auto-Checks</h5>
                      <p className="text-[8px] text-slate-400 font-semibold leading-tight mt-0.5">Toggle 10-day consecutive missed reports checking</p>
                    </div>
                    <button 
                      onClick={() => handleToggleOverride(!manualOverride)}
                      className={`p-1 rounded-full transition-all ${manualOverride ? 'text-amber-500' : 'text-slate-300'}`}
                      disabled={loading}
                    >
                      {manualOverride ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>

                  <div className={`p-2.5 rounded-xl text-[9px] font-bold leading-relaxed ${
                    manualOverride 
                      ? 'bg-amber-50 border border-amber-100 text-amber-900' 
                      : 'bg-emerald-50 border border-emerald-100 text-emerald-900'
                  }`}>
                    {manualOverride 
                      ? '⚠️ AUTO-REVOCATION OVERRIDDEN: Student is exempted from consistency check auto-rules.' 
                      : '✅ AUTO-REVOCATION ACTIVE: System checks at 9:00 AM daily. 10 consecutive missed reports will automatically revoke premium.'
                    }
                  </div>
                </div>

                {/* D. Mentor Actions Bento Grid */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                  <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-600" /> Premium Access Controller
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Column 1: Grant & Extend */}
                    <div className="space-y-3">
                      {/* Box 1: Grant New */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">1. Grant Premium</p>
                          <span className="text-[8px] text-indigo-600 font-bold uppercase">Setup new access</span>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            min="1" 
                            max="365"
                            className="w-16 bg-slate-50 border border-slate-200 text-center font-black text-xs rounded-lg outline-none p-1.5"
                            value={customDays} 
                            onChange={e => setCustomDays(parseInt(e.target.value) || 0)}
                          />
                          <button 
                            onClick={() => handleGrantPremium(customDays)}
                            disabled={loading}
                            className="flex-1 bg-indigo-600 text-white font-black text-[9px] py-2 uppercase tracking-widest rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-100 transition-colors"
                          >
                            Grant Premium Access
                          </button>
                        </div>
                        <div className="flex gap-1.5">
                          {[30, 90, 180].map(d => (
                            <button 
                              key={d} 
                              type="button"
                              onClick={() => handleGrantPremium(d)}
                              disabled={loading}
                              className="flex-1 bg-slate-50 border border-slate-150 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 text-slate-700 font-black text-[8px] py-1.5 rounded transition-all"
                            >
                              +{d} Days
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Box 2: Extend Existing */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">3. Extend Premium</p>
                          <span className="text-[8px] text-emerald-600 font-bold uppercase">Extend current period</span>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            min="1" 
                            max="365"
                            className="w-16 bg-slate-50 border border-slate-200 text-center font-black text-xs rounded-lg outline-none p-1.5"
                            value={extendDays} 
                            onChange={e => setExtendDays(parseInt(e.target.value) || 0)}
                          />
                          <button 
                            onClick={() => handleExtendPremium(extendDays)}
                            disabled={loading}
                            className="flex-1 bg-emerald-600 text-white font-black text-[9px] py-2 uppercase tracking-widest rounded-lg hover:bg-emerald-700 shadow-sm shadow-emerald-100 transition-colors"
                          >
                            Extend Premium
                          </button>
                        </div>
                        <div className="flex gap-1.5">
                          {[15, 30, 60].map(d => (
                            <button 
                              key={d} 
                              type="button"
                              onClick={() => handleExtendPremium(d)}
                              disabled={loading}
                              className="flex-1 bg-slate-50 border border-slate-150 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 text-slate-700 font-black text-[8px] py-1.5 rounded transition-all"
                            >
                              +{d} Days
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Conversions, Restore, Revocation */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between gap-3.5">
                      <div>
                        <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">2. Operations & Transitions</p>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {/* Restore Button */}
                          <button
                            onClick={handleRestorePremium}
                            disabled={loading}
                            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black py-2.5 rounded-lg text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                          >
                            <History size={11} /> Restore Premium
                          </button>

                          {/* Reset Missed Days Button */}
                          <button
                            onClick={handleResetMissedDays}
                            disabled={loading}
                            className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-black py-2.5 rounded-lg text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw size={11} /> Reset Missed Days
                          </button>

                          {/* Convert Free -> Premium */}
                          <button
                            onClick={handleConvertFreeToPremium}
                            disabled={loading}
                            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black py-2.5 rounded-lg text-[9px] uppercase tracking-widest shadow-xs transition-all flex items-center justify-center gap-1.5"
                          >
                            <ChevronRight size={12} /> Convert Free ➔ Premium
                          </button>

                          {/* Convert Premium -> Free */}
                          <button
                            onClick={handleConvertPremiumToFree}
                            disabled={loading}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-black py-2.5 rounded-lg text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                          >
                            <ChevronLeft size={12} /> Convert Premium ➔ Free
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">4. Manual Suspension</p>
                        {/* Remove Premium */}
                        <button 
                          onClick={handleRemovePremium}
                          disabled={!isPremium || loading}
                          className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-45 border border-rose-200/60 font-black py-2.5 rounded-lg text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                        >
                          <ShieldAlert size={12} /> Remove Premium Access
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* E. Real-Time Premium History Log Stream */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <History size={14} className="text-slate-500" /> Real-Time Audit History Logs
                  </h5>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 max-h-[220px] overflow-y-auto custom-scrollbar text-[10px] space-y-3">
                    {premiumHistory.length === 0 ? (
                      <p className="text-center text-slate-400 font-bold py-6">No premium log audit history found.</p>
                    ) : (
                      premiumHistory.map((log) => (
                        <div key={log.id || log.timestamp} className="bg-white p-3 rounded-xl border border-slate-100 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] px-2 py-0.5 font-black uppercase rounded-full ${
                                log.action.includes('Grant') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                log.action.includes('Remove') || log.action.includes('Revoke') ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                log.action.includes('Convert') ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              }`}>
                                {log.action}
                              </span>
                              <span className="font-extrabold text-slate-600 text-[9px]">By: {log.updatedByName || 'Mentor'}</span>
                            </div>
                            <span className="text-[8px] font-black text-slate-400">
                              {log.date ? `${log.date} ${log.time || ''}` : new Date(log.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                            <div>
                              <span className="text-slate-400 font-extrabold uppercase text-[7px] block">Transition:</span>
                              <p className="font-bold text-slate-700">{log.previousStatus || 'FREE'} ➔ {log.newStatus || log.status}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 font-extrabold uppercase text-[7px] block">Expiry:</span>
                              <p className="font-bold text-slate-700 truncate">{log.previousExpiryDate || 'None'} ➔ {log.newExpiryDate || log.premiumExpiryDate || 'None'}</p>
                            </div>
                          </div>

                          {log.reason && (
                            <p className="text-slate-500 font-bold text-[9px] pl-1.5 border-l-2 border-slate-200">
                              <span className="text-slate-400 text-[8px] font-extrabold uppercase">Reason:</span> {log.reason}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4 flex-1"
              >
                <div>
                  <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase mb-1">Student Security Profile</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Device compliance, active audits, and IP verifications</p>
                </div>

                {/* Security Audit Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* IP address details */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150/80 space-y-2.5">
                    <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                      <Database size={14} className="text-indigo-600" /> IP Audit Information
                    </h5>
                    <div className="space-y-2 text-[10px]">
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                        <span className="font-extrabold text-slate-400 uppercase tracking-wide">Registration IP</span>
                        <code className="font-mono bg-slate-100 text-indigo-950 px-2 py-0.5 rounded font-black text-[9.5px]">
                          {privateProfile?.registrationIP || 'Not Logged'}
                        </code>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                        <span className="font-extrabold text-slate-400 uppercase tracking-wide">Current/Last Known IP</span>
                        <code className="font-mono bg-slate-100 text-indigo-950 px-2 py-0.5 rounded font-black text-[9.5px]">
                          {privateProfile?.currentIP || 'Not Logged'}
                        </code>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                        <span className="font-extrabold text-slate-400 uppercase tracking-wide">Last Login IP</span>
                        <code className="font-mono bg-slate-100 text-indigo-950 px-2 py-0.5 rounded font-black text-[9.5px]">
                          {privateProfile?.lastLoginIP || 'Not Logged'}
                        </code>
                      </div>
                    </div>
                  </div>

                  {/* Device and Stats */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150/80 space-y-2.5">
                    <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                      <Laptop size={14} className="text-indigo-600" /> Device & Audit Telemetry
                    </h5>
                    <div className="space-y-2 text-[10px]">
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                        <span className="font-extrabold text-slate-400 uppercase tracking-wide">Total Login Count</span>
                        <span className="font-black text-slate-800">{privateProfile?.loginCount || 1} Logins</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                        <span className="font-extrabold text-slate-400 uppercase tracking-wide">Registration Date</span>
                        <span className="font-black text-slate-800">
                          {privateProfile?.registrationDate ? new Date(privateProfile.registrationDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                        <span className="font-extrabold text-slate-400 uppercase tracking-wide">Last Active Date</span>
                        <span className="font-black text-slate-800">
                          {privateProfile?.lastActiveDate ? new Date(privateProfile.lastActiveDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Device Info Header userAgent */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex items-start gap-2.5 text-[10px]">
                  <Laptop className="text-slate-500 shrink-0 mt-0.5" size={14} />
                  <div>
                    <span className="font-extrabold text-slate-400 uppercase tracking-wider block">Registered Device Info (User Agent)</span>
                    <p className="font-mono text-slate-600 mt-0.5 leading-relaxed text-[9px] break-all">
                      {privateProfile?.deviceInfo || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome Applet'}
                    </p>
                  </div>
                </div>

                {/* Live Security History stream */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity size={14} className="text-rose-600 animate-pulse" /> Live Security Audit History Stream
                  </h5>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-[160px] overflow-y-auto custom-scrollbar text-[10px] space-y-2.5">
                    {securityHistory.length === 0 ? (
                      <p className="text-center text-slate-400 font-medium py-4">No security audit logs recorded yet.</p>
                    ) : (
                      securityHistory.map((log) => (
                        <div key={log.id || log.timestamp} className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className={`text-[7px] px-1 font-black uppercase rounded ${
                              log.type === 'login' ? 'bg-indigo-100 text-indigo-800' :
                              log.type === 'active_check' ? 'bg-amber-100 text-amber-800' :
                              log.type === 'registration' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {log.type}
                            </span>
                            <span className="text-[7.5px] font-black text-slate-400">
                              {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-700 font-medium text-[9.5px] leading-snug">{log.details}</p>
                          {log.ipAddress && (
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-50 text-[8px] font-mono text-slate-400">
                              <span>IP: {log.ipAddress}</span>
                              <span>•</span>
                              <span className="truncate max-w-[280px]">Device: {log.deviceInfo}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default StudentManagementModal;
