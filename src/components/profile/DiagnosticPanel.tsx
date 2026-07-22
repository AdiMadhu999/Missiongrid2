import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getSystemSettings } from '../../services/system';
import { useAuth } from '../../providers/AuthProvider';
import { Loader2 } from 'lucide-react';

export const DiagnosticPanel: React.FC = () => {
  const { userProfile } = useAuth();
  const [logData, setLogData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!userProfile) return;
      setLoading(true);
      try {
        const sysSettings = await getSystemSettings();
        const start = sysSettings?.currentCycleStartDate || '2023-01-01';

        const uIds = Array.from(new Set([userProfile.id, userProfile.id, (userProfile as any).studentCode])).filter(Boolean) as string[];

        // Fetch reports
        const reportsSnap = await getDocs(query(collection(db, 'dailyMissionReports'), where('userId', 'in', uIds)));
        const reports = reportsSnap.docs.map(d => d.data());

        // Fetch leaves
        const leavesSnap = await getDocs(query(collection(db, 'leaveRequests'), where('userId', 'in', uIds)));
        const leaves = leavesSnap.docs.map(d => d.data());

        // Fetch holidays
        const holidaysSnap = await getDocs(collection(db, 'holidays'));
        const holidays = holidaysSnap.docs.map(d => d.data());

        const instHolidays = sysSettings?.institutionalHolidays || [];

          // Run local calculation for logs
        let logs: string[] = [];
        const originalConsoleLog = console.log;
        
        let cycleStats = {};
        
        setLogData({
          reports,
          leaves,
          holidays,
          sysSettings,
          cycleStats,
          logs
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [userProfile]);

  if (loading) {
    return (
      <div className="mt-8 p-4 bg-slate-900 rounded-2xl border border-slate-800 text-center">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
        <p className="text-xs text-slate-400 mt-2">Loading Diagnostic Logs...</p>
      </div>
    );
  }

  if (!logData) return null;

  return (
    <div className="mt-8 p-6 bg-slate-950 rounded-3xl border border-slate-800 shadow-xl overflow-hidden font-mono text-[11px] text-slate-300">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
        <h3 className="font-bold text-indigo-400 uppercase tracking-widest text-xs">Diagnostic Mode Active</h3>
        <button 
          onClick={async () => {
            try {
              setLoading(true);
              const { StudentStatsService } = await import('../../services/studentStats');
              await StudentStatsService.updateStats(userProfile?.id || userProfile?.id || '');
              window.location.reload();
            } catch (err) {
              console.error(err);
              alert('Sync failed');
              setLoading(false);
            }
          }}
          className="text-[9px] text-slate-300 bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-md font-bold cursor-pointer transition-colors shadow-lg active:scale-95"
        >
          SYNC CYCLE DATA
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="text-emerald-400 font-bold mb-2">Cycle Stats Output</h4>
          <pre className="bg-slate-900 p-3 rounded-xl overflow-x-auto text-[10px] leading-relaxed">
            {JSON.stringify(logData.cycleStats, null, 2)}
          </pre>
        </div>

        <div>
          <h4 className="text-amber-400 font-bold mb-2">User Profile Summary</h4>
          <pre className="bg-slate-900 p-3 rounded-xl overflow-x-auto text-[10px] leading-relaxed">
            {JSON.stringify({
              id: userProfile?.id,
              uid: userProfile?.id,
              batchId: userProfile?.batchId,
              cyclePoints: (userProfile as any)?.cyclePoints,
              consistencyIndex: (userProfile as any)?.consistencyIndex,
              currentCycle: (userProfile as any)?.currentCycle,
              cycleDay: (userProfile as any)?.cycleDay
            }, null, 2)}
          </pre>
        </div>

        <div>
          <h4 className="text-blue-400 font-bold mb-2">Raw Reports Fetched: {logData.reports.length}</h4>
          <div className="max-h-64 overflow-y-auto bg-slate-900 p-3 rounded-xl">
            {logData.reports.map((r: any, idx: number) => (
              <div key={idx} className="mb-2 pb-2 border-b border-slate-800 last:border-0 last:mb-0 last:pb-0">
                <span className="text-indigo-300">{r.date}</span> | Status: <span className="text-slate-100">{r.status}</span> | Marks: <span className="text-emerald-300">{r.marks}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
