import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings, Shield, AlertTriangle, Eye, Archive, History, ChevronLeft, MoreVertical } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { db } from '../../services/firebase';
import { safeDate } from '../../utils/date';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ModuleConfig, ModuleStatus } from '../../models/module';

export default function ModuleControlScreen({ onBack }: { onBack: () => void }) {
  const { userProfile } = useAuth();
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'system_modules'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ModuleConfig));
    setModules(data);
    setLoading(false);
  };

  const updateModuleStatus = async (id: string, status: ModuleStatus) => {
    if (userProfile?.role !== 'mentor' && !userProfile?.isPrimaryMentor) return;
    await updateDoc(doc(db, 'system_modules', id), { 
        status, 
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile.name 
    });
    loadModules();
  };

  if (userProfile?.role !== 'mentor' && !userProfile?.isPrimaryMentor) {
      return <div className="p-4 text-center">Access Denied</div>;
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
           <ChevronLeft size={20} className="text-slate-600"/>
        </button>
        <h1 className="text-xl font-black text-slate-900">Module Control</h1>
      </div>

      {loading ? <div className="text-center">Loading...</div> : (
        <div className="space-y-3">
            {modules.map((mod, idx) => (
                <div key={`${mod.id || 'mod'}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="font-bold text-slate-900">{mod.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{mod.status} • Updated {safeDate(mod.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                        {mod.status !== 'active' && <button onClick={() => updateModuleStatus(mod.id, 'active')} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Settings size={16}/></button>}
                        {mod.status !== 'maintenance' && <button onClick={() => updateModuleStatus(mod.id, 'maintenance')} className="p-2 bg-amber-50 text-amber-600 rounded-lg"><AlertTriangle size={16}/></button>}
                        <button className="p-2 text-slate-400"><MoreVertical size={16}/></button>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}
