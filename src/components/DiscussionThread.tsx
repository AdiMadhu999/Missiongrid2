import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Card } from './ui/Card';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { DoubtThreadReply } from './DoubtThreadReply';
import { useAuth } from '../providers/AuthProvider';

interface Discussion {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: 'Solved' | 'Unsolved';
  createdAt: any;
}

interface Reply {
  id: string;
  userId: string;
  content: string;
  createdAt: any;
}

interface Props {
  discussion: Discussion;
  onBack: () => void;
}

export const DiscussionThread = ({ discussion, onBack }: Props) => {
  const { userProfile } = useAuth();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const isMentor = userProfile?.role && ['mentor', 'primary-mentor', 'primarymentor', 'staff', 'admin', 'examiner'].includes(userProfile.role);

  useEffect(() => {
    const q = query(collection(db, 'discussions', discussion.id, 'replies'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setReplies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reply)));
      setLoading(false);
    });
  }, [discussion.id]);

  const deleteReply = async (replyId: string) => {
    if (!confirm('Are you sure you want to delete this reply?')) return;
    await deleteDoc(doc(db, 'discussions', discussion.id, 'replies', replyId));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 bg-white border-b flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="font-bold text-lg text-slate-900 truncate">{discussion.title}</h2>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <Card className="p-4 bg-indigo-50 border-indigo-100">
          <p className="text-xs text-indigo-800 font-bold mb-1">Doubt</p>
          <p className="text-sm text-slate-800">{discussion.content}</p>
        </Card>

        {loading ? (
            <div className='flex justify-center p-4'><Loader2 className="animate-spin w-6 h-6 text-indigo-600" /></div>
        ) : (
            replies.map(r => (
                <div key={r.id} className="bg-white p-3 rounded-lg border shadow-sm self-start max-w-[85%] flex items-start justify-between">
                    <div>
                        <p className="text-xs text-slate-500 font-bold mb-1">User: {r.userId.slice(0, 8)}</p>
                        <p className="text-sm text-slate-700">{r.content}</p>
                    </div>
                    {(isMentor || userProfile?.id === r.userId) && (
                        <button onClick={() => deleteReply(r.id)} className="p-1 hover:bg-slate-100 rounded-full text-rose-600">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ))
        )}
      </div>

      <DoubtThreadReply discussionId={discussion.id} />
    </div>
  );
};
