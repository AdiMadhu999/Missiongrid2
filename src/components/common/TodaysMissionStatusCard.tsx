import React, { useState, useEffect } from 'react';
import { Target, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import { MissionService } from '../../services/mission';
import { DailyMissionReport } from '../../models/mission';

export const TodaysMissionStatusCard: React.FC = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [report, setReport] = useState<DailyMissionReport | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile) return;
        const today = new Date().toISOString().split('T')[0];
        
        setLoading(true);
        const unsubscribe = MissionService.subscribeDailyReport(
            userProfile.id || userProfile.id!, 
            today,
            (res) => {
                setReport(res);
                setLoading(false);
            },
            (err) => {
                console.error("Report sync error", err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userProfile]);

    if (loading) return <div className="h-40 bg-white rounded-[2.5rem] animate-pulse border border-slate-100" />;

    const items = [
        { title: 'Mission Report', status: report ? report.status : 'Pending', icon: Target, isComplete: !!report, color: report?.status === 'Approved' ? 'text-emerald-600' : report?.status === 'Warning' ? 'text-rose-600' : 'text-indigo-600', path: '/app/missions' },
        { title: 'Study Time', status: 'Active Tracker', icon: Clock, isComplete: false, color: 'text-indigo-600', path: '/app/study-room' },
    ];

    const completedCount = items.filter(i => i.isComplete).length;

    return (
        <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Today's Mission</h3>
                <span className="text-xs font-black text-indigo-600">{completedCount}/2</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                {items.map((item, i) => (
                    <div 
                        key={i} 
                        onClick={() => navigate(item.path)}
                        className={`p-4 rounded-3xl border transition-all cursor-pointer active:scale-95 ${item.isComplete ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                    >
                        <item.icon size={20} className={`mb-2 ${item.isComplete ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <p className="text-[10px] font-bold uppercase">{item.title}</p>
                        <p className={`text-[10px] font-black ${item.isComplete ? 'text-emerald-800' : 'text-slate-600'}`}>{item.status}</p>
                    </div>
                ))}
            </div>
            
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-black text-slate-500">
                <div className="flex items-center gap-1.5">
                   <AlertCircle size={12} className="text-indigo-400" />
                   <span>Field Status</span>
                </div>
                <span className="text-indigo-600 uppercase tracking-widest text-[9px]">Operational</span>
            </div>
        </div>
    );
};
