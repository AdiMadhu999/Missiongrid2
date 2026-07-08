import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit } from 'firebase/firestore';
import { useAuth } from '../../providers/AuthProvider';
import { MentorPostType } from '../../models/feed';
import { sendNotification } from '../../services/notifications';

export default function MentorPostCreationScreen() {
    const { activityType } = useParams<{ activityType: string }>();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [batchVisibility, setBatchVisibility] = useState('global');
    const [link, setLink] = useState('');
    const [saving, setSaving] = useState(false);

    const handlePublish = async (status: 'published' | 'draft') => {
        if (!title || !description) return;
        setSaving(true);
        try {
            const docRef = await addDoc(collection(db, 'mentorPosts'), {
                title,
                content: description,
                postType: activityType as MentorPostType,
                type: 'MentorPost',
                authorId: userProfile?.uid,
                authorName: userProfile?.name,
                visibility: batchVisibility === 'global' ? 'global' : 'batch',
                batchId: batchVisibility !== 'global' ? batchVisibility : null,
                createdAt: serverTimestamp(),
                publishedStatus: status,
                pinnedStatus: false,
                youtubeLink: activityType === 'video' ? link : null,
                externalLink: activityType === 'link' ? link : null
            });
            if (status === 'published') {
                const q = query(collection(db, 'users'), where('role', '==', 'student'), limit(50));
                const usersSnap = await getDocs(q);
                usersSnap.forEach(user => {
                    sendNotification(user.id, userProfile!.uid, 'MentorPost', docRef.id, 'New Mentor Post', title);
                });
            }
            navigate('/app/feed');
        } catch (error) {
            console.error('Error publishing post:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 min-h-screen bg-slate-50">
            <button onClick={() => navigate('/app/feed')} className="flex items-center gap-2 text-slate-600 mb-6 font-bold">
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
                <select 
                    value={batchVisibility} 
                    onChange={(e) => setBatchVisibility(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 font-bold"
                >
                    <option value="global">All Batches</option>
                    <option value="batch1">Batch 1</option>
                </select>
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
