import React, { useState, useEffect } from 'react';
import { ChevronLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { getWarningsForStudent, resolveWarning } from '../../services/warning';
import { Warning } from '../../models/warning';
import { useAuth } from '../../providers/AuthProvider';
import { safeDate } from '../../utils/date';

export default function WarningListScreen({ studentId, onBack }: { studentId: string, onBack: () => void }) {
    const [warnings, setWarnings] = useState<Warning[]>([]);
    const [loading, setLoading] = useState(false);
    const { userProfile } = useAuth();
    const isMentor = userProfile?.role === 'mentor';

    useEffect(() => {
        loadWarnings();
    }, [studentId]);

    const loadWarnings = async () => {
        setLoading(true);
        try {
            const data = await getWarningsForStudent(studentId);
            setWarnings(data);
        } catch (e) {
            console.error('Failed to load warnings:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id: string) => {
        try {
            await resolveWarning(id, studentId);
            loadWarnings();
        } catch (e) {
            console.error('Failed to resolve warning:', e);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm"><ChevronLeft size={20}/></button>
                <h1 className="text-xl font-black">Warning History</h1>
            </div>

            <div className="space-y-3">
                {loading ? <p className="text-center text-slate-500 py-10">Loading warnings...</p> : 
                 warnings.length === 0 ? <p className="text-center text-slate-500 py-10">No warnings found.</p> :
                 warnings.map((w, idx) => (
                    <div key={`${w.id || 'warning'}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div className='flex items-center gap-3'>
                            <div className={`p-2 rounded-lg ${w.status === 'Active' ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                                <AlertTriangle className={w.status === 'Active' ? 'text-rose-600' : 'text-emerald-600'} size={20}/>
                            </div>
                            <div>
                                <p className="font-bold">{w.reason}</p>
                                <p className="text-xs text-slate-500">By {w.mentorName} • {safeDate(w.date).toLocaleDateString()}</p>
                            </div>
                        </div>
                        {w.status === 'Active' && isMentor && (
                            <button onClick={() => handleResolve(w.id)} className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle size={20}/></button>
                        )}
                        {w.status === 'Resolved' && <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Resolved</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}
