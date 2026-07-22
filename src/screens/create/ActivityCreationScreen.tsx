import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { db, auth } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../providers/AuthProvider';

export default function ActivityCreationScreen() {
    const { activityType } = useParams<{ activityType: string }>();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    const handlePublish = async () => {
        if (!title || !description) return;
        setSaving(true);
        try {
            await addDoc(collection(db, 'discussions'), {
                title,
                content: description,
                type: 'Doubt',
                status: 'Unsolved',
                userId: auth.currentUser?.uid || userProfile?.uid || userProfile?.id,
                privacy: 'public',
                studentId: userProfile?.id, authorId: userProfile?.id, authorPhoto: userProfile?.photoUrl,
                authorName: userProfile?.name,
                batchId: userProfile?.batchId || '',
                batchIds: [userProfile?.batchId || ''],
                visibility: 'batch',
                createdAt: serverTimestamp(),
                replyCount: 0
            });
            navigate('/app/guide');
        } catch (error) {
            console.error('Error creating doubt:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 min-h-screen bg-slate-50">
            <button onClick={() => navigate('/app/guide')} className="flex items-center gap-2 text-slate-600 mb-6 font-bold">
                <ArrowLeft className="w-5 h-5" /> Back to Community
            </button>
            <h1 className="text-2xl font-black text-slate-900 capitalize tracking-tight mb-6">Ask a {activityType}</h1>
            
            <div className="space-y-4">
                <input 
                    type="text" 
                    placeholder="Doubt Title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 font-bold"
                />
                <textarea 
                    placeholder="Describe your doubt..." 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 h-40 font-medium"
                />
            </div>
            
            <button 
                onClick={handlePublish}
                disabled={saving}
                className="w-full mt-8 bg-amber-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
            >
                {saving ? 'Posting...' : <><Save className="w-5 h-5" /> Post Doubt</>}
            </button>
        </div>
    );
}
