import React, { useState } from 'react';
import { X, CheckCircle2, ChevronRight, Save } from 'lucide-react';
import { TestService } from '../../services/test';
import { TestAttempt, Test } from '../../models/mission';
import { useAuth } from '../../providers/AuthProvider';
import MathDiagram from '../../components/MathDiagram';
import MathRenderer from '../../components/MathRenderer';

interface Props {
  attempt: TestAttempt;
  test: Test;
  onClose: () => void;
  onSaved: () => void;
}

export default function TestEvaluationModal({ attempt, test, onClose, onSaved }: Props) {
  const { userProfile } = useAuth();
  const [evaluations, setEvaluations] = useState<Record<string, { marksAwarded: number, remarks: string }>>({});
  const [loading, setLoading] = useState(false);

  const subjectiveQuestions = test.questions.filter(q => q.type === 'Subjective' || q.type === 'Paragraph');

  const handleSave = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      await TestService.evaluateSubjective(attempt.id, evaluations, userProfile.uid);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateEval = (qId: string, marks: number, remarks: string) => {
    setEvaluations(prev => ({
      ...prev,
      [qId]: { marksAwarded: marks, remarks }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 p-4 flex flex-col z-50 pt-[env(safe-area-inset-top)]">
       <div className="bg-white rounded-t-3xl p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-lg">Marking: {test.title}</h2>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-full"><X size={20}/></button>
       </div>
       
       <div className="bg-white flex-1 overflow-y-auto p-4 space-y-8">
          {subjectiveQuestions.map((q, i) => {
            const ans = attempt.answers[q.id];
            return (
              <div key={`${q.id || 'q'}-${i}`} className="space-y-4 pb-6 border-b border-slate-50 last:border-0">
                <div className="flex gap-3">
                  <span className="w-6 h-6 bg-slate-900 text-white rounded text-[10px] flex items-center justify-center font-bold shrink-0">{i+1}</span>
                  <div className="space-y-2 flex-1">
                    <div className="text-sm font-bold text-slate-800 leading-relaxed"><MathRenderer content={q.text} formula_latex={q.formula_latex} /></div>
                    <MathDiagram 
                      metadata={q.diagramMetadata} 
                      diagram_svg={q.diagram_svg} 
                    />
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-slate-600 text-sm whitespace-pre-wrap">
                      {String(ans?.value || 'No answer submitted')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 bg-slate-50/50 p-4 rounded-2xl">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Marks (Max {q.points})</label>
                    <input 
                      type="number" 
                      max={q.points} 
                      min={0}
                      value={evaluations[q.id]?.marksAwarded || 0}
                      onChange={e => updateEval(q.id, parseInt(e.target.value) || 0, evaluations[q.id]?.remarks || '')}
                      className="w-24 p-3 border border-slate-200 rounded-xl font-black text-lg focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Evaluator Remarks</label>
                    <textarea 
                      value={evaluations[q.id]?.remarks || ''}
                      onChange={e => updateEval(q.id, evaluations[q.id]?.marksAwarded || 0, e.target.value)}
                      placeholder="Add feedback for this answer..."
                      className="w-full p-4 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            );
          })}
       </div>

       <div className="bg-white p-4 rounded-b-3xl border-t border-slate-100">
          <button 
            onClick={handleSave}
            disabled={loading || Object.keys(evaluations).length < subjectiveQuestions.length}
            className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {loading ? 'Submitting Marks...' : <><Save size={20}/> Submit Evaluation</>}
          </button>
       </div>
    </div>
  );
}
