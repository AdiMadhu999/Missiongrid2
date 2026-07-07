import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, AlertTriangle, RefreshCw, Trash2, Check } from 'lucide-react';
import { resetAllStudentStats, startNew10DaysCycle } from '../../services/mentor-actions';

const ResetStatsModal = ({ onClose }: { onClose: () => void }) => {
  const [loadingCycle, setLoadingCycle] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [confirmState, setConfirmState] = useState<'none' | 'cycle' | 'global'>('none');

  const handleStartCycle = async () => {
    setLoadingCycle(true);
    try {
        await startNew10DaysCycle();
        alert('10 days cycle started successfully');
        onClose();
    } catch (e) {
        console.error(e);
        alert('Failed to start 10 days cycle');
    } finally {
        setLoadingCycle(false);
        setConfirmState('none');
    }
  };

  const handleResetGlobal = async () => {
    setLoadingGlobal(true);
    try {
        await resetAllStudentStats();
        alert('Global leaderboard and stats reset successfully');
        onClose();
    } catch (e) {
        console.error(e);
        alert('Failed to reset global stats');
    } finally {
        setLoadingGlobal(false);
        setConfirmState('none');
    }
  };

  if (confirmState === 'cycle') {
      return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[80] p-4 font-sans">
            <motion.div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-amber-100">
                <h3 className="text-xl font-black text-amber-600 mb-4 flex items-center gap-2"><RefreshCw /> Confirm New Cycle</h3>
                <p className="text-sm text-slate-600 mb-6 font-medium">Are you sure you want to start a new 10 days cycle? Cycle points will be reset to 0.</p>
                <div className="flex gap-4">
                    <button onClick={() => setConfirmState('none')} disabled={loadingCycle} className="flex-1 p-4 text-slate-500 font-bold border rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">Cancel</button>
                    <button onClick={handleStartCycle} disabled={loadingCycle} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl p-4 font-black transition-colors">{loadingCycle ? 'Starting...' : 'Confirm'}</button>
                </div>
            </motion.div>
        </div>
      );
  }

  if (confirmState === 'global') {
      return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[80] p-4 font-sans">
            <motion.div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-rose-100">
                <h3 className="text-xl font-black text-rose-600 mb-4 flex items-center gap-2"><AlertTriangle /> WARNING</h3>
                <p className="text-sm text-slate-600 mb-6 font-medium">This will wipe all global mission points, history, and baseline statistics globally. This action is absolutely irreversible. Are you sure?</p>
                <div className="flex gap-4">
                    <button onClick={() => setConfirmState('none')} disabled={loadingGlobal} className="flex-1 p-4 text-slate-500 font-bold border rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">Cancel</button>
                    <button onClick={handleResetGlobal} disabled={loadingGlobal} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl p-4 font-black transition-colors">{loadingGlobal ? 'Resetting...' : 'Yes, Wipe It'}</button>
                </div>
            </motion.div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 font-sans">
        <motion.div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">Reset Operations</h3>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50">
                <h4 className="font-black text-amber-800 flex items-center gap-2 mb-2"><RefreshCw size={16}/> Start New 10 Days Cycle</h4>
                <p className="text-xs text-amber-700 font-medium mb-4">Starts a new 10-day tracking period. Cycle points are reset to 0, but global mission points and historical data are kept intact.</p>
                <button onClick={() => setConfirmState('cycle')} className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl p-3 text-sm font-black transition-colors">Start New Cycle</button>
              </div>

              <div className="p-4 rounded-2xl border border-rose-100 bg-rose-50">
                <h4 className="font-black text-rose-600 flex items-center gap-2 mb-2"><AlertTriangle size={16}/> Reset Global Leaderboard</h4>
                <p className="text-xs text-rose-600 font-medium mb-4">Wipes all student mission points, daily history, and baseline stats globally. Irreversible.</p>
                <button onClick={() => setConfirmState('global')} className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl p-3 text-sm font-black transition-colors flex items-center justify-center gap-2"><Trash2 size={16} /> Reset Everything</button>
              </div>
            </div>

            <button onClick={onClose} className="w-full p-4 text-slate-500 font-bold border rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">Cancel</button>
        </motion.div>
    </div>
  );
};

export default ResetStatsModal;
