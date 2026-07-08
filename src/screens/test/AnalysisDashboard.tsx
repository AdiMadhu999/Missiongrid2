import React, { useState, useEffect } from 'react';
import { ChevronLeft, BarChart2, Users, BookOpen } from 'lucide-react';
import { getResultsForStudent } from '../../services/result';
import { Result } from '../../models/result';
import { useAuth } from '../../providers/AuthProvider';

export default function AnalysisDashboard({ onBack }: { onBack: () => void }) {
  const { userProfile } = useAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.uid) {
      loadStats(userProfile.uid);
    }
  }, [userProfile]);

  const loadStats = async (studentId: string) => {
    setLoading(true);
    const data = await getResultsForStudent(studentId);
    setResults(data);
    setLoading(false);
  };

  const avgScore = results.length > 0 
    ? (results.reduce((sum, r) => sum + (r.accuracy ?? 0), 0) / results.length).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
           <ChevronLeft size={20} className="text-slate-600"/>
        </button>
        <h1 className="text-xl font-black text-slate-900">Performance Dashboard</h1>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Calculating your performance...</div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <BarChart2 size={48} className="mx-auto text-slate-300 mb-4"/>
          <h3 className="font-bold text-slate-900">No performance data yet.</h3>
          <p className="text-slate-500 text-sm">Complete your first test to see analytics.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <BarChart2 className="text-indigo-600 mb-2"/>
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Avg Accuracy</p>
                    <p className="text-xl font-bold">{avgScore}%</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <Users className="text-indigo-600 mb-2"/>
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Total Attempts</p>
                    <p className="text-xl font-bold">{results.length}</p>
              </div>
          </div>

          <h3 className="font-bold text-slate-800 mb-3 text-sm">Recent Performance</h3>
          <div className="space-y-3">
            {results.map(r => (
                <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><BookOpen size={18} /></div>
                        <div>
                            <p className="font-bold text-slate-900 text-sm">Test ID: {r.testId}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{r.obtainedMarks} / {r.totalMarks}</p>
                        </div>
                    </div>
                    <p className={`font-bold text-sm ${(r.accuracy ?? 0) > 50 ? 'text-emerald-600' : 'text-amber-600'}`}>{(r.accuracy ?? 0).toFixed(1)}%</p>
                </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
