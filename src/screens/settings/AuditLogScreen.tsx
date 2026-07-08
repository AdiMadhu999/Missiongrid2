import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Filter, Shield, Activity, User, Calendar } from 'lucide-react';
import { getAuditLogs } from '../../services/audit';
import { AuditRecord } from '../../models/audit';

export default function AuditLogScreen({ onBack }: { onBack: () => void }) {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const data = await getLogs();
    setLogs(data);
    setLoading(false);
  };

  const getLogs = async () => {
    return await getAuditLogs();
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
           <ChevronLeft size={20} className="text-slate-600"/>
        </button>
        <h1 className="text-xl font-black text-slate-900">System Audit Log</h1>
      </div>

       {/* Search & Filter */}
       <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <input type="text" placeholder="Search logs..." className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm" />
            <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
          </div>
          <button className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <Filter size={20} className="text-slate-600"/>
          </button>
       </div>

      <div className="space-y-3">
        {loading ? <div className="text-center py-8 text-slate-500">Loading audit trail...</div> : logs.map((log, idx) => (
            <div key={`${log.id || 'log'}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Activity size={18} /></div>
                <div className="flex-1">
                    <p className="font-bold text-slate-900 text-sm capitalize">{log.eventType.replace('_', ' ')}</p>
                    <p className="text-[10px] text-slate-500">{log.userName} • {log.role} • {log.date.slice(5, 10)} {log.time}</p>
                    <p className="text-xs text-slate-700 mt-1">{log.action}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-lg ${log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {log.status.toUpperCase()}
                </span>
            </div>
        ))}
      </div>
    </div>
  );
}
