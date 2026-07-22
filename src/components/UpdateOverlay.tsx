import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Sparkles, Download, ShieldAlert } from 'lucide-react';

interface UpdateOverlayProps {
  currentVersion: string;
  serverVersion: string | null;
  isUpdating: boolean;
  onUpdate: () => void;
}

export const UpdateOverlay: React.FC<UpdateOverlayProps> = ({
  currentVersion,
  serverVersion,
  isUpdating,
  onUpdate
}) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80  p-6"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
        >
          <div className="p-8 space-y-6">
            {/* Header Visual */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl rotate-3">
                  <RefreshCw className={`w-10 h-10 ${isUpdating ? 'animate-spin' : ''}`} />
                </div>
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white shadow-lg"
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
              </div>
            </div>

            {/* Text Content */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Update Available</h2>
              <p className="text-slate-500 leading-relaxed text-sm">
                {isUpdating 
                  ? "Updating system components... Please wait while we upgrade your experience." 
                  : "A new version of MissionGrid is ready. Update now to access the latest features and security improvements."}
              </p>
            </div>

            {/* Version Information */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Current</span>
                <div className="font-mono text-sm text-slate-600 font-bold">v{currentVersion}</div>
              </div>
              <div className="text-center space-y-1 border-l border-slate-200">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest">Latest</span>
                <div className="font-mono text-sm text-indigo-600 font-bold">v{serverVersion || '?.?.?'}</div>
              </div>
            </div>

            {/* Features/Trust badges */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-3 h-3" />
                </div>
                Improved Security & Performance
              </div>
            </div>

            {/* Action */}
            <button
              onClick={onUpdate}
              disabled={isUpdating}
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group active:scale-95"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Updating System...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                  Update Now
                </>
              )}
            </button>
            
            {!isUpdating && (
              <p className="text-[10px] text-center text-slate-400 uppercase font-bold tracking-widest">
                The application will reload automatically
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
