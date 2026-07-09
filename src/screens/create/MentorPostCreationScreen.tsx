import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit } from 'firebase/firestore';
import { useAuth } from '../../providers/AuthProvider';
import { MentorPostType } from '../../models/feed';
import { sendNotification } from '../../services/notifications';
import { BatchService } from '../../services/batch';

export default function MentorPostCreationScreen() {
    const { activityType } = useParams<{ activityType: string }>();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [batches, setBatches] = useState<any[]>([]);
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const [link, setLink] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const data = await BatchService.getBatches();
                setBatches(data);
                if (data.length > 0) {
                    setSelectedBatchIds(data.map(b => b.id).filter(Boolean) as string[]);
                }
            } catch (error) {
                console.error("Error fetching batches:", error);
            }
        };
        fetchBatches();
    }, []);

    const handlePublish = async (status: 'published' | 'draft') => {
        if (!title || !description) return;
        if (selectedBatchIds.length === 0) {
            alert('Please select at least one batch.');
            return;
        }
        setSaving(true);
        try {
            const isAllSelected = selectedBatchIds.length === batches.length;
            const docRef = await addDoc(collection(db, 'mentorPosts'), {
                title,
                content: description,
                postType: activityType as MentorPostType,
                type: 'MentorPost',
                authorId: userProfile?.id,
                authorName: userProfile?.name,
                visibility: isAllSelected ? 'global' : 'batch',
                batchId: selectedBatchIds[0] || null,
                batchIds: selectedBatchIds,
                createdAt: serverTimestamp(),
                publishedStatus: status,
                pinnedStatus: false,
                youtubeLink: activityType === 'video' ? link : null,
                externalLink: activityType === 'link' ? link : null
            });
            if (status === 'published') {
                const q = query(collection(db, 'users'), where('role', '==', 'student'), limit(200));
                const usersSnap = await getDocs(q);
                usersSnap.forEach(user => {
                    const userData = user.data();
                    const studentBatchId = userData.batchId || '';
                    if (isAllSelected || selectedBatchIds.includes(studentBatchId)) {
                        sendNotification(user.id, userProfile!.uid, 'MentorPost', docRef.id, 'New Mentor Post', title);
                    }
                });
            }
            navigate('/app/guide');
        } catch (error) {
            console.error('Error publishing post:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 min-h-screen bg-slate-50">
            <button onClick={() => navigate('/app/guide')} className="flex items-center gap-2 text-slate-600 mb-6 font-bold">
                <ArrowLeft className="w-5 h-5" /> Back to Community
            </button>
            <h1 className="text-2xl font-black text-slate-900 capitalize tracking-tight mb-6">Create {activityType}</h1>
            
            <div className="space-y-4">
                <input 
                    type="text" 
                    placeholder="Title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 font-bold"
                />
                <textarea 
                    placeholder="Description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 h-40 font-medium"
                />
                {(activityType === 'video' || activityType === 'link') && (
                    <div className="space-y-4">
                        <input 
                            type="url" 
                            placeholder={activityType === 'video' ? "YouTube Link" : "External Link"}
                            value={link} 
                            onChange={(e) => setLink(e.target.value)}
                            className="w-full p-4 rounded-xl border border-slate-200"
                        />
                        {activityType === 'video' && link && (() => {
                            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                            const match = link.match(regExp);
                            const videoId = (match && match[2].length === 11) ? match[2] : null;
                            if (videoId) {
                                return (
                                    <div className="rounded-xl overflow-hidden aspect-video bg-slate-100 relative">
                                        <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="YouTube Thumbnail" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play ml-1"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                )}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/85 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                            👥 Target Batches (Visibility)
                        </label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedBatchIds(batches.map(b => b.id).filter(Boolean) as string[])}
                                className="text-[10px] font-black text-indigo-600 uppercase tracking-wider hover:underline"
                            >
                                Select All
                            </button>
                            <span className="text-slate-300 text-xs">|</span>
                            <button
                                type="button"
                                onClick={() => setSelectedBatchIds([])}
                                className="text-[10px] font-black text-rose-500 uppercase tracking-wider hover:underline"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                    
                    {batches.length === 0 ? (
                        <p className="text-xs text-slate-500 font-bold italic">No active batches found.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {batches.map((batch) => {
                                const isChecked = selectedBatchIds.includes(batch.id || '');
                                return (
                                    <label 
                                        key={batch.id} 
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                                            isChecked 
                                                ? 'bg-indigo-50/55 border-indigo-200 text-indigo-900 font-extrabold' 
                                                : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/50 text-slate-600'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                                if (isChecked) {
                                                    setSelectedBatchIds(prev => prev.filter(id => id !== batch.id));
                                                } else {
                                                    setSelectedBatchIds(prev => [...prev, batch.id || '']);
                                                }
                                            }}
                                            className="w-4.5 h-4.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                        />
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs font-bold leading-tight">{batch.batchName || batch.name}</span>
                                            <span className="text-[9px] text-slate-450 font-bold tracking-wide uppercase mt-0.5">{batch.batchCode || 'No Code'}</span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                    {selectedBatchIds.length === 0 && (
                        <p className="text-[10px] text-rose-500 font-extrabold tracking-wide mt-1 animate-pulse">
                            ⚠️ Please select at least one batch for this post.
                        </p>
                    )}
                </div>
            </div>
            
            <div className="flex gap-4 mt-8">
                <button 
                    onClick={() => handlePublish('draft')}
                    disabled={saving}
                    className="flex-1 bg-slate-200 text-slate-700 py-4 rounded-xl font-bold"
                >
                    Save Draft
                </button>
                <button 
                    onClick={() => handlePublish('published')}
                    disabled={saving}
                    className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                    {saving ? 'Publishing...' : <><Save className="w-5 h-5" /> Publish</>}
                </button>
            </div>
        </div>
    );
}
