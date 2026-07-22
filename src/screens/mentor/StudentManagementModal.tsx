import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Activity, Laptop, Database, Copy, Check, User, Info, AlertTriangle, Trash2 } from 'lucide-react';
import { User as UserType } from '../../models/user';
import { Batch } from '../../models/mission';
import { BatchService } from '../../services/batch';
import { updateUserProfile, deleteUserProfile } from '../../services/users';
import { db } from '../../services/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { PremiumService, SecurityHistoryLog } from '../../services/premium';
import { checkPremiumStatus } from '../../providers/AuthProvider';

const StudentManagementModal = ({ 
  user, 
  onClose, 
  onSaved 
}: { 
  user: UserType; 
  onClose: () => void; 
  onSaved: () => void; 
}) => {
  const studentId = user.id || user.uid || (user as any).mobile || '';

  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState(user.batchId || '');
  const [name, setName] = useState(user.name || '');
  const [status, setStatus] = useState<any>(user.status || 'active');
  const [role, setRole] = useState(user.role || 'student');
  const [registrationDate, setRegistrationDate] = useState<string>(user.registrationDate || 'N/A');
  const [mobile, setMobile] = useState<string>(user.mobile || 'N/A');
  const [currentBatch, setCurrentBatch] = useState<string>(user.currentBatch || 'Aspirants');

  // Private profile states (audit info)
  const [privateProfile, setPrivateProfile] = useState<any>(null);
  const [securityHistory, setSecurityHistory] = useState<SecurityHistoryLog[]>([]);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'basic' | 'security' | 'premium'>('basic');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [daysToGrant, setDaysToGrant] = useState('');

  const calculatedPremium = checkPremiumStatus(user);

  const handleGrantPremium = async () => {
    const days = parseInt(daysToGrant, 10);
    if (isNaN(days) || days <= 0) {
      alert('Please enter a valid number of days.');
      return;
    }
    setLoading(true);
    try {
      const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      await updateUserProfile(studentId, {
        isPremium: true,
        premiumStatus: 'PREMIUM',
        premiumExpiryDate: expiry.toISOString(),
        remainingPremiumDays: days,
        testAccess: 'premium'
      });
      alert(`Successfully granted ${days} days of Premium access to ${name}!`);
      setDaysToGrant('');
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to grant premium access.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokePremium = async () => {
    if (!window.confirm(`Are you sure you want to revoke Premium access for ${name}?`)) {
      return;
    }
    setLoading(true);
    try {
      await updateUserProfile(studentId, {
        isPremium: false,
        premiumStatus: 'FREE',
        premiumExpiryDate: '',
        remainingPremiumDays: 0,
        testAccess: 'free'
      });
      alert(`Successfully revoked Premium access for ${name}.`);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to revoke premium access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load Batches
    BatchService.getBatches().then(setBatches).catch(console.error);

    // Load private profile data for registration/current IP, devices
    if (studentId) {
      getDoc(doc(db, 'users_private', studentId))
         .then(snap => {
           if (snap.exists()) {
             setPrivateProfile(snap.data());
           }
         })
         .catch(err => console.error("Error reading private student profile:", err));

      // Load security history
      PremiumService.getSecurityHistory(studentId)
        .then(setSecurityHistory)
        .catch(err => console.error("Error loading security logs:", err));
    }
  }, [studentId]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(studentId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 font-sans">
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
              <User size={14} /> Profile Config
            </button>

            <button 
              onClick={() => setActiveTab('premium')}
              className={`flex-1 md:flex-initial py-3 px-4 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2.5 transition-all ${
                activeTab === 'premium' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
              }`}
            >
              <Shield size={14} /> Premium Access
            </button>

            <button 
              onClick={() => setActiveTab('security')}
              className={`flex-1 md:flex-initial py-3 px-4 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2.5 transition-all ${
                activeTab === 'security' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
              }`}
            >
              <Activity size={14} /> Security & Audit
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
                  <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase mb-1">Student Profile Configuration</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Update student profile attributes, credentials, and access status</p>
                </div>

                {/* Candidate Credentials Bento Box */}
                <div className="bg-slate-50/70 p-4 rounded-3xl border border-slate-150 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
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
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Current Batch</span>
                      <p className="text-[10.5px] font-black text-indigo-600 truncate mt-0.5">{currentBatch || 'Aspirants'}</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Allotted Status</span>
                      <p className="text-[10px] font-black text-slate-700 mt-0.5">
                        {(status || 'active').toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Editable Profile Settings */}
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Student Name</label>
                    <input
                      className="w-full bg-slate-100 border border-transparent rounded-2xl py-3 px-4 text-xs font-black outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">User Role</label>
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
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Registration Date</label>
                    <input
                      type="date"
                      className="w-full bg-slate-100 border border-transparent rounded-2xl py-3 px-4 text-xs font-black outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
                      value={registrationDate && registrationDate !== 'N/A' ? registrationDate : ''}
                      onChange={e => setRegistrationDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Account Access Status</label>
                    <div className="flex gap-1.5">
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
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col gap-2.5 mt-auto">
                  <button onClick={handleUpdateBasic} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all">
                    {loading ? 'Saving Changes...' : 'Save Configuration'}
                  </button>

                  <button 
                    onClick={async () => {
                      if (window.confirm(`Are you absolutely sure you want to remove ${name} from the application? This action is irreversible.`)) {
                        setLoading(true);
                        try {
                          await deleteUserProfile(studentId);
                          onSaved();
                          onClose();
                        } catch (err) {
                          console.error(err);
                          alert('Failed to remove student from application.');
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    disabled={loading} 
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-black py-3 rounded-2xl transition-all text-[9px] uppercase tracking-widest border border-rose-100 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={12} /> Remove Student Permanently
                  </button>
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
                        <span className="font-extrabold text-slate-400 uppercase tracking-wide">Current IP</span>
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
                      <Laptop size={14} className="text-indigo-600" /> Device & Telemetry
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

                {/* Device Info */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex items-start gap-2.5 text-[10px]">
                  <Laptop className="text-slate-500 shrink-0 mt-0.5" size={14} />
                  <div>
                    <span className="font-extrabold text-slate-400 uppercase tracking-wider block">Registered Device Info</span>
                    <p className="font-mono text-slate-600 mt-0.5 leading-relaxed text-[9px] break-all">
                      {privateProfile?.deviceInfo || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome Applet'}
                    </p>
                  </div>
                </div>

                {/* Security History stream */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity size={14} className="text-rose-600 animate-pulse" /> Security Audit History Stream
                  </h5>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-[220px] overflow-y-auto custom-scrollbar text-[10px] space-y-2.5">
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

            {activeTab === 'premium' && (
              <motion.div
                key="premium"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4 flex-1 animate-in fade-in duration-200"
              >
                <div>
                  <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase mb-1">Premium Access Control</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Grant or revoke premium days directly. Mentors have highest authority.</p>
                </div>

                {/* Current Premium Status Card */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-3xl space-y-3">
                  <h5 className="text-[10px] font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
                    <Shield size={14} className="text-indigo-600" /> Current Subscription Status
                  </h5>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Calculated Status</span>
                      <p className={`text-[11px] font-black mt-0.5 uppercase ${calculatedPremium.isPremium ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {calculatedPremium.isPremium ? '★ PREMIUM ACTIVE' : 'FREE ACCESS'}
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Remaining Days</span>
                      <p className="text-[11px] font-black text-slate-800 mt-0.5">
                        {calculatedPremium.remainingPremiumDays} Days
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col justify-center col-span-2">
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Premium Expiry Date</span>
                      <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                        {user.premiumExpiryDate ? new Date(user.premiumExpiryDate).toLocaleString('en-IN') : 'None (Trial or Free)'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Direct Grant Option */}
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-150 space-y-3">
                  <h5 className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                    👑 Direct Premium Grant (No Payment Needed)
                  </h5>
                  <p className="text-[10px] text-slate-500 font-medium">
                    As a mentor, you can bypass payments and directly grant any number of premium days to this student. The period begins from the current moment.
                  </p>

                  <div className="flex gap-2.5 items-end">
                    <div className="flex-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Number of Days to Grant</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 30, 90, 365"
                        value={daysToGrant}
                        onChange={(e) => setDaysToGrant(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-xs font-black outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
                      />
                    </div>
                    <button
                      onClick={handleGrantPremium}
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-100 shrink-0"
                    >
                      {loading ? 'Granting...' : 'Grant Days'}
                    </button>
                  </div>
                </div>

                {/* Revoke / Downgrade Option */}
                <div className="bg-rose-50/30 p-4 rounded-3xl border border-rose-100 space-y-2">
                  <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-widest">
                    ⚠️ Revoke Premium Access
                  </h5>
                  <p className="text-[10px] text-rose-750 font-medium">
                    Remove all premium access. The student's status will instantly reset to FREE.
                  </p>
                  <button
                    onClick={handleRevokePremium}
                    disabled={loading}
                    className="w-full bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-black py-3 rounded-2xl text-xs uppercase tracking-widest transition-all"
                  >
                    {loading ? 'Processing...' : 'Revert Student to Free'}
                  </button>
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
