import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, limit } from 'firebase/firestore';
import { Card } from './ui/Card';
import { Loader2 } from 'lucide-react';
import { DiscussionThread } from './DiscussionThread';
import { MentorDoubtControls } from './MentorDoubtControls';
import { useAuth } from '../providers/AuthProvider';

interface Discussion {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: 'Solved' | 'Unsolved';
  createdAt: any;
}

export const DiscussionBoard = () => {
  const { userProfile } = useAuth();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [activeDiscussion, setActiveDiscussion] = useState<Discussion | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'discussions'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      setDiscussions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Discussion)));
      setLoading(false);
    });
  }, []);

  const handlePostDiscussion = async () => {
    if (!title || !content || !userProfile?.id) return;
    await addDoc(collection(db, 'discussions'), {
      userId: userProfile.id,
      title,
      content,
      status: 'Unsolved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setTitle('');
    setContent('');
  };

  if (loading || !userProfile) return <Loader2 className="animate-spin w-8 h-8 text-indigo-600" />;

  if (activeDiscussion) {
    return <DiscussionThread discussion={activeDiscussion} onBack={() => setActiveDiscussion(null)} />;
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-white shadow-sm space-y-4">
        <h3 className="font-black text-lg">Post a Doubt</h3>
        <input className="w-full p-2 border rounded-lg text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full p-2 border rounded-lg text-sm" placeholder="Describe your doubt" value={content} onChange={(e) => setContent(e.target.value)} />
        <button className="bg-indigo-600 text-white p-2 rounded-lg text-sm font-bold" onClick={handlePostDiscussion}>Post</button>
      </Card>

      <div className="space-y-4">
        {discussions.map(d => (
          <Card key={d.id} className="p-4 bg-white shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-slate-900">{d.title}</h4>
              <div className="flex items-center gap-2">
                <MentorDoubtControls discussionId={d.id} status={d.status} />
              </div>
            </div>
            <p className="text-sm text-slate-600">{d.content}</p>
            <button onClick={() => setActiveDiscussion(d)} className="text-indigo-600 text-xs font-bold">
              View Replies
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
};
