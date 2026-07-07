import React, { useState, useEffect } from 'react';
import { User } from '../../models/user';
import { updateUserProfile, deleteUserProfile } from '../../services/users';
import { BatchService } from '../../services/batch';
import { 
  X, Loader2, Shield, AlertOctagon, Power, Ban, Star, Layers, 
  Trash2, ToggleLeft, ToggleRight, CalendarClock, ShieldAlert, CheckCircle2, KeyRound 
} from 'lucide-react';

interface AuthorityControlModalProps {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}

export default function AuthorityControlModal({ user, onClose, onSaved }: AuthorityControlModalProps) {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Manage internal state mirroring student setup
  const [status, setStatus] = useState<User['status']>(user.status || 'active');
  const [category, setCategory] = useState<User['category']>(user.category || 'Base');
  const [batchId, setBatchId] = useState(user.batchId || '');
  
  // Custom permissions & restrictions toggles
  const [restrictedFromSubmitting, setRestrictedFromSubmitting] = useState(!!user.restrictedFromSubmitting);
  
  // Custom grace / administrative exemptions
  const [exemptFromPenalty, setExemptFromPenalty] = useState(!!user.exemptFromPenalty);
  const [excusedFromAttendance, setExcusedFromAttendance] = useState(!!user.excusedFromAttendance);

  useEffect(() => {
    BatchService.getBatches().then(setBatches).catch(err => {
      console.error("Error loading batches for authority panel", err);
    });
  }, []);

  const handleApplyAuthority = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const updates: Partial<User> = {
        status,
        category,
        batchId: batchId || '',
        restrictedFromSubmitting,
        exemptFromPenalty,
        excusedFromAttendance,
      };

      await updateUserProfile(user.id || user.mobile!, updates);
      setSuccess('Student authority configuration refreshed successfully!');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failure updating student authority layout.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async () => {
    console.log("Remove user initiated for:", user.name, "ID:", user.id, "Mobile:", user.mobile);
    if (!user.id && !user.mobile) {
      alert("Error: User has no ID or mobile to delete.");
      return;
    }
    const confirm = window.confirm(`CRITICAL: You are about to permanently remove student "${user.name}". This operation is IRREVERSIBLE.`);
    if (!confirm) return;

    setLoading(true);
    setError('');
    try {
      console.log("Calling deleteUserProfile...");
      await deleteUserProfile(user.id || user.mobile!);
      console.log("deleteUserProfile completed successfully.");
      setSuccess('User profile removed permanently.');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Error in deleteUserProfile:", err);
      setError(err?.message || 'Failed to remove user.');
      setLoading(false);
    }
  };

  const handlePurgeUser = async () => {
    const doubleConfirm = window.confirm(`CRITICAL WARNING: You are about to permanently purge and delete student "${user.name}" from the database. All stats, points, and configurations will be destroyed. This operation is IRREVERSIBLE.\n\nType OK to proceed.`);
    if (!doubleConfirm) return;

    setLoading(true);
    setError('');
    try {
      await deleteUserProfile(user.id || user.mobile!);
      setSuccess('Ecosystem user profile deleted permanently.');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Purging user failed.');
      setLoading(false);
    }
  };

  const handleDecoupleFromBatch = () => {
    setBatchId('');
    setSuccess('Decoupled from batch! Note: Save Changes to apply.');
  };

  const handleChangePassword = async () => {
    const confirm = window.confirm(`Are you sure you want to reset the password (PIN) to 123456 for ${user.name}?`);
    if (!confirm) return;
    
    setLoading(true);
    setError('');
    try {
      await updateUserProfile(user.id || user.mobile!, { pin: '123456' });
      setSuccess(`Password (PIN) reset to 123456 for ${user.name}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password (PIN).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center z-[80] overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100vh-2rem)] flex flex-col my-auto">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2.5 rounded-2xl border border-indigo-400/30">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight font-sans">Ecosystem Authority Controls</h2>
              <p className="text-slate-400 text-xs mt-0.5">Moderation & Constraints Panel for <span className="text-indigo-300 font-bold">{user.name}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-300 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-2.5 text-rose-600 text-xs font-semibold leading-relaxed">
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Section 1: Dynamic Percentage Category Selection */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">Percentage Category Selection</label>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {[
                { 
                  id: 'Elite' as const, 
                  label: 'Elite Category', 
                  desc: '95%+ consistency standard', 
                  color: 'hover:border-indigo-500/40 text-indigo-700 bg-indigo-50/50',
                  activeStyle: 'ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50' 
                },
                { 
                  id: 'Base' as const, 
                  label: 'Base Category', 
                  desc: '70%+ standard workload', 
                  color: 'hover:border-slate-300 text-slate-700 bg-white',
                  activeStyle: 'ring-2 ring-slate-800 border-slate-800 bg-slate-100/50' 
                },
                { 
                  id: 'Review Category' as const, 
                  label: 'Review Category', 
                  desc: 'Needs feedback and surveillance', 
                  color: 'hover:border-rose-400 text-rose-700 bg-rose-50/30',
                  activeStyle: 'ring-2 ring-rose-500 border-rose-500 bg-rose-50' 
                }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                    category === cat.id ? cat.activeStyle : `${cat.color} border-slate-200`
                  }`}
                >
                  <p className="font-bold text-xs">{cat.label}</p>
                  <span className="text-[9px] text-slate-400 mt-1 leading-snug">{cat.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Cohort & Batch Assignment */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-500" />
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-widest flex-1">Cohort Group Placement</label>
              {batchId && (
                <button 
                  type="button"
                  onClick={handleDecoupleFromBatch}
                  className="text-[10px] font-black text-rose-600 uppercase border border-rose-200 px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 transition-all cursor-pointer"
                >
                  Decouple / Remove from Group
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <select 
                value={batchId} 
                onChange={e => setBatchId(e.target.value)}
                className="flex-1 rounded-xl border-slate-200 text-xs bg-white h-11 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
              >
                <option value="">-- No Active Group Placement (Unenrolled) --</option>
                {batches.map((b, idx) => (
                  <option key={`${b.id || 'b'}-${idx}`} value={b.id}>{b.batchName} [{b.batchCode || ''}]</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Operational Constraints & Privileges Restrictions (Bento Toggles) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">Active Constraints & Blocks</label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Submission Toggle */}
              <button
                type="button"
                onClick={() => setRestrictedFromSubmitting(!restrictedFromSubmitting)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer ${
                  restrictedFromSubmitting 
                    ? 'border-rose-200 bg-rose-50/50 shadow-xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`p-1.5 rounded-lg ${restrictedFromSubmitting ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                    <AlertOctagon size={14} />
                  </span>
                  {restrictedFromSubmitting ? <ToggleRight className="text-rose-600" size={32} /> : <ToggleLeft className="text-slate-400" size={32} />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 mt-2">Submission Ban</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">Restrict student from checking-in daily tasks</p>
                </div>
              </button>

            </div>
          </div>

          {/* Section 4: Evaluation Considerations & Grace Exemptions */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-emerald-500" />
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">Grace Considerations & Exemptions</label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Penalty Exemption Checkbox */}
              <div 
                onClick={() => setExemptFromPenalty(!exemptFromPenalty)}
                className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:bg-slate-100/30 cursor-pointer transition-all"
              >
                <input 
                  type="checkbox" 
                  checked={exemptFromPenalty}
                  onChange={() => {}} // handled by click
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 select-none"
                />
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800">Auto-Penalty Exemption</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">Waiver for missed targets / zero evaluation points, protects consistency history</p>
                </div>
              </div>

              {/* Attendance Exemption Checkbox */}
              <div 
                onClick={() => setExcusedFromAttendance(!excusedFromAttendance)}
                className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:bg-slate-100/30 cursor-pointer transition-all"
              >
                <input 
                  type="checkbox" 
                  checked={excusedFromAttendance}
                  onChange={() => {}} // handled by click
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 select-none"
                />
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800">Long-term Health/Emergency Waiver</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">Exempt student from standard consistency score checks while on active sick leave</p>
                </div>
              </div>

            </div>
          </div>

          {/* Section 5: Global Account Authorization Level */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-widest block">Authorization Status Level</label>
            <div className="flex flex-wrap gap-2">
              {[
                { level: 'active' as const, label: 'Active', style: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
                { level: 'pending' as const, label: 'Pending Approval', style: 'border-amber-400 text-amber-700 bg-amber-50' },
                { level: 'inactive' as const, label: 'Inactive / Resting', style: 'border-slate-300 text-slate-600 bg-slate-100' },
                { level: 'suspended' as const, label: 'Suspended', style: 'border-rose-400 text-rose-700 bg-rose-50' },
                { level: 'blocked' as const, label: 'Blocked User', style: 'border-red-600 text-red-700 bg-red-100/40' }
              ].map(st => (
                <button
                  key={st.level}
                  type="button"
                  onClick={() => setStatus(st.level)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    status === st.level ? `${st.style} ring-1 ring-offset-2 ring-slate-800` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Status locks are evaluated dynamically inside Router Guards. Restricting status blocks the respective candidates from viewing or accessing core elements.
            </p>
          </div>

        </div>

        {/* Modal Footer / Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between relative z-[60] shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRemoveUser}
              className="flex items-center gap-1.5 px-4 h-11 border border-rose-600 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 size={14} />
              Remove User
            </button>
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 h-11 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <KeyRound size={14} />
              Change Password
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 h-11 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-white hover:text-slate-900 transition-all cursor-pointer bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyAuthority}
              disabled={loading}
              className="px-6 h-11 bg-slate-900 text-white rounded-xl text-xs font-extrabold hover:bg-slate-800 transition-all flex items-center gap-1.5 max-w-xs shadow-lg shadow-slate-100 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Shield size={14} />}
              Apply Authority
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
