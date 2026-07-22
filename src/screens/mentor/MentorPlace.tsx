import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, Search, UserPlus, UserCheck, LogOut, Layers, 
  Star, Shield, AlertTriangle, History, 
  Award, Trophy, MoreVertical, CheckCircle2,
  Filter, X, PlusCircle, Power, Ban, ToggleLeft, ToggleRight,
  TrendingUp, Activity, Smartphone, Hash, Navigation,
  Calendar, Megaphone, GraduationCap, Settings, UserCog,
  Trash2, Edit2, MessageSquare, Mic, Square, BarChart3, Plus, Volume2, RefreshCw, Zap, UploadCloud, ShieldAlert, Crown
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { APP_VERSION } from '../../version';
import { getUsers, createUserProfile, updateUserProfile, getPublicUsers, resolveUserDoc } from '../../services/users';
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
import { collection, query, orderBy, limit, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
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
import StudentCheckWorkspace from './StudentCheckWorkspace';

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

const UserCreationModal = ({ onClose, onCreated, mentor, initialMobile = '', initialBatchId = '' }: { onClose: () => void, onCreated: () => void, mentor: any, initialMobile?: string, initialBatchId?: string }) => {
    const [name, setName] = useState('');
    const [mobile, setMobile] = useState(initialMobile);
    const [role, setRole] = useState<'student' | 'mentor' | 'examiner'>('student');
    const [batchId, setBatchId] = useState(initialBatchId);
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
        <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[70] p-4 font-sans">
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
    <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[70] p-4 font-sans">
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
    <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[60] p-4 overflow-y-auto">
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
    <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[60] p-4 overflow-y-auto">
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
    <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[60] p-4 font-sans">
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
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal states
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [activeModal, setActiveModal] = useState<'authority' | 'warning' | 'history' | 'rules' | 'create' | 'batch_orchestration' | 'leave_management' | 'manage_student' | 'holiday_declaration' | 'leave_request_approval' | 'reset_stats' | 'reset_db' | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view') === 'review' ? 'review' : 'list';
  const [view, setView] = useState<'list' | 'review' | 'check'>(initialView as any);

  // Quick Premium Manager states
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isBulkPremiumMode, setIsBulkPremiumMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedBatchIdFilter, setSelectedBatchIdFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewStyle, setViewStyle] = useState<'table' | 'cards'>('table');
  const [individualUpdatingId, setIndividualUpdatingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // New Bulk actions target inputs
  const [bulkBatchId, setBulkBatchId] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<'active' | 'inactive' | 'suspended'>('active');

  // Quick Enroll states
  const [quickEnrollMobile, setQuickEnrollMobile] = useState('');
  const [quickEnrollBatchId, setQuickEnrollBatchId] = useState('');
  const [quickEnrollLoading, setQuickEnrollLoading] = useState(false);
  const [quickEnrollResult, setQuickEnrollResult] = useState<{ type: 'found' | 'not_found'; user?: User; mobile: string } | null>(null);
  const [prefillMobile, setPrefillMobile] = useState('');
  const [prefillBatchId, setPrefillBatchId] = useState('');

  const handleQuickSearch = async () => {
    const sanitized = quickEnrollMobile.replace(/\D/g, '');
    if (sanitized.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!quickEnrollBatchId) {
      toast.error("Please select a target batch first");
      return;
    }
    setQuickEnrollLoading(true);
    setQuickEnrollResult(null);
    try {
      const { publicRef } = await resolveUserDoc(sanitized);
      const pubSnap = await getDoc(publicRef);
      if (pubSnap.exists()) {
        const uData = { id: pubSnap.id, ...(pubSnap.data() as any || {}) } as User;
        setQuickEnrollResult({ type: 'found', user: uData, mobile: sanitized });
      } else {
        setQuickEnrollResult({ type: 'not_found', mobile: sanitized });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to search student profile: " + (err.message || String(err)));
    } finally {
      setQuickEnrollLoading(false);
    }
  };

  const executeQuickEnroll = async () => {
    if (!quickEnrollResult || quickEnrollResult.type !== 'found' || !quickEnrollResult.user) return;
    if (!quickEnrollBatchId) {
      toast.error("Please select a target batch");
      return;
    }
    setQuickEnrollLoading(true);
    try {
      const targetUser = quickEnrollResult.user;
      const targetBatch = batches.find(b => b.id === quickEnrollBatchId);
      await updateUserProfile(targetUser.id, {
        batchId: quickEnrollBatchId,
        currentBatch: targetBatch?.batchName || ''
      });
      await logAuditAction(userProfile.uid, userProfile.name, 'Enrolled User in Batch', targetUser.id, `Batch: ${targetBatch?.batchName || quickEnrollBatchId}`);
      toast.success(`Successfully enrolled ${targetUser.name} in ${targetBatch?.batchName || 'batch'}!`);
      setQuickEnrollResult(null);
      setQuickEnrollMobile('');
      loadUsers();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to enroll student: " + (err.message || String(err)));
    } finally {
      setQuickEnrollLoading(false);
    }
  };

  const openCreationWithMobile = () => {
    setPrefillMobile(quickEnrollMobile);
    setPrefillBatchId(quickEnrollBatchId);
    setActiveModal('create');
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBatchIdFilter, selectedStatusFilter]);

  useEffect(() => {
    if (view === 'list') {
      searchParams.delete('view');
      setSearchParams(searchParams);
    }
  }, [view]);

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

  const itemsPerPage = 50;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const adjustedCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (adjustedCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

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

  const handleBulkBatchAssignment = async (targetBatchId: string) => {
    if (selectedUserIds.size === 0) return;
    if (!targetBatchId) {
      toast.error('Please select a target batch first');
      return;
    }
    const targetBatch = batches.find(b => b.id === targetBatchId);
    if (!targetBatch) {
      toast.error('Selected batch was not found');
      return;
    }

    setBulkUpdating(true);
    const idsArray = Array.from(selectedUserIds);
    const toastId = toast.loading(`Assigning ${idsArray.length} students to ${targetBatch.batchName}...`);

    const originalUsers = [...users];

    // Optimistic Update
    setUsers(prev => prev.map(u => {
      const id = u.id || u.mobile;
      if (id && selectedUserIds.has(id)) {
        return {
          ...u,
          batchId: targetBatchId,
          currentBatch: targetBatch.batchName
        };
      }
      return u;
    }));

    try {
      const promises = idsArray.map(async (id) => {
        await updateUserProfile(id, {
          batchId: targetBatchId,
          currentBatch: targetBatch.batchName
        });
      });
      await Promise.all(promises);
      const latestUsers = await getUsers();
      setUsers(latestUsers);
      setSelectedUserIds(new Set());
      toast.success(`Successfully assigned ${idsArray.length} students to ${targetBatch.batchName}!`, { id: toastId });
    } catch (err) {
      console.error(err);
      setUsers(originalUsers);
      toast.error('Failed to update student batches. Please try again.', { id: toastId });
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkStatusChange = async (targetStatus: 'active' | 'inactive' | 'suspended') => {
    if (selectedUserIds.size === 0) return;
    setBulkUpdating(true);
    const idsArray = Array.from(selectedUserIds);
    const toastId = toast.loading(`Updating status of ${idsArray.length} students to ${targetStatus}...`);

    const originalUsers = [...users];

    // Optimistic Update
    setUsers(prev => prev.map(u => {
      const id = u.id || u.mobile;
      if (id && selectedUserIds.has(id)) {
        return {
          ...u,
          status: targetStatus
        };
      }
      return u;
    }));

    try {
      const promises = idsArray.map(async (id) => {
        await updateUserProfile(id, {
          status: targetStatus
        });
      });
      await Promise.all(promises);
      const latestUsers = await getUsers();
      setUsers(latestUsers);
      setSelectedUserIds(new Set());
      toast.success(`Successfully updated status for ${idsArray.length} students to ${targetStatus}!`, { id: toastId });
    } catch (err) {
      console.error(err);
      setUsers(originalUsers);
      toast.error('Failed to bulk update status. Please try again.', { id: toastId });
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

  if (view === 'check') {
    return <StudentCheckWorkspace onBack={() => { setView('list'); loadUsers(); }} />;
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
              onClick={() => setView('check')}
              className="flex-1 sm:flex-initial px-3 sm:px-4 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-indigo-100 hover:scale-105 transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
            >
              <UserCheck size={16} />
              Check
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

        {/* Quick Enroll search bar by mobile number */}
        <div className="mt-4 p-4 sm:p-5 bg-gradient-to-r from-indigo-50/30 via-slate-50 to-white border border-slate-150 rounded-3xl shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                <UserPlus size={16} />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Quick Enroll by Mobile</h4>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5 font-sans">Search and immediately allocate any candidate to a designated batch.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 flex-1 max-w-xl justify-end">
              {/* Batch Select */}
              <select
                value={quickEnrollBatchId}
                onChange={e => setQuickEnrollBatchId(e.target.value)}
                className="bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
              >
                <option value="">-- Target Batch --</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.batchName}</option>
                ))}
              </select>

              {/* Mobile Input */}
              <div className="relative flex-1 sm:max-w-[200px]">
                <input 
                  type="text" 
                  placeholder="10-digit mobile..."
                  maxLength={10}
                  className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-4 pr-10 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all shadow-sm"
                  value={quickEnrollMobile}
                  onChange={e => setQuickEnrollMobile(e.target.value.replace(/\D/g, ''))}
                />
                {quickEnrollLoading && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={quickEnrollLoading || !quickEnrollMobile || !quickEnrollBatchId}
                onClick={handleQuickSearch}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-md shadow-indigo-100/50 flex items-center justify-center gap-1.5"
              >
                <Search size={12} />
                Find & Enroll
              </button>
            </div>
          </div>

          {/* Quick Enroll Result Drawer/Area */}
          {quickEnrollResult && (
            <div className={`mt-4 p-4 rounded-2xl border transition-all ${
              quickEnrollResult.type === 'found' 
                ? 'bg-emerald-50/50 border-emerald-100 text-emerald-950' 
                : 'bg-amber-50/50 border-amber-100 text-amber-950'
            }`}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {quickEnrollResult.type === 'found' ? (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <UserCheck size={16} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <AlertTriangle size={16} />
                    </div>
                  )}
                  <div>
                    {quickEnrollResult.type === 'found' ? (
                      <>
                        <p className="text-xs font-black">Profile Found: <span className="text-indigo-600">{quickEnrollResult.user?.name}</span> ({quickEnrollResult.user?.mobile})</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5 font-sans">
                          Current Batch: <span className="font-black text-slate-700">{batches.find(b => b.id === quickEnrollResult.user?.batchId)?.batchName || 'Unallocated / Aspirant'}</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-black">No Registered Student Profile Found</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5 font-sans">Mobile {quickEnrollResult.mobile} is not registered in the system yet.</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button 
                    type="button"
                    onClick={() => setQuickEnrollResult(null)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                  {quickEnrollResult.type === 'found' ? (
                    <button 
                      type="button"
                      onClick={executeQuickEnroll}
                      disabled={quickEnrollLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-100/50 flex items-center gap-1.5"
                    >
                      {quickEnrollLoading ? 'Processing...' : `Enroll in ${batches.find(b => b.id === quickEnrollBatchId)?.batchName}`}
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={openCreationWithMobile}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-amber-100/50 flex items-center gap-1"
                    >
                      <UserPlus size={11} />
                      Create & Enroll
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
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
          ⚡ Bulk Actions Panel
        </button>
      </div>

      {isBulkPremiumMode ? (
        <div className="flex-1 flex flex-col bg-slate-50">
          {/* Controls Bar */}
          <div className="px-6 py-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex flex-col">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Bulk Student Operations</h4>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 font-sans">Select multiple candidates below to apply batch updates instantly.</p>
            </div>

            {/* Quick summary numbers */}
            <div className="flex items-center gap-4 text-xs bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 font-bold text-slate-600">
              <div>
                Total Students: <span className="text-slate-900 font-black">{filteredPremiumStudents.length}</span>
              </div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
              <div>
                Active: <span className="text-emerald-600 font-black">{filteredPremiumStudents.filter(s => !s.status || s.status === 'active').length}</span>
              </div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
              <div>
                Inactive: <span className="text-rose-500 font-black">{filteredPremiumStudents.filter(s => s.status === 'inactive').length}</span>
              </div>
            </div>
          </div>

          {/* New Bulk Action Console Card */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex flex-col gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-150/60 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="text-indigo-600" size={16} />
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Bulk Action Console ({selectedUserIds.size} Selected)</h5>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Batch assign card */}
                <div className="p-4 bg-indigo-50/20 border border-indigo-100 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h6 className="text-[10px] font-black text-indigo-950 uppercase tracking-wider mb-1">Move to Batch</h6>
                    <p className="text-[9px] font-medium text-slate-400 mb-3">Allot the selected personnel to another designated training batch.</p>
                    <select
                      value={bulkBatchId}
                      onChange={e => setBulkBatchId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                    >
                      <option value="">-- Choose Batch --</option>
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.batchName}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    disabled={selectedUserIds.size === 0 || bulkUpdating || !bulkBatchId}
                    onClick={() => handleBulkBatchAssignment(bulkBatchId)}
                    className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-100/50"
                  >
                    Apply Batch Move
                  </button>
                </div>

                {/* Status update card */}
                <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h6 className="text-[10px] font-black text-emerald-950 uppercase tracking-wider mb-1">Alter Status</h6>
                    <p className="text-[9px] font-medium text-slate-400 mb-3">Toggle operational status between Active, Suspended, or Inactive.</p>
                    <select
                      value={bulkStatus}
                      onChange={e => setBulkStatus(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <button
                    disabled={selectedUserIds.size === 0 || bulkUpdating}
                    onClick={() => handleBulkStatusChange(bulkStatus)}
                    className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-100/50"
                  >
                    Apply Status Change
                  </button>
                </div>
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
                        <th className="py-4 px-4 text-center">Account Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPremiumStudents.map((student, idx) => {
                        const studentId = student.id || student.mobile!;
                        const isChecked = selectedUserIds.has(studentId);
                        const isUpdating = individualUpdatingId === studentId;
                        const batchName = batches.find(b => b.id === student.batchId)?.batchName || 'No Batch';
                        const statusVal = student.status || 'active';

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

                            {/* Account Status */}
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                statusVal === 'active' 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-rose-50 text-rose-600 border border-rose-100'
                              }`}>
                                {statusVal}
                              </span>
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

          {/* Quick instructions hint */}
          {selectedUserIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 text-white py-4 px-6 rounded-3xl shadow-2xl flex items-center gap-4 z-50 border border-slate-800">
              <div className="text-xs font-black uppercase tracking-widest text-indigo-400">{selectedUserIds.size} Selected</div>
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
              <div className="text-[10px] text-slate-300 font-bold font-sans">Use the Console Card at the top of the table to execute updates.</div>
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
                      <th className="py-4 px-4 text-center">Account Status</th>
                      <th className="py-4 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedUsers.map(user => {
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
              {paginatedUsers.map(user => {
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
                    </div>

                    {/* Action Grid */}
                    <div className="grid grid-cols-2 gap-2 relative z-10">
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
                         className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-[10px] font-black transition-all"
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-white border border-slate-150 p-4 rounded-3xl shadow-lg shadow-slate-100/50">
              <span className="text-xs font-bold text-slate-500 text-center sm:text-left">
                Showing <span className="font-black text-slate-800">{startIndex + 1}-{Math.min(endIndex, filteredUsers.length)}</span> of <span className="font-black text-slate-800">{filteredUsers.length}</span> students (Page <span className="font-black text-slate-800">{adjustedCurrentPage}</span> of <span className="font-black text-indigo-600">{totalPages}</span>)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={adjustedCurrentPage === 1}
                  className={`px-4 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all border ${
                    adjustedCurrentPage === 1
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 active:scale-95 shadow-sm'
                  }`}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={adjustedCurrentPage === totalPages}
                  className={`px-4 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all border ${
                    adjustedCurrentPage === totalPages
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-slate-800 border-transparent active:scale-95 shadow-sm'
                  }`}
                >
                  Next
                </button>
              </div>
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
          <UserCreationModal 
            mentor={userProfile} 
            onClose={() => { setActiveModal(null); setPrefillMobile(''); setPrefillBatchId(''); }} 
            onCreated={() => { setActiveModal(null); setPrefillMobile(''); setPrefillBatchId(''); loadUsers(); }} 
            initialMobile={prefillMobile}
            initialBatchId={prefillBatchId}
          />
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

