import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trophy, CheckCircle, AlertTriangle } from 'lucide-react';
import { getResultsForStudent } from '../../services/result';
import { Result } from '../../models/result';

export default function StudentResultHistory({ onBack }: { onBack: () => void }) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Replace with real student ID from Auth
    loadResults('student123');
  }, []);

  const loadResults = async (studentId: string) => {
    setLoading(true);
    const data = await getResultsForStudent(studentId);
    setResults(data);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack}><ChevronLeft/></button>
        <h1 className="text-xl font-black">My Results</h1>
      </div>

       <div className="space-y-3">
        {loading ? <div className="text-center py-8">Loading...</div> : results.map(r => (
            <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div>
                     <p className="font-bold">{r.testId}</p>
                     <p className="text-[10px] text-slate-500 uppercase">{r.obtainedMarks} / {r.totalMarks} Marks</p>
                </div>
                <div className="text-right">
                    <p className={`font-bold ${(r.accuracy ?? 0) > 50 ? 'text-emerald-600' : 'text-amber-600'}`}> {(r.accuracy ?? 0).toFixed(1)}%</p>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}
