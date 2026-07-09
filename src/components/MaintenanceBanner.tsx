import React from 'react';
import { useAppConfig } from '../providers/AppProvider';
import { ShieldAlert, AlertTriangle, Hammer, X, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const MaintenanceBanner: React.FC = () => {
  const { isMaintenanceMode, setIsMaintenanceMode } = useAppConfig();
  const [isMinimized, setIsMinimized] = React.useState(false);

  if (!isMaintenanceMode) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-[9999] shadow-lg border-b border-amber-500/30 bg-gradient-to-r from-amber-950 via-slate-950 to-amber-950"
      >
        {isMinimized ? (
          <div className="flex items-center justify-between px-4 py-1 text-[10px] text-amber-300 font-mono tracking-wider">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <Hammer className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
              <span>MAINTENANCE ACTIVE: Optimization for MissionGrid V2 in progress</span>
            </div>
            <button
              onClick={() => setIsMinimized(false)}
              className="px-2 py-0.5 text-[9px] uppercase font-black bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded transition-colors text-amber-200"
            >
              Expand
            </button>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="w-0 flex-1 flex items-center gap-3">
                <span className="flex p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <Hammer className="h-4 w-4 text-amber-400 animate-pulse" />
                </span>
                <div className="font-sans">
                  <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5 tracking-wide">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>SYSTEM MAINTENANCE UNDERWAY</span>
                  </p>
                  <p className="text-[10px] text-slate-300 mt-0.5 leading-normal max-w-3xl">
                    Our team is currently running production database cleanup and integrity operations to prepare for the <strong className="text-amber-200">MissionGrid V2 Transition</strong>. App features remain accessible, but some latency or temporary updates may occur. Thank you for your patience!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-amber-500/15 rounded text-[9px] font-mono text-amber-400/80">
                  <Terminal className="w-3 h-3 text-amber-400/70" />
                  <span>v2_readiness_cleanup: active</span>
                </div>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 rounded-md text-amber-400 hover:bg-amber-500/10 hover:text-amber-200 focus:outline-none transition-colors"
                  title="Minimize"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
