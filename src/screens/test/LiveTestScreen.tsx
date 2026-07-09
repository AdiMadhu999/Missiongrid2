import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { saveAnswer, submitTest } from '../../services/testAttempt';
import { evaluateAndSaveResult } from '../../services/result';
import { Test } from '../../models/mission';
import { Question } from '../../models/question';
import MathDiagram from '../../components/MathDiagram';
import MathRenderer from '../../components/MathRenderer';

export default function LiveTestScreen({ test, attemptId, studentId, studentName, questions, onExit }: { test: Test, attemptId: string, studentId: string, studentName: string, questions: Question[], onExit: () => void }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const currentQ = questions[currentIdx];

  const handleSelectAnswer = async (answer: any) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: answer }));
    await saveAnswer(attemptId, currentQ.id, answer, false);
  };

  const handleSubmit = async () => {
    if(confirm('Are you sure you want to submit?')) {
        await submitTest(attemptId);
        await evaluateAndSaveResult({ id: attemptId, testId: test.id, studentId, studentName, answers, markedQuestions: [], status: 'submitted', startTime: '' }, questions);
        onExit();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white p-4 pb-24 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onExit}><ChevronLeft /></button>
        <h1 className="font-bold">{test.title}</h1>
        <button onClick={handleSubmit} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold">SUBMIT</button>
      </div>

      <div className="flex-1">
        <div className="text-lg font-medium mb-4 flex items-start gap-1">
          <span className="flex-shrink-0">{currentIdx + 1}. </span>
          <MathRenderer content={currentQ.text} formula_latex={currentQ.formula_latex} />
        </div>
        <MathDiagram 
          metadata={(currentQ as any).diagramMetadata} 
          diagram_svg={(currentQ as any).diagram_svg} 
        />
        {currentQ.options?.map((opt, i) => {
          const text = typeof opt === 'string' ? opt : (opt as any)?.text || '';
          return (
            <button 
              key={i} 
              onClick={() => handleSelectAnswer(text)} 
              className={`w-full p-3 mb-2 rounded-xl border text-left font-medium transition-all ${answers[currentQ.id] === text ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <MathRenderer content={text} />
            </button>
          );
        })}
      </div>

      <div className="flex justify-between mt-6">
        <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev - 1)} className="px-4 py-2 bg-slate-100 rounded-lg">Prev</button>
        <button disabled={currentIdx === questions.length - 1} onClick={() => setCurrentIdx(prev => prev + 1)} className="px-4 py-2 bg-slate-100 rounded-lg">Next</button>
      </div>
    </div>
  );
}
