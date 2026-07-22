import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Database, Plus, Users, Clock, AlertTriangle, CheckCircle, Activity, BarChart2 } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import TestDashboard from './TestDashboard';
import QuestionBankScreen from './QuestionBankScreen';
import AnalysisDashboard from './AnalysisDashboard';

export default function TestCommandCenter() {
  const { userProfile } = useAuth();
  const [view, setView] = useState<'main' | 'tests' | 'bank' | 'analysis'>('main');

  if (view === 'tests') return <TestDashboard />;
  if (view === 'bank') return <QuestionBankScreen onBack={() => setView('main')} />;
  if (view === 'analysis') return <AnalysisDashboard onBack={() => setView('main')} />;

  const RoleActions = () => {
    if (userProfile?.role === 'mentor') {
      return (
        <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => setView('tests')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <BookOpen size={20} className="text-indigo-600"/>
                <span className="font-bold">Tests</span>
            </button>
            <button onClick={() => setView('bank')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <Database size={20} className="text-indigo-600"/>
                <span className="font-bold">Questions</span>
            </button>
            <button onClick={() => setView('analysis')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <BarChart2 size={20} className="text-indigo-600"/>
                <span className="font-bold">Analytics</span>
            </button>
        </div>
      );
    }
    return (
        <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => setView('tests')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <BookOpen size={20} className="text-indigo-600"/>
                <span className="font-bold">My Tests</span>
            </button>
            <button onClick={() => setView('analysis')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <BarChart2 size={20} className="text-indigo-600"/>
                <span className="font-bold">Analysis</span>
            </button>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      <h1 className="text-2xl font-black text-slate-900 mb-6">Test Command Center</h1>
      
      <RoleActions />

      <h3 className="font-bold text-slate-800 mb-3 text-sm">Live Activity</h3>
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
         <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
                <Clock className="text-emerald-500" size={18}/>
                <span>Live Test: Mock 01</span>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">LIVE</span>
         </div>
         <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={18}/>
                <span>Pending Results: Chapter 05</span>
            </div>
            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">PENDING</span>
         </div>
      </div>
    </div>
  );
}
