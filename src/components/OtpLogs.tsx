import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { RotateCw, Play, Pause } from 'lucide-react';

export const OtpLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isRealTime, setIsRealTime] = useState(true);

  const fetchLogs = useCallback(async () => {
    const q = query(collection(db, 'otp_logs'), orderBy('timestamp', 'desc'), limit(10));
    const snapshot = await getDocs(q);
    setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, []);

  useEffect(() => {
    if (isRealTime) {
      const q = query(collection(db, 'otp_logs'), orderBy('timestamp', 'desc'), limit(10));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn("OtpLogs real-time subscription restricted or failed:", err);
      });
      return () => unsubscribe();
    } else {
      fetchLogs();
    }
  }, [isRealTime, fetchLogs]);

  return (
    <div className="bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-black text-slate-900 text-sm uppercase tracking-wider">Recent OTP Logs</h4>
        <div className="flex gap-2">
            <button onClick={() => setIsRealTime(!isRealTime)} className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" title={isRealTime ? "Disable Real-time" : "Enable Real-time"}>
                {isRealTime ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={fetchLogs} className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" title="Refresh">
                <RotateCw size={14} />
            </button>
        </div>
      </div>
      <div className="space-y-2">
        {logs.map(log => (
          <div key={log.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-800">{log.mobile}</p>
              <p className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
            <span className={`text-[10px] font-black px-2 py-1 rounded ${log.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {log.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
