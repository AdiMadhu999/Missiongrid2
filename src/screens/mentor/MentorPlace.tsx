import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, Search, UserPlus, LogOut, Layers, 
  Star, Shield, AlertTriangle, History, 
  Award, Trophy, MoreVertical, CheckCircle2,
  Filter, X, PlusCircle, Power, Ban, ToggleLeft, ToggleRight,
  TrendingUp, Activity, Smartphone, Hash, Navigation,
  Calendar, Megaphone, GraduationCap, Settings, UserCog,
  Trash2, Edit2, MessageSquare, Mic, Square, BarChart3, Plus, Volume2, RefreshCw, Zap, UploadCloud, ShieldAlert, Crown
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { APP_VERSION } from '../../version';
import { getUsers, createUserProfile, updateUserProfile, getPublicUsers } from '../../services/users';
import { toast } from 'react-hot-toast';
import { BatchService } from '../../services/batch';
import { User } from '../../models/user';
import { Batch } from '../../models/mission';
import { Warning } from '../../models/warning';
import { issueWarning, getStudentWarnings } from '../../services/mentor-actions';
import { 
  getSystemSettings, updateSystemSettings, logAuditAction
} from '../../services/system';
import { db, auth } from '../../services/firebase';
import { collection, query, orderBy, limit, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { SystemSettings } from '../../models/system';
import AuthorityControlModal from '../users/AuthorityControlModal';
import MissionReviewWorkspace from './MissionReviewWorkspace';
import LeaveManagementModal from './LeaveManagementModal';
import StudentManagementModal from './StudentManagementModal';
import HolidayDeclarationModal from './HolidayDeclarationModal';
import LeaveRequestApprovalModal from './LeaveRequestApprovalModal';
import ResetStatsModal from './ResetStatsModal';
import DatabaseResetTool from '../admin/DatabaseResetTool';
import { safeDate } from '../../utils/date';
import { PremiumManagementDashboard } from './PremiumManagementDashboard';

// ... (skipping some code if possible, but edit_file requires precise match)
// Actually I'll match the whole component start 

const AuditRegistryView = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudits = async () => {
      const q = query(collection(db, 'audits'), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchAudits();
  }, []);

  if (loading) return <div className="text-center py-10 animate-pulse text-[10px] font-black text-slate-400">ACCESSING REGISTRY...</div>;

  return (
    <div className="space-y-3">
      {logs.map(log => (
        <div key={log.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[10px] font-black text-indigo-600 uppercase">{log.actorName}</span>
            <span className="text-[8px] font-bold text-slate-400">{safeDate(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p className="text-[11px] font-bold text-slate-900">{log.action}</p>
          {log.details && <p className="text-[10px] text-slate-400 mt-1 italic">"{log.details}"</p>}
        </div>
      ))}
    </div>
  );
};

const UserCreationModal = ({ onClose, onCreated, mentor }: { onClose: () => void, onCreated: () => void, mentor: any }) => {
    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [role, setRole] = useState<'student' | 'mentor' | 'examiner'>('student');
    const [batchId, setBatchId] = useState('');
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        BatchService.getBatches().then(setBatches);
    }, []);

    const handleCreate = async () => {
        if (!name || mobile.length < 10) return alert('Valid name and mobile required');
        setLoading(true);
        try {
            // Simplified creation logic for Mentor Place operational feel
            const studentCode = `AGENT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            await createUserProfile({ 
                name, 
                mobile, 
                role, 
                batchId,
                studentCode,
                status: 'active',
                missionPoints: 0,
                consistencyIndex: 100,
                category: 'Base',
                createdAt: new Date().toISOString()
            });
            await logAuditAction(mentor.uid, mentor.name, 'Enrolled New Agent', mobile, name);
            alert(`New personnel enrolled: ${studentCode}`);
            onCreated();
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 font-sans">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Enroll Personnel</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="space-y-4 mb-8">
                    <input 
                        placeholder="Full Name"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-indigo-500 transition-all"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                    <input 
                        placeholder="Mobile Contact"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-indigo-500 transition-all"
                        value={mobile}
                        onChange={e => setMobile(e.target.value)}
                    />
                    <select 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-indigo-500 transition-all"
                        value={role}
                        onChange={e => setRole(e.target.value as any)}
                    >
                        <option value="student">Student</option>
                        <option value="mentor">Mentor</option>
                        <option value="examiner">Examiner</option>
                    </select>
                    <select 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-indigo-500 transition-all"
                        value={batchId}
                        onChange={e => setBatchId(e.target.value)}
                    >
                        <option value="">No Batch Assigned</option>
                        {batches.map(b => (
                            <option key={b.id} value={b.id}>{b.batchName}</option>
                        ))}
                    </select>
                </div>
                <button 
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white font-black py-4 rounded-3xl translation-all shadow-lg shadow-indigo-100"
                >
                    {loading ? 'Registering...' : 'Deploy to Field'}
                </button>
            </motion.div>
        </div>
    );
};


const BatchOrchestrationModal = ({ mentor, onClose }: { mentor: any, onClose: () => void }) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchCode, setNewBatchCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    BatchService.getBatches().then(setBatches);
  }, []);

  const handleCreate = async () => {
    if (!newBatchName || !newBatchCode) return alert('Fill name & code');
    setLoading(true);
    await BatchService.createBatch({
      batchName: newBatchName,
      batchCode: newBatchCode,
      description: '',
      status: 'active',
      mentorId: mentor.id || mentor.uid,
      examinerIds: [],
      studentIds: [],
      createdBy: mentor.id || mentor.uid,
    });
    setNewBatchName('');
    setNewBatchCode('');
    setBatches(await BatchService.getBatches());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 font-sans">
      <motion.div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100">
        <h3 className="text-xl font-black text-slate-900 mb-6">Batch Orchestration</h3>
        <div className="space-y-4 mb-8">
            <input placeholder="Name" className="w-full bg-slate-50 border rounded-2xl p-4 outline-none" value={newBatchName} onChange={e => setNewBatchName(e.target.value)} />
            <input placeholder="Code" className="w-full bg-slate-50 border rounded-2xl p-4 outline-none" value={newBatchCode} onChange={e => setNewBatchCode(e.target.value)} />
            <button onClick={handleCreate} disabled={loading} className="w-full bg-indigo-600 text-white rounded-2xl p-4 font-bold">{loading ? 'Creating...' : 'Create'}</button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
            {batches.map(b => (
                <div key={b.id} className="p-4 bg-slate-50 rounded-xl text-sm font-bold">{b.batchName} ({b.batchCode})</div>
            ))}
        </div>
        <button onClick={onClose} className="w-full mt-4 p-4 text-slate-500 font-bold border rounded-2xl bg-slate-50">Close</button>
      </motion.div>
    </div>
  );
};

import { MissionService } from '../../services/mission';

const PointsModal = ({ user, onClose, onSaved }: { user: User, onClose: () => void, onSaved: () => void }) => {
  const [points, setPoints] = useState(0); // Default to 0, mentor enters adjustment
  const [loading, setLoading] = useState(false);
  const { userProfile } = useAuth(); // Need mentor ID

  const handleSave = async () => {
    if (isNaN(points)) return;
    setLoading(true);
    try {
      const reportData = {
        userId: user.id!,
        userName: user.name,
        userMobile: user.mobile || '',
        batchId: user.batchId || '',
        date: new Date().toISOString().split('T')[0], // Today
        dayKey: `${user.id!}_manual_${new Date().getTime()}`,
        attachments: [],
        note: 'Manual point adjustment by mentor',
        marks: points,
      };
      
      await MissionService.submitManualReport(reportData, points, userProfile?.id || 'admin');
      
      console.log(`[PointsTrace] PointsModal - Manual adjustment of ${points} for ${user.id}`);
      
      onSaved();
      onClose();
      toast.success('Points adjusted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update points');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100 my-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Modify Points</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
        </div>
        
        <p className="text-xs text-slate-500 mb-4 font-medium uppercase tracking-widest leading-relaxed">
          Updating points for <span className="text-indigo-600 font-black">{user.name}</span>. Total mission points reflected globally.
        </p>

        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Trophy className="w-5 h-5 text-indigo-500" />
          </div>
          <input 
            type="number"
            value={points}
            onChange={e => setPoints(Number(e.target.value))}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl py-4 pl-12 pr-4 text-2xl font-black text-slate-900 outline-none focus:border-indigo-600 transition-all text-center"
            autoFocus
          />
        </div>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-3xl transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 group"
        >
          {loading ? 'Processing...' : (
            <>
              <Award className="w-5 h-5 group-hover:scale-110 transition-transform"/>
              Confirm Allocation
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
};

const WarningModal = ({ user, onClose, onSaved, mentor }: { user: User, onClose: () => void, onSaved: () => void, mentor: any }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleIssue = async () => {
    if (!reason.trim()) return alert('Please provide a reason');
    setLoading(true);
    try {
      await issueWarning({
        studentId: user.id || user.mobile!,
        studentName: user.name,
        reason: reason,
        mentorId: mentor.uid || 'system',
        mentorName: mentor.name || 'Mentor',
        date: new Date().toISOString(),
        status: 'Active'
      });
      alert(`Official strike issued to ${user.name}`);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to issue warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100 my-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Issue Warning</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <textarea 
          placeholder="Enter violation details or administrative strikes..."
          className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-4 text-sm font-medium text-slate-900 outline-none focus:border-rose-600 transition-all resize-none h-32 mb-6"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />

        <button 
          onClick={handleIssue}
          disabled={loading}
          className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-4 rounded-3xl transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2 group"
        >
          <AlertTriangle className="w-5 h-5 group-hover:animate-pulse"/>
          Issue Official Strike
        </button>
      </motion.div>
    </div>
  );
};

const WarningHistoryModal = ({ user, onClose }: { user: User, onClose: () => void }) => {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentWarnings(user.id || user.mobile!).then(setWarnings).finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100 max-h-[80vh] flex flex-col my-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Warning History</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-10 text-slate-400 font-black text-[10px] uppercase tracking-widest">Scanning Registry...</div>
          ) : warnings.length === 0 ? (
            <div className="text-center py-10">
              <History size={40} className="mx-auto text-slate-100 mb-4" />
              <p className="text-slate-400 text-xs font-medium leading-relaxed">No previous strikes or warnings on record.</p>
            </div>
          ) : (
            warnings.map(w => (
              <div key={w.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9px] font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full uppercase">Official Strike</span>
                  <span className="text-[9px] font-bold text-slate-400">{safeDate(w.date).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed italic">"{w.reason}"</p>
                <div className="mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mentor: {w.mentorName}</div>
              </div>
            ))
          )}
        </div>

        <button onClick={onClose} className="w-full mt-6 bg-slate-900 text-white font-black py-4 rounded-3xl transition-all shadow-lg shadow-slate-100">Dismiss Registry</button>
      </motion.div>
    </div>
  );
};

const RulesModal = ({ onClose, mentor, onBatchOrchestration, onLeaveManagement, onDeclareHoliday, onApproveLeave, onResetStats }: { onClose: () => void, mentor: any, onBatchOrchestration: () => void, onLeaveManagement: () => void, onDeclareHoliday: () => void, onApproveLeave: () => void, onResetStats: () => void }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'emergency' | 'holidays' | 'audit' | 'evaluation'>('menu');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getSystemSettings().then(setSettings);
    
    const unsubscribe = onSnapshot(doc(db, 'system', 'global_config'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as SystemSettings);
      }
    }, (err) => {
      console.warn("MentorPlace settings listener restricted or failed:", err);
    });

    return () => unsubscribe();
  }, []);

  const handleSaveSettings = async (updates: Partial<SystemSettings>) => {
    setLoading(true);
    try {
      await updateSystemSettings(updates);
      setSettings(prev => prev ? { ...prev, ...updates } : null);
      await logAuditAction(mentor.uid, mentor.name, 'Updated Global Config', undefined, JSON.stringify(updates));
      alert('Global configuration updated');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] relative"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            {activeTab !== 'menu' && (
              <button onClick={() => setActiveTab('menu')} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mb-1">
                <Navigation size={10} className="-rotate-90" /> Back to Authority
              </button>
            )}
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'menu' ? 'System Authority' : 
               activeTab === 'emergency' ? 'Emergency Protocol' :
               activeTab === 'holidays' ? 'Institution Off Days' :
               activeTab === 'evaluation' ? 'Evaluation Standards' : 'Audit Registry'}
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Global Command & Rules
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {activeTab === 'menu' && (
            <>
              {[
                { id: 'declare_holiday', label: 'Declare Holiday', icon: Calendar, color: 'text-sky-500 bg-sky-50', desc: 'Declare a new institutional holiday.' },
                { id: 'approve_leave', label: 'Approve Leave Request', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50', desc: 'Review and approve student leave requests.' },
                { id: 'reset_stats', label: 'Reset Operations', icon: Power, color: 'text-rose-600 bg-rose-50', desc: 'Reset global leaderboard or start 10-day cycle.' },
                { id: 'holidays', label: 'Holiday Framework', icon: Calendar, color: 'text-sky-500 bg-sky-50', desc: 'Define institutional off-days and rest periods.' },
                { id: 'emergency', label: 'Emergency Protocol', icon: AlertTriangle, color: 'text-rose-500 bg-rose-50', desc: 'Configure automatic waiver thresholds for crises.' },
                { id: 'evaluation', label: 'Evaluation Rules', icon: Shield, color: 'text-indigo-500 bg-indigo-50', desc: 'Set point multipliers and consistency standards.' },
                { id: 'leave', label: 'Attendance Management', icon: Calendar, color: 'text-rose-500 bg-rose-50', desc: 'Manage agent attendance excusals.' },
                { id: 'batches', label: 'Batch Orchestration', icon: Layers, color: 'text-fuchsia-500 bg-fuchsia-50', desc: 'Create, modify and merge student battalions.' },
                { id: 'audit', label: 'Audit Registry', icon: Activity, color: 'text-emerald-500 bg-emerald-50', desc: 'Review all high-authority mentor interactions.' },
                { id: 'ai_config', label: 'AI Configuration', icon: Zap, color: 'text-indigo-600 bg-indigo-50', desc: 'Monitor Gemini key pool and failover status.' },
                { id: 'publish_update', label: 'Publish Update', icon: UploadCloud, color: 'text-indigo-600 bg-indigo-50', desc: `Push Version ${APP_VERSION} to all active force units.` }
              ].map((rule) => (
                <button 
                  key={rule.id} 
                  onClick={() => {
                    if (rule.id === 'batches') {
                      onBatchOrchestration();
                    } else if (rule.id === 'leave') {
                      onLeaveManagement();
                    } else if (rule.id === 'declare_holiday') {
                      onDeclareHoliday();
                      onClose();
                    } else if (rule.id === 'approve_leave') {
                      onApproveLeave();
                      onClose();
                    } else if (rule.id === 'reset_stats') {
                      onResetStats();
                      onClose();
                    } else if (rule.id === 'ai_config') {
                      navigate('/app/ai-config');
                      onClose();
                    } else if (rule.id === 'publish_update') {
                      if (window.confirm(`Publish Version ${APP_VERSION} to all users? This will trigger an instant update prompt.`)) {
                        handleSaveSettings({ appVersion: APP_VERSION });
                      }
                    } else {
                      setActiveTab(rule.id as any);
                    }
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all group hover:scale-[1.02]"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${rule.color}`}>
                    <rule.icon size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-slate-900">{rule.label}</p>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{rule.desc}</p>
                  </div>
                </button>
              ))}
            </>
          )}

          {activeTab === 'evaluation' && settings && (
            <div className="space-y-6">
              <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-4">Consistency Multiplier</label>
                <div className="flex items-center gap-6">
                   <input 
                     type="range" min="0.5" max="2.0" step="0.1" 
                     value={settings.consistencyMultiplier}
                     onChange={e => handleSaveSettings({ consistencyMultiplier: Number(e.target.value) })}
                     className="flex-1 accent-indigo-500"
                   />
                   <span className="text-2xl font-black text-indigo-600 w-12">{settings.consistencyMultiplier.toFixed(1)}x</span>
                </div>
                <p className="text-[9px] text-indigo-400 font-bold mt-4 leading-relaxed uppercase tracking-wider">
                  Global coefficient applied to all performance calculations across the force.
                </p>
              </div>

              <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-4">Elite Requirement (Points)</label>
                <div className="flex items-center gap-4">
                   <Settings className="text-amber-400" size={20} />
                   <input 
                     type="number"
                     value={settings.elitePointRequirement}
                     onChange={e => handleSaveSettings({ elitePointRequirement: Number(e.target.value) })}
                     className="bg-transparent text-xl font-black text-amber-600 outline-none w-full"
                   />
                </div>
                <p className="text-[9px] text-amber-400 font-bold mt-4 leading-relaxed uppercase tracking-wider">
                  Minimum threshold personnel must cross to qualify for Elite Designation.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'holidays' && settings && (
            <div className="space-y-6">
              <div className="bg-sky-50 px-6 py-8 rounded-[2rem] border border-sky-100 text-center">
                 <Calendar className="mx-auto text-sky-400 mb-4" size={32} />
                 <h4 className="text-sm font-black text-sky-900 uppercase tracking-widest px-4">Institutional Rest Management</h4>
                 <p className="text-[10px] text-sky-600 font-medium leading-relaxed mt-2 px-6">Configure system-wide off days. All accountability checks are waived during these periods.</p>
              </div>
              
              <div className="space-y-3">
                 <button 
                   onClick={() => {
                     const date = prompt("Enter holiday date (YYYY-MM-DD):");
                     if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                       handleSaveSettings({ institutionalHolidays: [...(settings.institutionalHolidays || []), date] });
                     } else if (date) {
                       alert("Invalid date format. Use YYYY-MM-DD");
                     }
                   }}
                   className="w-full py-4 border-2 border-dashed border-sky-200 rounded-2xl text-sky-600 text-[10px] font-black uppercase tracking-widest hover:bg-sky-50 transition-all"
                 >
                    + Add Forced Holiday
                 </button>
                 {settings.institutionalHolidays?.length === 0 ? (
                    <p className="text-center py-6 text-slate-300 text-[9px] font-bold uppercase tracking-widest">No holidays scheduled</p>
                 ) : (
                    settings.institutionalHolidays.map(h => (
                       <div key={h} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-900">{h}</span>
                          <button onClick={() => {
                             const filtered = settings.institutionalHolidays.filter(date => date !== h);
                             handleSaveSettings({ institutionalHolidays: filtered });
                          }} className="text-rose-500 p-1 hover:bg-rose-50 rounded-lg transition-all"><X size={14}/></button>
                       </div>
                    ))
                 )}
              </div>
            </div>
          )}



          {activeTab === 'audit' && (
             <div className="space-y-3 pb-4">
                <AuditRegistryView />
             </div>
          )}
        </div>
        
        <div className="mt-8 p-4 bg-slate-900 rounded-[2rem] text-center">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Authorization Verified</p>
            <p className="text-[10px] text-white/50 font-medium leading-relaxed">Changes to system rules apply immediately across all force units.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default function MentorPlace() {
  const { userProfile, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [activeModal, setActiveModal] = useState<'authority' | 'points' | 'warning' | 'history' | 'rules' | 'create' | 'batch_orchestration' | 'leave_management' | 'manage_student' | 'holiday_declaration' | 'leave_request_approval' | 'reset_stats' | 'reset_db' | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view') === 'review' ? 'review' : 'list';
  const [view, setView] = useState<'list' | 'review'>(initialView);

  // Quick Premium Manager states
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isBulkPremiumMode, setIsBulkPremiumMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedBatchIdFilter, setSelectedBatchIdFilter] = useState<string>('all');
  const [selectedPremiumFilter, setSelectedPremiumFilter] = useState<'all' | 'premium' | 'free'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewStyle, setViewStyle] = useState<'table' | 'cards'>('table');
  const [individualUpdatingId, setIndividualUpdatingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  useEffect(() => {
    if (view === 'list') {
      searchParams.delete('view');
      setSearchParams(searchParams);
    }
  }, [view]);

  const getDaysLeftForStudent = (student: User) => {
    const isPremium = !!student.isPremium || student.premiumStatus === 'active' || student.premiumStatus === 'PREMIUM';
    if (!isPremium || !student.premiumExpiryDate) return 0;
    try {
      const diff = new Date(student.premiumExpiryDate).getTime() - Date.now();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || String(err);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    BatchService.getBatches().then(setBatches).catch(console.error);
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action) {
      if (['create', 'batch_orchestration', 'leave_management', 'holiday_declaration', 'leave_request_approval', 'reset_stats', 'reset_db', 'rules'].includes(action)) {
        setActiveModal(action as any);
      }
    }
    if (params.get('view') === 'review') {
      setView('review');
    }
  }, [userProfile?.id]);

  const filteredPremiumStudents = users.filter(u => {
    // Case-insensitive check to identify students/aspirants and exclude mentors/staff/admin
    const roleLower = (u.role || '').toLowerCase();
    const isMentorLike = 
      roleLower === 'mentor' || 
      roleLower === 'primary-mentor' || 
      roleLower === 'primarymentor' || 
      roleLower === 'staff' || 
      roleLower === 'admin' || 
      roleLower === 'examiner';
    const isStudent = !isMentorLike;
    if (!isStudent) return false;

    // Search filter: Student ID, Student Name, Mobile, or Batch name
    const sLower = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      (u.name || '').toLowerCase().includes(sLower) || 
      (u.mobile || '').includes(sLower) ||
      (u.studentCode || '').toLowerCase().includes(sLower) ||
      (u.id || '').toLowerCase().includes(sLower) ||
      (u.currentBatch || '').toLowerCase().includes(sLower) ||
      (u.batchId || '').toLowerCase().includes(sLower);
    
    if (!matchesSearch) return false;

    // Batch filter
    if (selectedBatchIdFilter !== 'all' && u.batchId !== selectedBatchIdFilter) {
      return false;
    }

    // Premium status filter
    if (selectedPremiumFilter === 'premium') {
      const isPremium = !!u.isPremium || u.premiumStatus === 'active' || u.premiumStatus === 'PREMIUM';
      if (!isPremium) return false;
    } else if (selectedPremiumFilter === 'free') {
      const isPremium = !!u.isPremium || u.premiumStatus === 'active' || u.premiumStatus === 'PREMIUM';
      if (isPremium) return false;
    }

    // Account status filter (Active/Inactive)
    const isActive = !u.status || u.status === 'active';
    if (selectedStatusFilter === 'active' && !isActive) {
      return false;
    }
    if (selectedStatusFilter === 'inactive' && isActive) {
      return false;
    }

    return true;
  });

  const filteredUsers = filteredPremiumStudents;

  const handleTogglePremium = async (user: User) => {
    const idToUpdate = user.id || user.mobile!;
    setIndividualUpdatingId(idToUpdate);
    const newPremium = !user.isPremium;
    const toastId = toast.loading(`Saving premium update for ${user.name || 'student'}...`);

    // Store original users list for potential revert on failure
    const originalUsers = [...users];

    // Optimistic Update to local list for immediate visual response
    setUsers(prev => prev.map(u => {
      if ((u.id || u.mobile) === idToUpdate) {
        return {
          ...u,
          isPremium: newPremium,
          testAccess: newPremium ? 'premium' : 'free'
        };
      }
      return u;
    }));

    try {
      await updateUserProfile(idToUpdate, {
        isPremium: newPremium,
        testAccess: newPremium ? 'premium' : 'free'
      });
      // In the background, fetch latest and sync
      const latestUsers = await getUsers();
      setUsers(latestUsers);
      toast.success(`${user.name || 'Student'} premium access is now: ${newPremium ? 'Premium ⭐' : 'Free 🆓'}`, { id: toastId });
    } catch (err) {
      console.error(err);
      // Revert Optimistic Update
      setUsers(originalUsers);
      toast.error('Failed to update premium status. Please try again.', { id: toastId });
    } finally {
      setIndividualUpdatingId(null);
    }
  };

  const handleBulkPremiumUpdate = async (makePremium: boolean) => {
    if (selectedUserIds.size === 0) return;
    setBulkUpdating(true);
    const idsArray = Array.from(selectedUserIds);
    const toastId = toast.loading(`Processing bulk update for ${idsArray.length} students...`);

    // Store original users list for potential revert on failure
    const originalUsers = [...users];

    // Optimistic Update to local list for immediate visual response
    setUsers(prev => prev.map(u => {
      const id = u.id || u.mobile;
      if (id && selectedUserIds.has(id)) {
        return {
          ...u,
          isPremium: makePremium,
          testAccess: makePremium ? 'premium' : 'free'
        };
      }
      return u;
    }));

    try {
      const promises = idsArray.map(async (id) => {
        const u = originalUsers.find(usr => (usr.id || usr.mobile) === id);
        if (u) {
          await updateUserProfile(id, {
            isPremium: makePremium,
            testAccess: makePremium ? 'premium' : 'free'
          });
        }
      });
      
      await Promise.all(promises);
      const latestUsers = await getUsers();
      setUsers(latestUsers);
      setSelectedUserIds(new Set());
      toast.success(`Successfully updated ${idsArray.length} students to ${makePremium ? 'Premium ⭐' : 'Free 🆓'}!`, { id: toastId });
    } catch (err) {
      console.error(err);
      // Revert Optimistic Update
      setUsers(originalUsers);
      toast.error('Failed to bulk update students. Please try again.', { id: toastId });
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredPremiumStudents.map(s => s.id || s.mobile!);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedUserIds.has(id));
    
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredIds.forEach(id => next.delete(id));
      } else {
        allFilteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSelectRow = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (view === 'review') {
    return <MissionReviewWorkspace batchId={userProfile?.batchId || 'all'} onBack={() => { setView('list'); loadUsers(); }} />;
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-112px)] md:h-[calc(100vh-112px)] w-full bg-slate-50 overflow-y-auto md:overflow-hidden font-sans">
      {/* Header Container */}
      <div className="px-4 sm:px-6 pt-6 sm:pt-10 pb-4 sm:pb-6 bg-white border-b border-slate-100">
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Mentor Place</h1>
            <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mt-0.5 sm:mt-1">Command Center</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setView('review')}
              className="flex-1 sm:flex-initial px-3 sm:px-4 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-600 text-white flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-emerald-100 hover:scale-105 transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
            >
              <CheckCircle2 size={16} />
              Review Missions
            </button>
            <button 
              onClick={() => setActiveModal('rules')}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 hover:bg-slate-100 transition-all"
              title="Rules & Controls"
            >
              <Layers size={18} />
            </button>
            <button 
              onClick={() => setActiveModal('create')}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 hover:scale-105 transition-all"
              title="Enroll Personnel"
            >
              <PlusCircle size={20} />
            </button>
            <button 
              onClick={() => logout()}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-100 hover:bg-rose-100 transition-all"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Improved Search Bar */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="Search users by name or mobile..."
            className="w-full bg-slate-100 border border-transparent rounded-3xl py-4 pl-14 pr-6 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* High Priority Actions */}
        <div className="flex gap-2 mt-4 overflow-x-auto custom-scrollbar pb-1">
          <button onClick={() => setActiveModal('holiday_declaration')} className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 border border-sky-100 text-sky-700 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
            <Calendar size={12} /> Declare Holiday
          </button>
          <button onClick={() => setActiveModal('leave_request_approval')} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
            <CheckCircle2 size={12} /> Approve Leaves
          </button>
          <button onClick={() => setActiveModal('reset_stats')} className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
            <Power size={12} /> Reset Operations
          </button>
          {auth.currentUser?.phoneNumber === '+917407463884' && (
            <button onClick={() => setActiveModal('reset_db')} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
              <ShieldAlert size={14}/> Reset DB
            </button>
          )}
        </div>

        {/* Global Student Management Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Allotted Batch</label>
            <select
              value={selectedBatchIdFilter}
              onChange={e => {
                setSelectedBatchIdFilter(e.target.value);
                setSelectedUserIds(new Set());
              }}
              className="w-full bg-slate-100 border border-transparent rounded-2xl py-3 px-4 text-xs font-black text-slate-800 outline-none focus:bg-white focus:border-indigo-200 focus:ring-2 focus:ring-indigo-50/50 transition-all cursor-pointer"
            >
              <option value="all">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.batchName}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Premium Status</label>
            <select
              value={selectedPremiumFilter}
              onChange={e => {
                setSelectedPremiumFilter(e.target.value as any);
                setSelectedUserIds(new Set());
              }}
              className="w-full bg-slate-100 border border-transparent rounded-2xl py-3 px-4 text-xs font-black text-slate-800 outline-none focus:bg-white focus:border-indigo-200 focus:ring-2 focus:ring-indigo-50/50 transition-all cursor-pointer"
            >
              <option value="all">All Access Types</option>
              <option value="premium">👑 Premium Only</option>
              <option value="free">🆓 Free Only</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Account Status</label>
            <select
              value={selectedStatusFilter}
              onChange={e => {
                setSelectedStatusFilter(e.target.value as any);
                setSelectedUserIds(new Set());
              }}
              className="w-full bg-slate-100 border border-transparent rounded-2xl py-3 px-4 text-xs font-black text-slate-800 outline-none focus:bg-white focus:border-indigo-200 focus:ring-2 focus:ring-indigo-50/50 transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">🟢 Active Only</option>
              <option value="inactive">🔴 Inactive Only</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Display View</label>
            <div className="flex gap-1.5 h-[42px]">
              <button
                type="button"
                onClick={() => setViewStyle('table')}
                className={`flex-1 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  viewStyle === 'table' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                }`}
              >
                Table Directory
              </button>
              <button
                type="button"
                onClick={() => setViewStyle('cards')}
                className={`flex-1 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  viewStyle === 'cards' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                }`}
              >
                Cards Grid
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Tabs Selector */}
      <div className="px-6 py-4 bg-white border-b border-slate-150/60 flex gap-3 flex-wrap items-center">
        <button 
          onClick={() => {
            setIsBulkPremiumMode(false);
            setSelectedUserIds(new Set());
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${!isBulkPremiumMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-500 border border-slate-200/50 hover:bg-slate-100'}`}
        >
          <Users size={14} />
          Detailed Directory
        </button>
        <button 
          onClick={() => {
            setIsBulkPremiumMode(true);
            setSelectedUserIds(new Set());
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${isBulkPremiumMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-500 border border-slate-200/50 hover:bg-slate-100'}`}
        >
          <Zap size={14} className={isBulkPremiumMode ? "fill-amber-400 text-amber-400" : "text-amber-500"} />
          ⚡ Quick Premium Panel
        </button>
      </div>

      {isBulkPremiumMode ? (
        <div className="flex-1 flex flex-col bg-slate-50">
          {/* Controls Bar */}
          <div className="px-6 py-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex flex-col">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Bulk Premium Operations</h4>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">Select multiple candidates and apply updates simultaneously.</p>
            </div>

            {/* Quick summary numbers */}
            <div className="flex items-center gap-4 text-xs bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 font-bold text-slate-600">
              <div>
                Total Students: <span className="text-slate-900 font-black">{filteredPremiumStudents.length}</span>
              </div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
              <div>
                Premium: <span className="text-indigo-600 font-black">{filteredPremiumStudents.filter(s => s.isPremium || s.premiumStatus === 'active' || s.premiumStatus === 'PREMIUM').length}</span>
              </div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
              <div>
                Free: <span className="text-slate-500 font-black">{filteredPremiumStudents.filter(s => !s.isPremium && s.premiumStatus !== 'active' && s.premiumStatus !== 'PREMIUM').length}</span>
              </div>
            </div>
          </div>

          {/* High-density Students Table */}
          <div className="flex-1 md:overflow-y-auto px-6 py-4 pb-32">
            {error ? (
              <div className="text-center py-20 bg-rose-50 rounded-[2.5rem] border border-dashed border-rose-200 px-6">
                <AlertTriangle size={40} className="mx-auto text-rose-500 mb-4 animate-bounce" />
                <p className="text-rose-800 font-black uppercase text-xs tracking-widest">Failed to load candidates</p>
                <p className="text-rose-600 text-xs mt-2 max-w-md mx-auto">{error}</p>
                <button
                  onClick={loadUsers}
                  className="mt-4 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-rose-200"
                >
                  Retry Loading
                </button>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading candidates...</p>
              </div>
            ) : filteredPremiumStudents.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <Search size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No students match current filters</p>
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-4 px-6 w-12 text-center">
                          <input
                            type="checkbox"
                            className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={filteredPremiumStudents.length > 0 && filteredPremiumStudents.every(s => selectedUserIds.has(s.id || s.mobile!))}
                            onChange={handleSelectAllFiltered}
                          />
                        </th>
                        <th className="py-4 px-4">Student Details</th>
                        <th className="py-4 px-4">Allotted Batch</th>
                        <th className="py-4 px-4 text-center">Premium Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPremiumStudents.map((student, idx) => {
                        const studentId = student.id || student.mobile!;
                        const isChecked = selectedUserIds.has(studentId);
                        const isUpdating = individualUpdatingId === studentId;
                        const batchName = batches.find(b => b.id === student.batchId)?.batchName || 'No Batch';

                        return (
                          <tr key={studentId} className={`hover:bg-slate-50/50 transition-colors ${isChecked ? 'bg-indigo-50/10' : ''}`}>
                            {/* Checkbox */}
                            <td className="py-3 px-6 text-center">
                              <input
                                type="checkbox"
                                className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={isChecked}
                                onChange={() => handleSelectRow(studentId)}
                              />
                            </td>

                            {/* Avatar & Info */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-150 flex-shrink-0">
                                  {student.photoUrl ? (
                                    <img src={student.photoUrl} alt={student.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-500 font-bold text-sm uppercase">
                                      {(student.name || 'S').charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 text-sm truncate">{student.name}</div>
                                  <div className="text-[10px] font-mono font-medium text-slate-400 mt-0.5">
                                    {student.studentCode || 'No Code'} • {student.mobile}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Batch */}
                            <td className="py-3 px-4">
                              <span className="inline-flex px-2.5 py-1 rounded-xl text-[10px] font-black bg-slate-100 text-slate-600 uppercase tracking-wide">
                                {batchName}
                              </span>
                            </td>

                            {/* Switch Access */}
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center">
                                {isUpdating ? (
                                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <button
                                    onClick={() => handleTogglePremium(student)}
                                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                                      student.isPremium
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60 shadow-xs shadow-emerald-50 hover:bg-emerald-100/70'
                                        : 'bg-slate-100 text-slate-500 border-slate-200/60 hover:bg-slate-200/60'
                                    }`}
                                  >
                                    {student.isPremium ? (
                                      <>
                                        <Zap size={11} className="fill-emerald-600 text-emerald-600 animate-pulse" />
                                        👑 Premium
                                      </>
                                    ) : (
                                      <>
                                        🆓 Free Access
                                      </>
                                    )}
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

          {/* Floating Bulk Action Bar */}
          {selectedUserIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 text-white py-4 px-6 rounded-3xl shadow-2xl flex items-center gap-6 z-50 border border-slate-800 max-w-lg w-[90%]">
              <div className="text-left">
                <div className="text-xs font-black uppercase tracking-widest text-indigo-400">{selectedUserIds.size} selected</div>
                <div className="text-[10px] text-slate-400 font-bold mt-0.5 font-sans">Apply bulk premium action</div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {bulkUpdating ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 px-4">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleBulkPremiumUpdate(true)}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-900/55"
                    >
                      <Zap size={12} className="fill-white" />
                      Set Premium
                    </button>
                    <button
                      onClick={() => handleBulkPremiumUpdate(false)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      Set Free
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 md:overflow-y-auto px-2 sm:px-6 py-6 pb-32">
          {error ? (
            <div className="text-center py-20 bg-rose-50 rounded-[2.5rem] border border-dashed border-rose-200 px-6">
              <AlertTriangle size={40} className="mx-auto text-rose-500 mb-4 animate-bounce" />
              <p className="text-rose-800 font-black uppercase text-xs tracking-widest">Failed to load candidates</p>
              <p className="text-rose-600 text-xs mt-2 max-w-md mx-auto">{error}</p>
              <button
                onClick={loadUsers}
                className="mt-4 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-rose-200"
              >
                Retry Loading
              </button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading candidates...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
               <Search size={40} className="mx-auto text-slate-200 mb-4" />
               <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No matching agents found</p>
            </div>
          ) : viewStyle === 'table' ? (
            /* Table Directory Layout */
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-5">Student / ID</th>
                      <th className="py-4 px-4">Mobile Number</th>
                      <th className="py-4 px-4">Current Batch</th>
                      <th className="py-4 px-4 text-center">Registration Date</th>
                      <th className="py-4 px-4 text-center">Last Login</th>
                      <th className="py-4 px-4 text-center">Last Submission</th>
                      <th className="py-4 px-4 text-center">Premium Status</th>
                      <th className="py-4 px-4 text-center">Remaining Days</th>
                      <th className="py-4 px-4 text-center">Account Status</th>
                      <th className="py-4 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(user => {
                      const daysLeft = getDaysLeftForStudent(user);
                      const isPremium = !!user.isPremium || user.premiumStatus === 'active' || user.premiumStatus === 'PREMIUM';
                      const lastLoginText = user.lastLoginDateTime 
                        ? new Date(user.lastLoginDateTime).toLocaleDateString()
                        : 'Never';
                      const lastSubmissionText = user.lastSubmissionDate || user.lastMissionSubmissionDate
                        ? new Date(user.lastSubmissionDate || user.lastMissionSubmissionDate).toLocaleDateString()
                        : 'Never';
                      const batchName = batches.find(b => b.id === user.batchId)?.batchName || user.currentBatch || 'Aspirants';
                      const statusVal = user.status || 'active';

                      return (
                        <tr key={user.id || user.mobile} className="hover:bg-slate-50/50 transition-colors text-xs font-bold text-slate-700">
                          {/* Student Details */}
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 font-black flex items-center justify-center text-xs flex-shrink-0">
                                {(user.name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-black text-slate-900 block truncate max-w-[140px]">{user.name}</span>
                                <span className="font-mono text-[9px] text-slate-400 block truncate max-w-[140px]">ID: {user.id}</span>
                              </div>
                            </div>
                          </td>

                          {/* Mobile */}
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {user.mobile || 'N/A'}
                          </td>

                          {/* Current Batch */}
                          <td className="py-3 px-4">
                            <span className="inline-block bg-slate-100 text-slate-600 text-[10px] px-2.5 py-1 rounded-xl font-black uppercase tracking-wide">
                              {batchName}
                            </span>
                          </td>

                          {/* Registration Date */}
                          <td className="py-3 px-4 text-center text-slate-500 font-mono text-[10.5px]">
                            {user.registrationDate || (user.createdAt ? user.createdAt.split('T')[0] : 'N/A')}
                          </td>

                          {/* Last Login */}
                          <td className="py-3 px-4 text-center font-mono text-[10.5px] text-slate-500">
                            {lastLoginText}
                          </td>

                          {/* Last Submission */}
                          <td className="py-3 px-4 text-center font-mono text-[10.5px] text-slate-500">
                            {lastSubmissionText}
                          </td>

                          {/* Premium Status */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isPremium ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-150 text-slate-600'}`}>
                              {isPremium ? '⭐ Premium' : 'Free'}
                            </span>
                          </td>

                          {/* Remaining Days */}
                          <td className="py-3 px-4 text-center font-black font-mono text-indigo-600 text-[11px]">
                            {isPremium ? `${daysLeft}d` : '-'}
                          </td>

                          {/* Account Status */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              statusVal === 'active' 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                : statusVal === 'inactive'
                                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                  : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {statusVal}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => { setActiveUser(user); setActiveModal('points'); }}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-all"
                                title="Points"
                              >
                                <Star size={13} className="fill-emerald-600/10" />
                              </button>
                              <button 
                                onClick={() => { setActiveUser(user); setActiveModal('warning'); }}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all"
                                title="Warning"
                              >
                                <AlertTriangle size={13} />
                              </button>
                              <button 
                                onClick={() => { setActiveUser(user); setActiveModal('manage_student'); }}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all"
                                title="Manage"
                              >
                                <UserCog size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards Grid Layout */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredUsers.map(user => {
                const daysLeft = getDaysLeftForStudent(user);
                const isPremium = !!user.isPremium || user.premiumStatus === 'active' || user.premiumStatus === 'PREMIUM';
                const lastLoginText = user.lastLoginDateTime 
                  ? new Date(user.lastLoginDateTime).toLocaleDateString()
                  : 'Never';
                const lastSubmissionText = user.lastSubmissionDate || user.lastMissionSubmissionDate
                  ? new Date(user.lastSubmissionDate || user.lastMissionSubmissionDate).toLocaleDateString()
                  : 'Never';
                const batchName = batches.find(b => b.id === user.batchId)?.batchName || user.currentBatch || 'Aspirants';
                const statusVal = user.status || 'active';

                return (
                  <motion.div 
                    key={user.id || user.mobile}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-slate-100/40 relative overflow-hidden group flex flex-col justify-between"
                  >
                    {/* User Profile Info Section */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden bg-slate-50 border-2 border-white shadow-md flex items-center justify-center">
                             {user.photoUrl ? (
                                 <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                             ) : (
                                 <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-500 font-black text-xl uppercase">
                                   {(user.name || 'U').charAt(0)}
                                 </div>
                             )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                             <div className={`w-2.5 h-2.5 rounded-full ${statusVal === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          </div>
                        </div>
                        
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-base font-black text-slate-900 tracking-tight truncate max-w-[150px]">{user.name}</h3>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                              statusVal === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}>
                              {statusVal}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 truncate">
                              <GraduationCap size={10} className="text-indigo-400 flex-shrink-0"/>
                              <span className="truncate">{user.role} • {user.studentCode || 'N/A'}</span>
                            </p>
                            <p className="text-[10px] font-black text-slate-400 tracking-widest flex items-center gap-1 truncate">
                              <Smartphone size={10} className="text-indigo-400 flex-shrink-0"/>
                              <span className="truncate">{user.mobile}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100 flex items-center gap-1">
                          <Trophy size={11} className="text-amber-500 fill-amber-500/20" />
                          <span className="text-[10px] font-black text-amber-600">{user.missionPoints || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Bento Area */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2 text-[9px] font-bold text-slate-500 mb-4">
                      <div>
                        <span className="text-[7.5px] uppercase font-black text-slate-400 block">Allotted Batch</span>
                        <span className="font-black text-slate-800">{batchName}</span>
                      </div>
                      <div>
                        <span className="text-[7.5px] uppercase font-black text-slate-400 block">Registration Date</span>
                        <span className="font-black text-slate-800">{user.registrationDate || 'N/A'}</span>
                      </div>
                      <div className="border-t border-slate-150 pt-1.5">
                        <span className="text-[7.5px] uppercase font-black text-slate-400 block">Last Active</span>
                        <span className="font-black text-slate-800">{lastLoginText}</span>
                      </div>
                      <div className="border-t border-slate-150 pt-1.5">
                        <span className="text-[7.5px] uppercase font-black text-slate-400 block">Last Submission</span>
                        <span className="font-black text-slate-800">{lastSubmissionText}</span>
                      </div>
                      <div className="col-span-2 border-t border-slate-150 pt-1.5 flex items-center justify-between">
                        <div>
                          <span className="text-[7.5px] uppercase font-black text-slate-400 block">Access Status</span>
                          <span className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${isPremium ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                            {isPremium ? '⭐ Premium' : 'Free'}
                          </span>
                        </div>
                        {isPremium && (
                          <div className="text-right">
                            <span className="text-[7.5px] uppercase font-black text-slate-400 block">Days Left</span>
                            <span className="font-mono font-black text-indigo-600 text-[10px]">{daysLeft} Days</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Grid */}
                    <div className="grid grid-cols-2 gap-2 relative z-10">
                       <button 
                         onClick={() => { setActiveUser(user); setActiveModal('points'); }}
                         className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 py-2.5 px-1 rounded-xl text-[10px] font-black transition-all border border-emerald-100"
                       >
                         <Star size={11} className="fill-emerald-600/20 flex-shrink-0" />
                         <span className="truncate">Modify Points</span>
                       </button>
                       <button 
                         onClick={() => { setActiveUser(user); setActiveModal('warning'); }}
                         className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2.5 px-1 rounded-xl text-[10px] font-black transition-all border border-rose-100"
                       >
                         <AlertTriangle size={11} className="flex-shrink-0" />
                         <span className="truncate">Issue Warning</span>
                       </button>
                       <button 
                         onClick={() => { setActiveUser(user); setActiveModal('history'); }}
                         className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2.5 px-1 rounded-xl text-[10px] font-black transition-all border border-slate-100"
                       >
                         <History size={11} className="flex-shrink-0" />
                         <span className="truncate">Warning History</span>
                       </button>
                       <button 
                         onClick={() => { setActiveUser(user); setActiveModal('authority'); }}
                         className="flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-2.5 px-1 rounded-xl text-[10px] font-black transition-all border border-indigo-100"
                       >
                         <Shield size={11} className="flex-shrink-0" />
                         <span className="truncate">Authority</span>
                       </button>
                       <button 
                         onClick={() => { setActiveUser(user); setActiveModal('manage_student'); }}
                         className="col-span-2 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-[10px] font-black transition-all"
                       >
                         <UserCog size={11} className="flex-shrink-0" />
                         <span className="truncate">Manage Agent</span>
                       </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals Overlay */}
      <AnimatePresence>
        {activeModal === 'rules' && (
          <RulesModal 
            mentor={userProfile} 
            onClose={() => setActiveModal(null)} 
            onBatchOrchestration={() => setActiveModal('batch_orchestration')}
            onLeaveManagement={() => setActiveModal('leave_management')}
            onDeclareHoliday={() => setActiveModal('holiday_declaration')}
            onApproveLeave={() => setActiveModal('leave_request_approval')}
            onResetStats={() => setActiveModal('reset_stats')}
          />
        )}
        {activeModal === 'create' && (
          <UserCreationModal mentor={userProfile} onClose={() => setActiveModal(null)} onCreated={loadUsers} />
        )}
        {activeModal === 'batch_orchestration' && (
          <BatchOrchestrationModal mentor={userProfile} onClose={() => setActiveModal(null)} />
        )}
        {activeModal === 'leave_management' && (
          <LeaveManagementModal users={filteredUsers} onClose={() => setActiveModal(null)} onUpdated={loadUsers} />
        )}
        {activeModal === 'holiday_declaration' && (
          <HolidayDeclarationModal onClose={() => setActiveModal(null)} />
        )}
        {activeModal === 'leave_request_approval' && (
          <LeaveRequestApprovalModal onClose={() => setActiveModal(null)} />
        )}
        {activeModal === 'reset_stats' && (
          <ResetStatsModal onClose={() => { setActiveModal(null); loadUsers(); }} />
        )}
        {activeModal === 'reset_db' && (
          <DatabaseResetTool onClose={() => setActiveModal(null)} />
        )}
        {activeUser && activeModal === 'manage_student' && (
          <StudentManagementModal user={activeUser} onClose={() => { setActiveUser(null); setActiveModal(null); }} onSaved={loadUsers} />
        )}
        {activeUser && activeModal === 'authority' && (
          <AuthorityControlModal 
            user={activeUser} 
            onClose={() => { setActiveUser(null); setActiveModal(null); }} 
            onSaved={loadUsers} 
          />
        )}
        {activeUser && activeModal === 'points' && (
          <PointsModal 
            user={activeUser} 
            onClose={() => { setActiveUser(null); setActiveModal(null); }} 
            onSaved={loadUsers} 
          />
        )}
        {activeUser && activeModal === 'warning' && (
          <WarningModal 
            user={activeUser} 
            mentor={userProfile}
            onClose={() => { setActiveUser(null); setActiveModal(null); }} 
            onSaved={loadUsers} 
          />
        )}
        {activeUser && activeModal === 'history' && (
          <WarningHistoryModal 
            user={activeUser} 
            onClose={() => { setActiveUser(null); setActiveModal(null); }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

