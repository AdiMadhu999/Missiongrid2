import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Result } from '../../models/result';

export default function StudentAnalysisView({ result, onBack }: { result: Result, onBack: () => void }) {
  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack}><ChevronLeft/></button>
        <h1 className="text-xl font-black">Performance: {result.testId}</h1>
      </div>

       <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between">
            <span className="text-sm">Accuracy</span>
            <span className="font-bold text-indigo-600">{(result.accuracy ?? 0).toFixed(1)}%</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
                 <p className="text-[10px] text-emerald-700">Correct</p>
                 <p className="text-lg font-bold text-emerald-900">{result.correct}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl">
                 <p className="text-[10px] text-rose-700">Wrong</p>
                 <p className="text-lg font-bold text-rose-900">{result.wrong}</p>
            </div>
        </div>
       </div>
    </div>
  );
}
