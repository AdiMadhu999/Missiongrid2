import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../providers/AuthProvider';
import { Bell, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getNavigationPath } from '../utils/navigation';

export const NotificationScreen = () => {
    const { userProfile } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    useEffect(() => {
        if (!userProfile?.id) return;
        const q = query(collection(db, 'notifications'), where('receiverId', '==', userProfile.id), limit(50));
        return onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            data.sort((a, b) => {
                const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return timeB - timeA;
            });
            setNotifications(data);
        });
    }, [userProfile?.id]);

    const markAsRead = async (id: string) => {
        await updateDoc(doc(db, 'notifications', id), { read: true });
    };

    useEffect(() => {
        if (notifications.length > 0 && type && id) {
            const notif = notifications.find(n => n.activityType === type && n.activityId === id);
            if (notif) {
                markAsRead(notif.id);
                navigate(getNavigationPath(notif.activityType, notif.activityId));
            }
        }
    }, [notifications, type, id, navigate, markAsRead]);

    return (
        <div className="pb-32 bg-slate-50 min-h-screen">
            <header className="px-4 py-4 bg-white border-b border-slate-200 sticky top-0 z-10 flex items-center gap-3">
                <button onClick={() => navigate('/app/community')}><ArrowLeft className="w-5 h-5"/></button>
                <h1 className="text-lg font-black text-slate-900">Notifications</h1>
            </header>
            <div className="px-2 pt-4 space-y-2">
                {notifications.map(notif => (
                    <div key={notif.id} className={`p-4 rounded-2xl flex gap-3 content-visibility-auto gpu-accelerated ${notif.read ? 'bg-white' : 'bg-indigo-50 border-l-4 border-indigo-500'}`}>
                        <div className='bg-slate-100 p-2 rounded-full h-fit'><Bell className='w-4 h-4 text-slate-600'/></div>
                        <div className='flex-1'>
                            <p className="font-bold text-sm text-slate-900">{notif.title}</p>
                            <p className="text-xs text-slate-600 mb-2">{notif.description}</p>
                            <button onClick={() => { markAsRead(notif.id); navigate(getNavigationPath(notif.activityType, notif.activityId)); }} className="text-xs font-bold text-indigo-600 underline">Open Activity</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
