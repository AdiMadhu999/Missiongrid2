import React from 'react';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

interface Props {
  discussionId: string;
  status: 'Solved' | 'Unsolved';
}

export const MentorDoubtControls = ({ discussionId, status }: Props) => {
  const { userProfile } = useAuth();
  const isMentor = userProfile?.role && ['mentor', 'primary-mentor', 'primarymentor', 'staff', 'admin', 'examiner'].includes(userProfile.role);

  if (!isMentor) return null;

  const toggleStatus = async () => {
    const newStatus = status === 'Solved' ? 'Unsolved' : 'Solved';
    await updateDoc(doc(db, 'discussions', discussionId), {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <button 
      onClick={toggleStatus} 
      className={`flex items-center gap-1 text-xs font-bold p-1 rounded hover:bg-slate-100 ${status === 'Solved' ? 'text-green-600' : 'text-red-600'}`}
    >
      {status === 'Solved' ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
      {status}
    </button>
  );
};
