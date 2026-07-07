import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../providers/AuthProvider';
import { useNavigate } from 'react-router-dom';

export const NotificationBell = () => {
    const { userProfile } = useAuth();
    const [count, setCount] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        if (!userProfile?.uid) return;
        const q = query(collection(db, 'notifications'), where('receiverId', '==', userProfile.uid), where('read', '==', false));
        return onSnapshot(q, (snap) => setCount(snap.size));
    }, [userProfile?.uid]);

    return (
        <button onClick={() => navigate('/app/notifications')} className="relative text-slate-500">
            <Bell className="w-5 h-5" />
            {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {count}
                </span>
            )}
        </button>
    );
};
