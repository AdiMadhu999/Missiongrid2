import React, { useState, useEffect } from 'react';
import { ChevronLeft, Activity, ShieldCheck, Database, HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';
import { getModules, ModuleStatus } from '../../services/modules';
import { useAuth } from '../../providers/AuthProvider';

export default function SystemHealthScreen({ onBack }: { onBack: () => void }) {
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    setLoading(true);
    // Simulating health check for services
    const data = await getModules();
    setModules(data);
    setLoading(false);
  };

  const statusCards = [
    { label: 'Application', status: 'Healthy', icon: Activity, color: 'text-emerald-600' },
    { label: 'Database', status: 'Healthy', icon: Database, color: 'text-emerald-600' },
    { label: 'Storage', status: 'Healthy', icon: HardDrive, color: 'text-emerald-600' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
           <ChevronLeft size={20} className="text-slate-600"/>
        </button>
        <h1 className="text-xl font-black text-slate-900">System Health</h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {statusCards.map((c, i) => (
            <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-center">
                <c.icon size={20} className={`${c.color} mx-auto mb-1`} />
                <p className="text-[10px] font-bold text-slate-900 uppercase">{c.label}</p>
                <p className="text-[9px] text-slate-500">{c.status}</p>
            </div>
        ))}
      </div>

      <h3 className="font-bold text-slate-800 mb-3 text-sm">Module Health</h3>
      <div className="space-y-3">
        {loading ? <div className="text-center py-8">Checking module health...</div> : modules.map((mod, idx) => (
            <div key={`${mod.id || 'mod'}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {mod.status === 'active' ? <CheckCircle className="text-emerald-500" size={18}/> : <AlertTriangle className="text-amber-500" size={18}/>}
                    <div>
                        <p className="font-bold text-slate-900 text-sm">{mod.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{mod.status}</p>
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}
