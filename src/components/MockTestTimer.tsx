import React, { useMemo } from 'react';
import { Clock, AlertTriangle, Timer, Info, Sparkles } from 'lucide-react';

interface MockTestTimerProps {
  timingMode: 'overall' | 'section' | 'hybrid';
  timeRemaining: number; // overall remaining in seconds
  totalDuration: number; // overall duration in minutes
  activeSection?: {
    id: string;
    name: string;
    timeLimit?: number; // in minutes
  } | null;
  sectionElapsed?: Record<string, number>;
}

export const MockTestTimer: React.FC<MockTestTimerProps> = ({
  timingMode,
  timeRemaining,
  totalDuration,
  activeSection,
  sectionElapsed = {},
}) => {
  // Helper to format seconds to MM:SS or HH:MM:SS
  const formatTime = (seconds: number) => {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const h = Math.floor(absSeconds / 3600);
    const m = Math.floor((absSeconds % 3600) / 60);
    const s = absSeconds % 60;
    const prefix = isNegative ? '+' : '';
    
    if (h > 0) {
      return `${prefix}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${prefix}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate section specific values
  const sectionTimeData = useMemo(() => {
    if (!activeSection || !activeSection.timeLimit) {
      return { remaining: null, isOvertime: false, percentage: 0 };
    }
    const elapsed = sectionElapsed[activeSection.id] || 0;
    const limitSeconds = activeSection.timeLimit * 60;
    const remaining = limitSeconds - elapsed;
    const isOvertime = remaining < 0;
    
    const percentage = isOvertime 
      ? 100 
      : Math.min(100, Math.max(0, (remaining / limitSeconds) * 100));

    return { remaining, isOvertime, percentage };
  }, [activeSection, sectionElapsed]);

  // Overall timer details
  const overallPercentage = useMemo(() => {
    const totalSecs = totalDuration * 60;
    if (totalSecs <= 0) return 0;
    return Math.min(100, Math.max(0, (timeRemaining / totalSecs) * 100));
  }, [timeRemaining, totalDuration]);

  // Styles for low overall time
  const overallIsLow = timeRemaining < 300; // less than 5 minutes
  const overallIsCritical = timeRemaining < 60; // less than 1 minute

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm relative overflow-hidden" id="mock-test-timer-root">
      {/* Background ambient decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 opacity-50 blur-xl pointer-events-none" />

      {/* OVERALL TIMER (Always visible, primary in mode 1, auxiliary/primary in 2 & 3) */}
      <div className="flex-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
            overallIsCritical 
              ? 'bg-rose-100 text-rose-600 animate-pulse border border-rose-200' 
              : overallIsLow 
              ? 'bg-amber-100 text-amber-600 border border-amber-200' 
              : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono block leading-none">
              Test Time Remaining
            </span>
            <span className={`text-base font-black font-mono tracking-tight tabular-nums transition-colors ${
              overallIsCritical ? 'text-rose-600' : overallIsLow ? 'text-amber-600' : 'text-slate-800'
            }`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        {/* Circular or horizontal mini progress bar */}
        <div className="hidden sm:block w-24 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${
              overallIsCritical ? 'bg-rose-500' : overallIsLow ? 'bg-amber-500' : 'bg-indigo-500'
            }`} 
            style={{ width: `${overallPercentage}%` }}
          />
        </div>
      </div>

      {/* DIVIDER */}
      {timingMode !== 'overall' && activeSection && activeSection.timeLimit && (
        <div className="hidden md:block w-px h-10 bg-slate-200 self-center mx-1" />
      )}

      {/* SECTION TIMER (Only shown for Mode 2 - Section-wise, and Mode 3 - Hybrid) */}
      {timingMode !== 'overall' && activeSection && activeSection.timeLimit && (
        <div className="flex-1 flex items-center justify-between gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              sectionTimeData.isOvertime 
                ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                : sectionTimeData.remaining && sectionTimeData.remaining < 120 
                ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse' 
                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}>
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono block leading-none">
                {timingMode === 'hybrid' ? 'Section Recommended Time' : 'Section Timer'}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 max-w-[90px] truncate" title={activeSection.name}>
                  {activeSection.name}
                </span>
                <span className={`text-sm font-black font-mono tracking-tight tabular-nums ${
                  sectionTimeData.isOvertime 
                    ? 'text-rose-600' 
                    : sectionTimeData.remaining && sectionTimeData.remaining < 120 
                    ? 'text-amber-600 font-extrabold' 
                    : 'text-emerald-600'
                }`}>
                  {formatTime(sectionTimeData.remaining ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Section progress / status visual */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {timingMode === 'hybrid' && sectionTimeData.isOvertime ? (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md leading-none">
                <AlertTriangle className="w-3 h-3" />
                Overtime
              </span>
            ) : timingMode === 'hybrid' ? (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md leading-none">
                <Sparkles className="w-3 h-3" />
                On Track
              </span>
            ) : (
              <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    sectionTimeData.remaining && sectionTimeData.remaining < 120 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} 
                  style={{ width: `${sectionTimeData.percentage}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
