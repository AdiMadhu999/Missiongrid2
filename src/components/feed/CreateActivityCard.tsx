import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Image as ImageIcon, FileText, Megaphone, ClipboardList, Link as LinkIcon, Video, HelpCircle } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

export const CreateActivityCard = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const isMentor = userProfile?.role === 'mentor';

    return (
        <div className="p-4 bg-white/60  shadow-sm rounded-2xl border border-white/50 mb-6">
            <div className="flex items-center gap-3 bg-slate-100/50 rounded-2xl p-2 border border-transparent focus-within:border-indigo-200 focus-within:bg-white transition-all">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-500 text-sm border-2 border-white shadow-sm shrink-0">
                    {userProfile?.name?.charAt(0) || 'U'}
                </div>
                <input 
                    type="text" 
                    placeholder="Post your Query" 
                    className="flex-1 p-2 bg-transparent text-xs font-bold outline-none"
                    readOnly
                />
                <div className="flex gap-2 pr-2">
                    {isMentor ? (
                        <>
                            <button onClick={() => navigate('/app/create/article')} className="p-1.5 rounded-full hover:bg-white text-slate-500"><FileText className="w-4 h-4 text-orange-500" /></button>
                            <button onClick={() => navigate('/app/create/announcement')} className="p-1.5 rounded-full hover:bg-white text-slate-500"><Megaphone className="w-4 h-4 text-blue-500" /></button>
                            <button onClick={() => navigate('/app/create/audio')} className="p-1.5 rounded-full hover:bg-white text-slate-500"><MessageSquare className="w-4 h-4 text-emerald-500" /></button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => navigate('/app/create/doubt')} className="p-1.5 rounded-full hover:bg-white text-slate-500"><HelpCircle className="w-4 h-4 text-amber-500" /></button>
                            <button onClick={() => navigate('/app/create/image')} className="p-1.5 rounded-full hover:bg-white text-slate-500"><ImageIcon className="w-4 h-4 text-green-500" /></button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
