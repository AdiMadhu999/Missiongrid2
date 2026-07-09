import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, ArrowRight, Plus, Database } from 'lucide-react';
import { Test } from '../../models/mission';
import { TestService } from '../../services/test';
import { useAuth } from '../../providers/AuthProvider';
import TestCreateEdit from './TestCreateEdit';
import QuestionBankScreen from './QuestionBankScreen';

export default function TestDashboard() {
  const { userProfile } = useAuth();
  const role = (userProfile?.role || '').toLowerCase();
  const isMentor = role === 'mentor' || role === 'primary-mentor' || role === 'staff' || role === 'admin' || role === 'examiner';

  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isViewingQuestions, setIsViewingQuestions] = useState(false);
  const [view, setView] = useState<'dashboard' | 'bank'>('dashboard');

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    setLoading(true);
    try {
      if (isMentor) {
        const data = await TestService.getTestsForMentor(userProfile?.id || '');
        setTests(data);
      } else if (userProfile?.role === 'student') {
        const data = await TestService.getTestsForStudent(userProfile.id);
        setTests(data);
      }
    } finally {
      setLoading(false);
    }
  };
 
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'live': return 'text-emerald-600 bg-emerald-50';
      case 'published': return 'text-indigo-600 bg-indigo-50';
      case 'draft': return 'text-slate-600 bg-slate-100';
      case 'archived': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  if (isCreating || editingTestId) {
    return <TestCreateEdit testId={editingTestId} onClose={() => { setEditingTestId(null); setIsCreating(false); }} onSaved={loadTests} />;
  }

  if (view === 'bank') {
    return <QuestionBankScreen onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-slate-900">Test Dashboard</h1>
        {isMentor && (
            <div className='flex gap-2'>
                <button onClick={() => setView('bank')} className="p-3 bg-slate-800 text-white rounded-2xl shadow-sm"><Database size={20}/></button>
                <button onClick={() => setIsCreating(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm"><Plus size={20}/></button>
            </div>
        )}
      </div>

      <div className="space-y-4">
        {loading ? <div className="text-center">Loading tests...</div> : tests.map(test => (
            <motion.div key={test.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between" onClick={() => isMentor && setEditingTestId(test.id)}>
                <div className="flex gap-4 items-center">
                    <div className="p-3 rounded-xl bg-slate-100"><BookOpen className="text-slate-600" size={20} /></div>
                    <div>
                        <p className="font-bold text-slate-900">{test.title}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{test.type || 'Standard'} • {test.duration} mins • {test.maximumMarks} Marks</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${getStatusColor(test.status)}`}>{test.status.toUpperCase()}</span>
                    <button className="text-slate-400"><ArrowRight size={20}/></button>
                </div>
            </motion.div>
        ))}
      </div>
    </div>
  );
}
