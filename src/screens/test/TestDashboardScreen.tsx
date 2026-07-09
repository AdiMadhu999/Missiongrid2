import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import MentorTestList from './MentorTestList';
import StudentTestList from './StudentTestList';
import EvaluatorDashboard from './EvaluatorDashboard';

export default function TestDashboardScreen() {
  const { userProfile } = useAuth();
  const [view, setView] = useState<'list' | 'evaluate'>('list');
  const [searchParams] = useSearchParams();
  const isTestEditMode = searchParams.get('mode') === 'edit';
  
  if (!userProfile) return null;

  const isMentor = userProfile.role === 'mentor' || userProfile.role === 'primary-mentor';
  const isExaminer = userProfile.role === 'examiner';

  return (
    <div className="flex flex-col h-full w-full">
      {(isMentor || isExaminer) && !isTestEditMode && (
          <div className="p-4 bg-white border-b border-slate-200 flex gap-2 overflow-x-auto">
              <button onClick={() => setView('list')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Test Management</button>
              <button onClick={() => setView('evaluate')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${view === 'evaluate' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Manual Evaluations</button>
          </div>
      )}

      {view === 'evaluate' ? (
        <EvaluatorDashboard onBack={() => setView('list')} />
      ) : (
        isMentor || isExaminer ? (
          <MentorTestList />
        ) : (
          <StudentTestList />
        )
      )}
    </div>
  );
}
