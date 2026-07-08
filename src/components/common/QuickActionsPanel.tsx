import React, { useMemo } from 'react';
import { Target, Clock, Trophy, BookOpen, User, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { User as UserModel } from '../../models/user';

interface QuickActionsPanelProps {
    userProfile: UserModel | null;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ userProfile }) => {
    const navigate = useNavigate();

    const actions = useMemo(() => {
        return [
            { id: 'target', icon: Target, title: 'Target', path: '/app/targets', highlight: false }, 
            { id: 'study', icon: Clock, title: 'Study', path: '/app/study-room', highlight: false },
            { id: 'test', icon: BookOpen, title: 'Test', path: '/app/tests', highlight: false },
            { id: 'profile', icon: User, title: 'Profile', path: '/app/profile', highlight: false },
        ];
    }, []);

    return (
        <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">⚡ Quick Actions</h3>
            <div className="grid grid-cols-4 gap-2">
                {actions.map(action => (
                    <button
                        key={action.id}
                        onClick={() => navigate(action.path)}
                        className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition bg-white border-slate-100 text-slate-500 hover:border-slate-205`}
                    >
                        <action.icon size={20} />
                        <span className="text-[10px] font-bold">{action.title}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
