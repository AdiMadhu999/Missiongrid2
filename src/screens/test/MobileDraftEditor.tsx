import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  CheckCircle2, Trash2, Edit3, ChevronLeft, ChevronRight, 
  Plus, AlertTriangle, Lightbulb, Star, Save, ShieldAlert,
  ThumbsUp, Check, X, Sparkles, HelpCircle, ArrowLeftRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import MathRenderer from "../../components/MathRenderer";
import MathDiagram from "../../components/MathDiagram";
import { parseSquashedExplanation } from '../../utils/parseExplanation';

export interface AIQuestion {
  id: string;
  type?: 'MCQ' | 'MSQ' | 'NAT' | 'Subjective' | string;
  text: string;
  options?: string[];
  correctAnswers?: string[];
  explanation?: string;
  points?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  topic?: string;
  uncertaintyFlag?: boolean;
  qualityReport?: string;
  isEdited?: boolean;
  isApproved?: boolean;
  negativePoints?: number;
  examApproach?: string;
  ruleOrTheorem?: string;
  stepwiseSolution?: string[];
  keyConcept?: string;
  diagram_svg?: string;
  formula_latex?: string;
  diagramMetadata?: {
    needsDiagram: boolean;
    shape?: string;
    labels?: string[];
  };
}

interface MobileDraftEditorProps {
  questions: AIQuestion[];
  activeId: string;
  onSelectId: (id: string) => void;
  onUpdateQuestion: (id: string, field: keyof AIQuestion, value: any) => void;
  onDeleteQuestion: (id: string) => void;
  onApproveQuestion: (id: string) => void;
  onAddQuestion: () => void;
  onSaveTest: () => void;
}

