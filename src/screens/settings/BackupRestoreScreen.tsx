import React, { useState, useEffect } from 'react';
import { ChevronLeft, Shield, Clock, RefreshCw, AlertTriangle, Database, Trash2 } from 'lucide-react';
import { getBackups, createBackup } from '../../services/backup';
import { BackupRecord } from '../../models/backup';
import { useAuth } from '../../providers/AuthProvider';

export default function BackupRestoreScreen({ onBack }: { onBack: () => void }) {
  const { userProfile } = useAuth();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    const data = await getBackups();
    setBackups(data);
    setLoading(false);
  };

  const handleCreateBackup = async () => {
    // Only Primary Mentor can initiate
    if (!userProfile?.isPrimaryMentor) return;
    await createBackup({
      date: new Date().toISOString(),
      time: new Date().toLocaleTimeString(),
      createdBy: userProfile.name,
      type: 'manual',
      status: 'completed',
      moduleCount: 15,
      remarks: 'Manual system backup'
    });
    loadBackups();
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
           <ChevronLeft size={20} className="text-slate-600"/>
        </button>
        <h1 className="text-xl font-black text-slate-900">Backup & Data Safety</h1>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800">System Safety</h3>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600`}>PROTECTED</span>
        </div>
        <button onClick={handleCreateBackup} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm">
            <Database size={18} /> CREATE MANUAL BACKUP
        </button>
      </div>

      <div className="space-y-3">
        {loading ? <div className="text-center py-8">Loading history...</div> : backups.map((b, idx) => (
            <div key={`${b.id || 'backup'}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Clock size={18} /></div>
                    <div>
                        <p className="font-bold text-slate-900 text-sm">{b.date.slice(0, 10)}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{b.type} • {b.status}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"><RefreshCw size={16}/></button>
                    <button className="p-2 text-rose-600 bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}
