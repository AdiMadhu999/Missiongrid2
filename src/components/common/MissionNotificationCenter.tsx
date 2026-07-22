import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../models/user';
import { Batch } from '../../models/mission';

interface MissionNotificationCenterProps {
    userProfile: User | null;
    stats: { consistency: number, streak: number, reputation: number };
    batch: Batch | null;
}

interface Alert {
    id: string;
    message: string;
    type: 'study' | 'test' | 'profile' | 'rank';
    actionLabel: string;
    actionPath: string;
    priority: number;
}

export const MissionNotificationCenter: React.FC<MissionNotificationCenterProps> = ({ userProfile, stats, batch }) => {
    const navigate = useNavigate();

    const alerts = useMemo(() => {
        const generatedAlerts: Alert[] = [];

        if (stats.consistency < 80) {
            generatedAlerts.push({
                id: 'study-incomplete',
                message: '🔥 Daily Study Goal in progress.',
                type: 'study',
                actionLabel: 'Study',
                actionPath: '/app/study',
                priority: 1
            });
        }

        return generatedAlerts.sort((a, b) => a.priority - b.priority).slice(0, 5);
    }, [stats, userProfile, batch]);

    if (alerts.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Mission Alerts</h3>
            {alerts.map((alert, idx) => (
                <div key={`${alert.id || 'alert'}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-slate-700">{alert.message}</p>
                    <button 
                        onClick={() => navigate(alert.actionPath)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] px-3 py-1.5 rounded-lg transition"
                    >
                        {alert.actionLabel}
                    </button>
                </div>
            ))}
        </div>
    );
};
