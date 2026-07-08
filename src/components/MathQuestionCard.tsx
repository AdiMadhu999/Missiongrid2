import React, { useState, useMemo } from 'react';
import MathRenderer from './MathRenderer';
import MathDiagram from './MathDiagram';
import { ChevronDown, ChevronUp, Lightbulb, BookOpen, Calculator, CheckCircle2, AlertCircle, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIQuestion {
  id: string;
  type: string;
  text: string;
  options?: string[];
  correctAnswers: string[];
  points: number;
  negativePoints?: number;
  explanation: string;
  examApproach?: string;
  ruleOrTheorem?: string;
  stepwiseSolution?: string[];
  keyConcept?: string;
  diagramMetadata?: any;
  diagram_svg?: string;
  formula_latex?: string;
  topic: string;
  chapter?: string;
  difficulty?: string;
}

interface MathQuestionCardProps {
  question: AIQuestion;
  index: number;
  showSolution?: boolean;
}

import { parseSquashedExplanation } from '../utils/parseExplanation';

export function MathQuestionCard({ question: rawQuestion, index, showSolution: initialShow = false }: MathQuestionCardProps) {
  const [expanded, setExpanded] = useState(initialShow);
  const question = useMemo(() => {
    const parsed = parseSquashedExplanation(rawQuestion);
    return {
      ...rawQuestion,
      explanation: parsed.explanation,
      stepwiseSolution: parsed.stepwiseSolution,
      examApproach: parsed.examApproach,
      ruleOrTheorem: parsed.ruleOrTheorem
    };
  }, [rawQuestion]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group">
      {/* Header Info */}
      <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            Q{index + 1}
          </span>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              question.difficulty === 'Hard' || question.difficulty === 'Expert' 
                ? 'bg-rose-100 text-rose-700' 
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {question.difficulty || 'Medium'}
            </span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{question.topic}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tight text-slate-500">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            +{question.points}
          </div>
          <div className="flex items-center gap-1.5 text-rose-500">
            <AlertCircle className="w-3.5 h-3.5" />
            -{question.negativePoints || 0.5}
          </div>
        </div>
      </div>

      {/* Main Question Body */}
      <div className="p-6 space-y-6">
        <div className="text-lg text-slate-800 leading-relaxed font-medium">
          <MathRenderer content={question.text} formula_latex={question.formula_latex} />
        </div>

        {/* Diagram */}
        <MathDiagram 
          metadata={question.diagramMetadata} 
          diagram_svg={question.diagram_svg} 
        />

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {question.options?.map((option, idx) => (
            <div 
              key={`${question.id}-opt-${idx}`}
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group/opt"
            >
              <span className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover/opt:border-indigo-300 group-hover/opt:text-indigo-600 transition-colors bg-white shadow-sm">
                {String.fromCharCode(65 + idx)}
              </span>
              <div className="text-slate-700 font-medium">
                <MathRenderer content={option} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Structured Solution Toggle */}
      <div className="mt-auto border-t border-slate-50">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full px-6 py-4 flex items-center justify-between text-indigo-600 hover:bg-indigo-50/50 transition-colors"
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <Calculator className="w-4 h-4" />
            {expanded ? 'Hide Stepwise Solution' : 'View Stepwise Solution'}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-slate-50/80"
            >
              <div className="p-6 space-y-6">
                {/* Correct Answer Hero */}
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-emerald-800 font-bold text-sm">Correct Answer</div>
                      <div className="text-emerald-600 text-lg font-bold">
                         {question.correctAnswers.join(", ")}
                      </div>
                    </div>
                  </div>
                  {question.keyConcept && (
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white border border-emerald-100 rounded-full text-emerald-700 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                      <Lightbulb className="w-3 h-3" />
                      {question.keyConcept}
                    </div>
                  )}
                </div>

                {/* Explanation & Approach */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wider">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      Detailed Explanation
                    </h4>
                    <div className="space-y-4">
                      {question.stepwiseSolution?.map((step, sIdx) => (
                        <div key={`${question.id}-step-${sIdx}`} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-6 h-6 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0 z-10">
                              {sIdx + 1}
                            </div>
                            {sIdx < (question.stepwiseSolution?.length || 0) - 1 && (
                              <div className="w-0.5 flex-1 bg-indigo-100 my-1" />
                            )}
                          </div>
                          <div className="pb-4 text-slate-600 leading-relaxed text-sm">
                            <MathRenderer content={step} />
                          </div>
                        </div>
                      ))}
                      {!question.stepwiseSolution?.length && question.explanation && (
                        <div className="text-slate-600 leading-relaxed text-sm">
                          <MathRenderer content={question.explanation} />
                        </div>
                      )}
                    </div>
                  </div>

                  {question.examApproach && (
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <h4 className="flex items-center gap-2 text-emerald-800 font-bold text-sm uppercase tracking-wider">
                        <Calculator className="w-4 h-4 text-emerald-600" />
                        Exam Approach / Shortcut
                      </h4>
                      <div className="text-slate-600 leading-relaxed text-sm p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <MathRenderer content={question.examApproach} />
                      </div>
                    </div>
                  )}

                  {question.ruleOrTheorem && (
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <h4 className="flex items-center gap-2 text-blue-800 font-bold text-sm uppercase tracking-wider">
                        <Bookmark className="w-4 h-4 text-blue-600" />
                        Rule / Theorem / Trick
                      </h4>
                      <div className="text-slate-600 leading-relaxed text-sm p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <MathRenderer content={question.ruleOrTheorem} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Final Conclusion */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-widest">
                    <span>Final Answer Proof</span>
                    <span className="text-indigo-600">SSC CGL Standard</span>
                  </div>
                  <div className="mt-2 text-slate-800 font-bold">
                    The final answer is <MathRenderer content={question.correctAnswers[0]} isBlock={false} />.
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
