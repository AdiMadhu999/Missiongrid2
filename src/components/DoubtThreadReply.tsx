import React, { useState } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Send, Image, FileText, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

interface Props {
  discussionId: string;
}

export const DoubtThreadReply = ({ discussionId }: Props) => {
  const { userProfile } = useAuth();
  const [replyContent, setReplyContent] = useState('');

  const handlePostReply = async () => {
    if (!replyContent || !userProfile?.id) return;
    await addDoc(collection(db, 'discussions', discussionId, 'replies'), {
      userId: userProfile.id,
      content: replyContent,
      createdAt: new Date().toISOString()
    });
    setReplyContent('');
  };

  return (
    <div className="p-4 bg-white border-t space-y-2">
      <textarea
        className="w-full p-2 border rounded-lg text-sm"
        placeholder="Type your reply..."
        value={replyContent}
        onChange={(e) => setReplyContent(e.target.value)}
        rows={3}
      />
      <div className="flex justify-between items-center">
        <div className="flex gap-2 text-slate-400">
          <button className="p-1 hover:text-indigo-600"><Image className="w-5 h-5" /></button>
          <button className="p-1 hover:text-indigo-600"><FileText className="w-5 h-5" /></button>
          <button className="p-1 hover:text-indigo-600"><LinkIcon className="w-5 h-5" /></button>
        </div>
        <button onClick={handlePostReply} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold">
          <Send className="w-4 h-4" />
          Reply
        </button>
      </div>
    </div>
  );
};
