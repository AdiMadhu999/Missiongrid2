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
          <div className="p-4 bg-white border-b border-slate-200 flex gap-2 overflow-x-auto sticky top-0 z-10">
              <div className="md:max-w-5xl mx-auto w-full flex gap-2">
                <button onClick={() => setView('list')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Test Management</button>
                <button onClick={() => setView('evaluate')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${view === 'evaluate' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Manual Evaluations</button>
              </div>
          </div>
      )}

      <div className="flex-1 w-full md:max-w-5xl md:mx-auto">
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
    </div>
  );
}