export default function MobileDraftEditor({
  questions,
  activeId,
  onSelectId,
  onUpdateQuestion,
  onDeleteQuestion,
  onApproveQuestion,
  onAddQuestion,
  onSaveTest
}: MobileDraftEditorProps) {
  const currentIndex = questions.findIndex(q => q.id === activeId);
  const activeIdx = currentIndex !== -1 ? currentIndex : 0;
  const rawQuestion = questions[activeIdx] || null;
  const currentQuestion = useMemo(() => {
    if (!rawQuestion) return null;
    const parsed = parseSquashedExplanation(rawQuestion);
    return {
      ...rawQuestion,
      explanation: parsed.explanation,
      stepwiseSolution: parsed.stepwiseSolution,
      examApproach: parsed.examApproach,
      ruleOrTheorem: parsed.ruleOrTheorem
    };
  }, [rawQuestion]);

  // Swipe gesture tracking state
  const touchStartRef = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Editing UI states
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>("");
  const [editExplanation, setEditExplanation] = useState<string>("");
  const [editExamApproach, setEditExamApproach] = useState<string>("");
  const [editRuleOrTheorem, setEditRuleOrTheorem] = useState<string>("");
  const [editTopic, setEditTopic] = useState<string>("");
  const [editPoints, setEditPoints] = useState<number>(1);
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectAnswers, setEditCorrectAnswers] = useState<string[]>([]);

  // Cancel edit mode and reset states if the active question changes from outside
  useEffect(() => {
    setIsEditing(false);
  }, [activeId]);

  // Start inline editing mode with deep copies
  const triggerEditMode = () => {
    if (!currentQuestion) return;
    setEditText(currentQuestion.text || "");
    setEditExplanation(currentQuestion.stepwiseSolution ? currentQuestion.stepwiseSolution.join("\n") : (currentQuestion.explanation || ""));
    setEditExamApproach(currentQuestion.examApproach || "");
    setEditRuleOrTheorem(currentQuestion.ruleOrTheorem || "");
    setEditTopic(currentQuestion.topic || "");
    setEditPoints(Number(currentQuestion.points) || 1);
    setEditOptions(currentQuestion.options ? [...currentQuestion.options] : []);
    setEditCorrectAnswers(currentQuestion.correctAnswers ? [...currentQuestion.correctAnswers] : []);
    setIsEditing(true);
  };

  // Save changes locally and elevate update state
  const handleSaveEdit = () => {
    if (!currentQuestion) return;
    onUpdateQuestion(currentQuestion.id, 'text', editText);
    onUpdateQuestion(currentQuestion.id, 'explanation', editExplanation);
    onUpdateQuestion(currentQuestion.id, 'stepwiseSolution', editExplanation.split("\n").filter(Boolean));
    onUpdateQuestion(currentQuestion.id, 'examApproach', editExamApproach);
    onUpdateQuestion(currentQuestion.id, 'ruleOrTheorem', editRuleOrTheorem);
    onUpdateQuestion(currentQuestion.id, 'topic', editTopic);
    onUpdateQuestion(currentQuestion.id, 'points', editPoints);
    onUpdateQuestion(currentQuestion.id, 'options', editOptions);
    onUpdateQuestion(currentQuestion.id, 'correctAnswers', editCorrectAnswers);
    onUpdateQuestion(currentQuestion.id, 'isEdited', true);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // Navigation commands
  const handleNext = () => {
    if (activeIdx < questions.length - 1) {
      onSelectId(questions[activeIdx + 1].id);
      setIsEditing(false);
    }
  };

  const handlePrev = () => {
    if (activeIdx > 0) {
      onSelectId(questions[activeIdx - 1].id);
      setIsEditing(false);
    }
  };

  // Touch handlers for mobile gesture controls
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isEditing) return; // Disable swiping when editing inline
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === null || isEditing) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartRef.current;
    
    // Dampen physical translation offset
    setSwipeOffset(diff);
    if (diff > 50) {
      setSwipeDirection('right');
    } else if (diff < -50) {
      setSwipeDirection('left');
    } else {
      setSwipeDirection(null);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current === null || isEditing) return;
    
    // Trigger transition if threshold reached
    if (swipeOffset > 80 && activeIdx > 0) {
      handlePrev();
    } else if (swipeOffset < -80 && activeIdx < questions.length - 1) {
      handleNext();
    }

    // Reset translation values
    touchStartRef.current = null;
    setSwipeOffset(0);
    setSwipeDirection(null);
  };

  // Option change helpers inside inline editor
  const handleOptionChange = (idx: number, text: string) => {
    const updated = [...editOptions];
    const oldVal = updated[idx];
    updated[idx] = text;
    setEditOptions(updated);

    // Sync Correct answers list
    if (editCorrectAnswers.includes(oldVal)) {
      setEditCorrectAnswers(editCorrectAnswers.map(ans => ans === oldVal ? text : ans));
    }
  };

  const toggleCorrectOption = (optText: string) => {
    if (editCorrectAnswers.includes(optText)) {
      setEditCorrectAnswers(editCorrectAnswers.filter(a => a !== optText));
    } else {
      if (currentQuestion?.type === 'MCQ') {
        setEditCorrectAnswers([optText]);
      } else {
        setEditCorrectAnswers([...editCorrectAnswers, optText]);
      }
    }
  };

  const handleAddOption = () => {
    const nextChar = String.fromCharCode(65 + editOptions.length);
    setEditOptions([...editOptions, `Option ${nextChar}`]);
  };

  const handleRemoveOption = (oIdx: number) => {
    const target = editOptions[oIdx];
    setEditOptions(editOptions.filter((_, idx) => idx !== oIdx));
    setEditCorrectAnswers(editCorrectAnswers.filter(ans => ans !== target));
  };

  return (
    <div className="w-full bg-slate-950 text-slate-100 flex flex-col pt-2 font-sans select-none overflow-x-hidden antialiased">
      {/* Title & Count Info Bar */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <span className="p-1 px-2.5 bg-indigo-650/30 text-indigo-400 text-[10px] font-black uppercase rounded-lg border border-indigo-505/20 tracking-wider">
            Mobile Review Mode
          </span>
          <span className="text-xs font-bold text-slate-400 font-mono">
            {activeIdx + 1} / {questions.length} Qs
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onSaveTest}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition"
          >
            <Save className="w-3 h-3" />
            <span>Save</span>
          </button>
          <button
            onClick={onAddQuestion}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition"
            id="mock-add-q-btn"
          >
            <Plus className="w-3 h-3" />
            <span>New Q</span>
          </button>
        </div>
      </div>

      {currentIndex === -1 || !currentQuestion ? (
        <div className="py-16 text-center text-slate-500 text-sm">
          No questions loaded. Build new draft or upload papers above.
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-4 gap-4 justify-between min-h-[500px]">
          
          {/* Main Swipeable Interactive Slate Container */}
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ transform: `translateX(${swipeOffset * 0.45}px)` }}
            className={`w-full bg-slate-900 border rounded-[28px] p-5 shadow-2xl relative transition-all duration-100 flex-1 flex flex-col justify-between ${
              swipeDirection === "left" ? "border-red-500/30" : 
              swipeDirection === "right" ? "border-green-500/30" : 
              currentQuestion.isApproved ? "border-green-500/40" : "border-slate-800"
            }`}
          >
            {/* Swipe feedback badge overlay */}
            {swipeDirection && (
              <span className={`absolute top-4 right-4 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                swipeDirection === 'left' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
              }`}>
                Swipe to {swipeDirection === 'left' ? 'Next' : 'Previous'}
              </span>
            )}

            <div className="flex flex-col h-full overflow-hidden">
              {/* Question metadata badge bar */}
              <div className="flex items-center justify-between gap-1 border-b border-slate-800 pb-2.5 shrink-0">
                <div className="flex items-center space-x-1.5 text-[10px] font-extrabold uppercase">
                  <span className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                    Q{activeIdx + 1}
                  </span>
                  <span className="text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-850">
                    {currentQuestion.type || "MCQ"}
                  </span>
                  {currentQuestion.topic && (
                    <span className="text-emerald-400 bg-slate-950/80 px-2.5 py-0.5 rounded border border-slate-850 truncate max-w-[120px]">
                      {currentQuestion.topic}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {currentQuestion.uncertaintyFlag && (
                    <span className="w-5 h-5 bg-amber-950 text-amber-400 border border-amber-900 rounded-full flex items-center justify-center" title="OCR Reading Uncertainty Alert">
                      <AlertTriangle className="w-3 h-3" />
                    </span>
                  )}
                  {currentQuestion.isEdited && (
                    <span className="text-[9px] bg-blue-950 text-blue-400 px-2 py-0.5 rounded-full font-black uppercase border border-blue-900/30">
                      Edited
                    </span>
                  )}
                  {currentQuestion.isApproved && (
                    <span className="text-[9px] bg-green-950 text-green-400 px-2 py-0.5 rounded-full font-black uppercase border border-green-900/30">
                      Approved
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 custom-scrollbar">
                {/* Card Main View / Edit Layout Switch */}
                {!isEditing ? (
                  /* Static view mode optimized for slide preview */
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-[15px] font-extrabold text-white leading-relaxed tracking-tight">
                        <MathRenderer content={currentQuestion.text || "(Empty Question Text)"} formula_latex={currentQuestion.formula_latex} />
                      </h3>
                    </div>

                    <MathDiagram 
                      metadata={currentQuestion.diagramMetadata} 
                      diagram_svg={currentQuestion.diagram_svg} 
                    />

                    {/* MCQ option preview items */}
                    {currentQuestion.options && currentQuestion.options.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">
                          Choice Options ({currentQuestion.options.length})
                        </span>
                        <div className="grid grid-cols-1 gap-1.5 pr-1">
                          {currentQuestion.options.map((opt, oIdx) => {
                            const isCorrect = currentQuestion.correctAnswers?.includes(opt) || 
                                              currentQuestion.correctAnswers?.includes(String.fromCharCode(65 + oIdx)) ||
                                              currentQuestion.correctAnswers?.includes(oIdx.toString());

                            return (
                              <div 
                                key={oIdx} 
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between font-medium ${
                                  isCorrect 
                                    ? "bg-emerald-950/45 border-emerald-800 text-emerald-300 font-bold" 
                                    : "bg-slate-950/60 border-slate-850/80 text-slate-350"
                                }`}
                              >
                                <div className="flex items-center min-w-0 pr-2">
                                  <span className="font-serif italic text-slate-500 mr-2 shrink-0">
                                    {String.fromCharCode(65 + oIdx)}.
                                  </span>
                                  <span className="truncate">
                                    {opt.trim() ? (
                                      <MathRenderer content={opt} />
                                    ) : (
                                      <span className="text-slate-500 italic">(Blank Option - Click Edit to write)</span>
                                    )}
                                  </span>
                                </div>
                                {isCorrect && (
                                  <span className="text-[9px] bg-emerald-500 text-white font-black px-1.5 py-0.5 rounded shrink-0">
                                    CORRECT
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Non-MCQ Correct Answer Block */}
                    {(!currentQuestion.options || currentQuestion.options.length === 0) && (
                      <div className="space-y-2 pt-2">
                        <span className="text-[9px] text-amber-500 uppercase font-black tracking-wider block">
                          Correct Answer (Non-MCQ / Short Answer)
                        </span>
                        <div className="p-3 bg-emerald-950/30 border border-emerald-900/30 rounded-2xl">
                          <div className="text-xs text-emerald-300 font-bold leading-relaxed">
                            {currentQuestion.correctAnswers && currentQuestion.correctAnswers.length > 0 ? (
                              <MathRenderer content={currentQuestion.correctAnswers.join(", ")} />
                            ) : (
                              <span className="text-red-400 italic">No answer specified. Click Edit to add the correct answer key.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Option completeness warning */}
                    {currentQuestion.options && currentQuestion.options.length > 0 && currentQuestion.options.some(opt => !opt.trim()) && (
                      <div className="p-2.5 bg-amber-950/20 border border-amber-900/30 rounded-xl flex items-start gap-2 text-[11px] text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-400 block mb-0.5">Incomplete MCQ Option Choices:</span>
                          One or more options are empty. Click <strong>Edit Question</strong> below to add complete options.
                        </div>
                      </div>
                    )}

                    {/* Stepwise Solution preview */}
                    {currentQuestion.stepwiseSolution && currentQuestion.stepwiseSolution.length > 0 && (
                      <div className="p-3 bg-indigo-950/30 border border-indigo-900/30 rounded-2xl space-y-2">
                        <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          <span>Step-by-Step Solution</span>
                        </span>
                        <div className="space-y-2">
                          {currentQuestion.stepwiseSolution.map((step, sIdx) => (
                            <div key={sIdx} className="text-xs text-indigo-200/90 leading-relaxed font-medium flex gap-2">
                              <span className="text-indigo-400 shrink-0 font-bold">{sIdx + 1}.</span>
                              <MathRenderer content={step} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Explanation box preview (Legacy) */}
                    {currentQuestion.explanation && !currentQuestion.stepwiseSolution && (
                      <div className="p-3 bg-indigo-950/30 border border-indigo-900/30 rounded-2xl space-y-1">
                        <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          <span>Interactive Solution Explanations</span>
                        </span>
                        <div className="text-xs text-indigo-200/90 leading-relaxed font-medium">
                          <MathRenderer content={currentQuestion.explanation} />
                        </div>
                      </div>
                    )}

                    {currentQuestion.examApproach && (
                      <div className="p-3 bg-emerald-950/30 border border-emerald-900/30 rounded-2xl space-y-1">
                        <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          <span>Exam Approach / Shortcut</span>
                        </span>
                        <div className="text-xs text-emerald-200/90 leading-relaxed font-medium">
                          <MathRenderer content={currentQuestion.examApproach} />
                        </div>
                      </div>
                    )}

                    {currentQuestion.ruleOrTheorem && (
                      <div className="p-3 bg-blue-950/30 border border-blue-900/30 rounded-2xl space-y-1">
                        <span className="text-[9px] text-blue-400 font-black uppercase tracking-wider flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          <span>Rule / Theorem / Trick</span>
                        </span>
                        <div className="text-xs text-blue-200/90 leading-relaxed font-medium">
                          <MathRenderer content={currentQuestion.ruleOrTheorem} />
                        </div>
                      </div>
                    )}

                    {currentQuestion.qualityReport && (
                      <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-2xl text-[11px] text-amber-200 leading-relaxed">
                        <span className="font-bold block text-amber-400 uppercase tracking-wide text-[9px] mb-0.5">Automated Diagnostics:</span>
                        {currentQuestion.qualityReport}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Interactive touch-focused editor form */
                  <div className="space-y-4 pr-1">
                    
                    {/* Inline Question textarea */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-black tracking-wider text-indigo-400 block">Edit Question Text</label>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-slate-950/90 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs font-semibold text-white outline-none resize-none h-20"
                      />
                    </div>

                    {/* Topic and point scores */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-slate-500">Topic Area</label>
                        <input
                          type="text"
                          value={editTopic}
                          onChange={(e) => setEditTopic(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-bold focus:border-indigo-500 outline-none text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-slate-500">Points Awarded</label>
                        <input
                          type="number"
                          min={1}
                          value={editPoints}
                          onChange={(e) => setEditPoints(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-bold focus:border-indigo-500 outline-none text-white"
                        />
                      </div>
                    </div>

                    {/* Options editor */}
                    {editOptions && editOptions.length > 0 && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase font-black tracking-wider text-indigo-400">Modify Option Choices</label>
                          <button
                            onClick={handleAddOption}
                            className="text-[10px] font-black uppercase text-indigo-300 tracking-wider hover:underline"
                          >
                            + Add Option
                          </button>
                        </div>

                        <div className="space-y-2">
                          {editOptions.map((opt, oIdx) => {
                            const label = String.fromCharCode(65 + oIdx);
                            const isCorrect = editCorrectAnswers.includes(opt) || editCorrectAnswers.includes(label);

                            return (
                              <div key={oIdx} className="flex items-center gap-2">
                                {/* 44px optimized touch target to toggle correctness status */}
                                <button
                                  onClick={() => toggleCorrectOption(opt)}
                                  className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 text-sm font-black transition relative active:scale-95 ${
                                    isCorrect ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-950 border-slate-800 text-slate-500"
                                  }`}
                                >
                                  {isCorrect ? "✓" : label}
                                </button>

                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => handleOptionChange(oIdx, e.target.value)}
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 h-11 text-xs text-white outline-none focus:border-indigo-500"
                                />

                                <button
                                  onClick={() => handleRemoveOption(oIdx)}
                                  className="w-11 h-11 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 flex items-center justify-center active:scale-95 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Solution Explanation editing */}
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-indigo-400 block">Explanatory Solution Notes</label>
                        <textarea
                          placeholder="Enter steps and explanation (one step per line)..."
                          value={editExplanation}
                          onChange={(e) => setEditExplanation(e.target.value)}
                          className="w-full bg-slate-950/90 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs font-semibold text-white outline-none min-h-[4rem]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-emerald-400 block">Exam Approach / Shortcut</label>
                        <textarea
                          placeholder="Enter shortcut or trick..."
                          value={editExamApproach}
                          onChange={(e) => setEditExamApproach(e.target.value)}
                          className="w-full bg-slate-950/90 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-xs font-semibold text-white outline-none min-h-[3rem]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-blue-400 block">Rule / Theorem</label>
                        <textarea
                          placeholder="Enter rule or theorem..."
                          value={editRuleOrTheorem}
                          onChange={(e) => setEditRuleOrTheorem(e.target.value)}
                          className="w-full bg-slate-950/90 border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-xs font-semibold text-white outline-none min-h-[3rem]"
                        />
                      </div>
                    </div>

                    {/* Save/Cancel controls */}
                    <div className="flex gap-2.5 pt-3">
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 font-extrabold text-[11px] uppercase rounded-xl transition cursor-pointer text-center"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] uppercase rounded-xl shadow-lg shadow-indigo-500/10 cursor-pointer text-center"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pagination Button Indicators */}
            <div className="flex items-center justify-between border-t border-slate-850 pt-3 mt-4 shrink-0">
              <button
                onClick={handlePrev}
                disabled={activeIdx === 0}
                className="p-2 border border-slate-800 hover:bg-slate-950 rounded-xl text-slate-400 disabled:opacity-20 active:scale-95 transition shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-1">
                {/* Horizontal slider swipe hint */}
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[9px] uppercase font-black tracking-widest text-slate-500">
                  Swipe card to navigate
                </span>
              </div>

              <button
                onClick={handleNext}
                disabled={activeIdx === questions.length - 1}
                className="p-2 border border-slate-800 hover:bg-slate-950 rounded-xl text-slate-400 disabled:opacity-20 active:scale-95 transition shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MAIN ACTIONS BAR (Approve, Edit, delete) OPTIMIZED FOR MOBILE TOUCH TARGETS (44px+) */}
          <div className="grid grid-cols-3 gap-2.5 px-1 pt-1 mb-2">
            
            {/* DELETE TRIGGER (44px Height & Width) */}
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this question card from mock draft?")) {
                  onDeleteQuestion(currentQuestion.id);
                }
              }}
              className="h-12 bg-red-950/80 border border-red-900 hover:bg-red-900 text-red-400 hover:text-white rounded-2xl flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider transition duration-150 active:scale-95 shadow"
              id="mobile-action-delete"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>

            {/* EDIT TRIGGER / SAVE (44px Height & Width) */}
            <button
              onClick={() => {
                if (isEditing) {
                  handleSaveEdit();
                } else {
                  triggerEditMode();
                }
              }}
              className={`h-12 border rounded-2xl flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider transition duration-150 active:scale-95 shadow ${
                isEditing 
                  ? "bg-indigo-600 border-indigo-500 text-white" 
                  : "bg-slate-900 border-slate-800 text-indigo-400 hover:bg-slate-850"
              }`}
              id="mobile-action-edit"
            >
              {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              <span>{isEditing ? "Save" : "Edit"}</span>
            </button>

            {/* APPROVE TRIGGER (44px Height & Width) */}
            <button
              onClick={() => onApproveQuestion(currentQuestion.id)}
              className={`h-12 border rounded-2xl flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider transition duration-150 active:scale-95 shadow ${
                currentQuestion.isApproved 
                  ? "bg-emerald-600 border-emerald-500 text-white" 
                  : "bg-slate-900 border-slate-800 text-emerald-400 hover:bg-slate-850"
              }`}
              id="mobile-action-approve"
            >
              <Check className="w-4 h-4" />
              <span>{currentQuestion.isApproved ? "Approved" : "Approve"}</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
