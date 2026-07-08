import React, { useState, useEffect } from "react";
import { 
  Pause, Play, Languages, Menu, Bookmark, Star, AlertTriangle, 
  Clock, X, CheckCircle2, ChevronRight, HelpCircle, Info, ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import MathRenderer from "../../components/MathRenderer";
import MathDiagram from "../../components/MathDiagram";
import { parseSquashedExplanation } from '../../utils/parseExplanation';

export interface PreviewQuestion {
  id: string;
  type?: string;
  text: string;
  options?: string[];
  correctAnswers?: string[];
  correctAnswer?: any;
  points?: number;
  topic?: string;
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

interface TestPreviewScreenProps {
  title: string;
  subject: string;
  duration: number; // in minutes
  questions: PreviewQuestion[];
  onClose: () => void;
}

const fallbackMockQuestions: PreviewQuestion[] = [
  {
    id: "fb-math-1",
    type: "MCQ",
    text: "Calculate the area of a circle with radius $r = 7$ cm. (Take $\\pi = \\frac{22}{7}$)",
    options: ["154 \\text{ cm}^2", "44 \\text{ cm}^2", "144 \\text{ cm}^2", "77 \\text{ cm}^2"],
    correctAnswers: ["154 \\text{ cm}^2"],
    points: 2,
    topic: "Mensuration",
    stepwiseSolution: [
      "Given: Radius $r = 7$ cm",
      "Formula: Area of circle $A = \\pi r^2$",
      "Substitution: $A = \\frac{22}{7} \\times 7 \\times 7$",
      "Calculation: $A = 22 \\times 7 = 154$",
      "Final Answer: $154 \\text{ cm}^2$"
    ],
    keyConcept: "Area of Circle"
  },
  {
    id: "fb-math-2",
    type: "MCQ",
    text: "Find the value of $x$ in the given right-angled triangle where the base is 3 cm and height is 4 cm.",
    options: ["5 \\text{ cm}", "7 \\text{ cm}", "12 \\text{ cm}", "25 \\text{ cm}"],
    correctAnswers: ["5 \\text{ cm}"],
    points: 2,
    topic: "Geometry",
    diagramMetadata: {
      needsDiagram: true,
      shape: "Triangle",
      labels: ["x", "4", "3"]
    },
    stepwiseSolution: [
      "By Pythagoras theorem: $h^2 = b^2 + p^2$",
      "$x^2 = 3^2 + 4^2$",
      "$x^2 = 9 + 16$",
      "$x^2 = 25$",
      "$x = \\sqrt{25} = 5$",
      "Final Answer: $5 \\text{ cm}$"
    ],
    keyConcept: "Pythagoras Theorem"
  },
  {
    id: "fb-1",
    type: "MCQ",
    text: "If 2 P 3 Q 1 = 7 and 3 P 4 Q 2 = 14, then 1 P 6 Q 2 = ?",
    options: ["11", "6", "7", "8"],
    correctAnswers: ["8"],
    points: 1,
    topic: "General Intelligence and Reasoning"
  },
  {
    id: "fb-2",
    type: "MCQ",
    text: "Select the correct option that completes the letter-cluster sequence: GPW, FOU, EMT, DKS, ?",
    options: ["CIQ", "CHQ", "CIP", "CHP"],
    correctAnswers: ["CHQ"],
    points: 1,
    topic: "Logical Reasoning"
  },
  {
    id: "fb-3",
    type: "MCQ",
    text: "A and B together can finish a piece of work in 12 days, while B alone can finish it in 30 days. In how many days can A alone finish the work?",
    options: ["15 days", "18 days", "20 days", "24 days"],
    correctAnswers: ["20 days"],
    points: 1,
    topic: "Quantitative Aptitude"
  },
  {
    id: "fb-4",
    type: "MCQ",
    text: "Select the correctly spelt word from the options provided below:",
    options: ["Maneuver", "Manouvre", "Manoeuvre", "Maneuvre"],
    correctAnswers: ["Manoeuvre"],
    points: 1,
    topic: "English Comprehension"
  },
  {
    id: "fb-5",
    type: "MCQ",
    text: "Who has been appointed as the first woman chairperson of the Securities and Exchange Board of India (SEBI)?",
    options: ["Madhabi Puri Buch", "Ranjana Prakash Desai", "Nupur Kulshrestha", "Alka Mittal"],
    correctAnswers: ["Madhabi Puri Buch"],
    points: 1,
    topic: "General Awareness"
  },
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `fb-gen-${i + 6}`,
    type: "MCQ",
    text: `Test your mastery on Section-A: Under current standards of operational procedure, evaluate the output function of sequence stage S_${i + 6} assuming the constant multiplier is set to ${i + 3}.`,
    options: [`Standard Value ${2 * i + 12}`, `Standard Value ${3 * i + 8}`, `Alternative Ratio ${i + 1}`, `Not determinable`],
    correctAnswers: [`Standard Value ${2 * i + 12}`],
    points: 1,
    topic: "Comprehensive Review"
  }))
];

export default function TestPreviewScreen({ 
  title, 
  subject, 
  duration, 
  questions, 
  onClose 
}: TestPreviewScreenProps) {
  const finalQuestions = React.useMemo(() => {
    const arr = questions.length > 0 ? questions : fallbackMockQuestions;
    return arr.map(q => {
      const parsed = parseSquashedExplanation(q);
      return {
        ...q,
        explanation: parsed.explanation,
        stepwiseSolution: parsed.stepwiseSolution,
        examApproach: parsed.examApproach,
        ruleOrTheorem: parsed.ruleOrTheorem
      };
    });
  }, [questions]);
  
  const examDurationInSecs = (duration || 45) * 60;

  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [timerLeft, setTimerLeft] = useState(examDurationInSecs);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [questionElapsedSeconds, setQuestionElapsedSeconds] = useState<Record<string, number>>({});
  const [showDrawer, setShowDrawer] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'symbols' | 'instructions' | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);

  // Main Timer ticker
  useEffect(() => {
    let interval: any;
    if (!isTimerPaused && !examSubmitted) {
      interval = setInterval(() => {
        setTimerLeft(prev => (prev > 0 ? prev - 1 : 0));
        
        // Track elapsed seconds for current active question
        const currentQ = finalQuestions[activeIdx];
        if (currentQ) {
          setQuestionElapsedSeconds(prev => ({
            ...prev,
            [currentQ.id]: (prev[currentQ.id] || 0) + 1
          }));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerPaused, activeIdx, finalQuestions, examSubmitted]);

  // Restart verification process
  const handleRestart = () => {
    setAnswers({});
    setMarkedForReview({});
    setQuestionElapsedSeconds({});
    setTimerLeft(examDurationInSecs);
    setIsTimerPaused(false);
    setActiveIdx(0);
    setShowDrawer(false);
    setActiveDrawerTab(null);
    setShowSubmitModal(false);
    setExamSubmitted(false);
  };

  const currentQuestion = finalQuestions[activeIdx];
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = finalQuestions.length - answeredCount;

  // Formatting helpers
  const formatHHMMSS = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatMMSS = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full w-full bg-slate-900 text-slate-100 flex flex-col md:py-8 md:px-4 select-none relative font-sans overflow-y-auto antialiased">
      {/* Verification Master Controller Belt (Hidden on mobile) */}
      <div className="hidden md:flex w-full max-w-md mx-auto mb-1 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white rounded-2xl p-2 md:p-5 shadow-xl flex-col gap-1 md:gap-3 shrink-0 text-left border border-indigo-505/30">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 font-black text-[9px] md:text-xs uppercase tracking-widest bg-indigo-950/45 px-2 py-0.5 md:px-3 md:py-1.5 rounded-full ring-1 ring-white/10 text-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
            <span>Live Preview</span>
          </span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-2 py-0.5 md:px-4 md:py-1.5 bg-neutral-950/80 hover:bg-neutral-950 text-white hover:text-indigo-200 border border-neutral-800 rounded-lg md:rounded-xl text-[9px] md:text-[11px] font-black uppercase tracking-wider transition-all duration-150 shadow-md"
            id="close-preview-top"
          >
            Exit
          </button>
        </div>
        <div className="hidden md:block">
          <h2 className="text-sm font-bold text-white leading-tight">Student View Mode For Mentors</h2>
          <p className="text-[11px] text-indigo-150 font-normal leading-relaxed text-zinc-350 opacity-90 mt-1">
            Carefully verify formatting constraints, math equations, option indices, and responsive margins. Click options, scroll, toggle instructions, or submit to view diagnostic results. 
          </p>
        </div>
      </div>

      {/* Styled Smartphone Viewport Mock Frame */}
      <div className="w-full flex-1 min-h-0 bg-slate-50 md:max-w-md md:aspect-[9/19] md:rounded-[42px] md:border-[12px] md:border-neutral-950 md:shadow-2xl md:ring-12 md:ring-neutral-900/10 flex flex-col relative text-left shadow-2xl">
        
        {/* TOP STATUS BAR HEADER (Black Background, high fidelity mockup) */}
        <header className="bg-neutral-950 text-white h-15 px-4 flex items-center justify-between shrink-0 select-none border-b border-neutral-850">
          <div className="flex items-center space-x-3.5 min-w-0">
            {/* Play/Pause Button */}
            <button 
              onClick={() => {
                setIsTimerPaused(!isTimerPaused);
                alert(isTimerPaused ? "Verification exam resumed" : "Verification exam timer paused");
              }}
              className="w-8 h-8 rounded-full border border-neutral-800 hover:bg-neutral-900 flex items-center justify-center text-white active:scale-95 transition shrink-0"
              title={isTimerPaused ? "Resume Exam" : "Pause Exam"}
              id="pause-exam-btn"
            >
              {isTimerPaused ? (
                <Play className="w-3.5 h-3.5 fill-white text-emerald-400" />
              ) : (
                <Pause className="w-3.5 h-3.5 fill-white" />
              )}
            </button>
            
            {/* Timer & Meta details */}
            <div className="flex flex-col text-left min-w-0">
              <span className={`text-base font-extrabold tracking-tight font-mono leading-none ${isTimerPaused ? "text-amber-505 text-amber-500 animate-pulse" : "text-white"}`}>
                {formatHHMMSS(timerLeft)}
              </span>
              <span className="text-[10px] font-medium text-neutral-400 truncate mt-0.5 max-w-[195px]">
                {subject || "General Intelligence and Reasoning"}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Exit Button (Mobile only) */}
            <button
              onClick={() => onClose()}
              className="md:hidden px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-[10px] font-bold uppercase"
              id="exit-mobile-btn"
            >
              Exit
            </button>
            {/* Language layout selector "E/अ" */}
            <button 
              onClick={() => alert("Defaulting to bilingual English template layout.")}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-xs font-semibold text-neutral-205 active:scale-95 transition duration-100"
              id="language-switcher"
            >
              <Languages className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-[10px] uppercase font-black tracking-wider text-neutral-200">E/अ</span>
            </button>

            {/* Sidebar toggle menu */}
            <button 
              onClick={() => setShowDrawer(true)}
              className="p-1.5 rounded-xl text-neutral-205 hover:bg-neutral-900 active:scale-95 transition-all duration-100"
              title="Open Navigation Palette"
              id="drawer-toggle-btn"
            >
              <Menu className="w-6 h-6 text-neutral-200" />
            </button>
          </div>
        </header>

        {/* METRICS CONTROL BAR (White Background, from mockup) */}
        <div className="h-11 border-b border-gray-100 bg-white px-4 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-neutral-700">
            <span>Total Questions Answered:</span>
            <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full text-[11px] font-black font-mono">
              {answeredCount}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="bg-rose-50 text-rose-600 border border-rose-100 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping block"></span>
              Last 15 Mins
            </span>
          </div>
        </div>

        {/* CONTENT WORKSPACE VIEWPORT */}
        <div className="flex-1 overflow-y-auto bg-white p-4 flex flex-col text-left">
          {examSubmitted ? (
            /* Verification Submission Diagnostics Outboard Card */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-6 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-xl">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">Answers Validated</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  The compiled candidate test payload matches student engine rules. Standard and review states are processed below.
                </p>
              </div>

              {/* Stats Box */}
              <div className="w-full bg-slate-50/80 border border-slate-100 rounded-3xl p-5 divide-y divide-slate-200 space-y-3.5 text-xs text-slate-705">
                <div className="flex justify-between font-medium pt-1">
                  <span className="text-slate-500">Test Title</span>
                  <span className="font-extrabold text-slate-900 truncate max-w-[200px]">{title || "Dynamic Draft Exam"}</span>
                </div>
                <div className="flex justify-between py-2 pt-3.5">
                  <span className="text-emerald-650 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                    Answered Correctly/Saved
                  </span>
                  <span className="font-black text-emerald-700 text-sm font-mono">{answeredCount}</span>
                </div>
                <div className="flex justify-between py-2 pt-3.5">
                  <span className="text-amber-650 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span>
                    Marked for Review
                  </span>
                  <span className="font-black text-amber-600 text-sm font-mono">
                    {Object.values(markedForReview).filter(Boolean).length}
                  </span>
                </div>
                <div className="flex justify-between py-2 pt-3.5">
                  <span className="text-blue-650 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 block"></span>
                    Unanswered Left
                  </span>
                  <span className="font-black text-blue-700 text-sm font-mono">{unansweredCount}</span>
                </div>
                <div className="flex justify-between pt-3.5 font-medium">
                  <span className="text-slate-500">Subject Stream</span>
                  <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">{subject}</span>
                </div>
              </div>

              <div className="flex gap-3 w-full pt-1">
                <button
                  onClick={handleRestart}
                  className="flex-1 py-3.5 bg-slate-150 hover:bg-slate-200 text-slate-700 bg-slate-100 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition duration-150 active:scale-95 text-center"
                  id="restart-sim-btn"
                >
                  Reset Exam
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition duration-150 active:scale-95 text-center shadow-lg shadow-blue-500/20"
                  id="return-workspace-btn"
                >
                  Return to Edit
                </button>
              </div>
            </div>
          ) : currentQuestion ? (
            /* Student Exam interactive workspace body */
            <div className="flex-1 flex flex-col justify-between h-full">
              
              <div className="space-y-5">
                {/* Active index banner and elapsed metadata timer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* Blue box showing exact current active question index */}
                    <span className="w-7 h-7 bg-blue-600 text-white font-black text-sm rounded-md flex items-center justify-center shadow shadow-blue-600/20">
                      {activeIdx + 1}
                    </span>

                    {/* Question timer reading */}
                    <span className="flex items-center space-x-1 text-slate-400 text-xs font-bold font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatMMSS(questionElapsedSeconds[currentQuestion.id] || 0)}</span>
                    </span>
                  </div>

                  {/* Actions column group from mockup header right */}
                  <div className="flex items-center space-x-3.5 text-slate-400">
                    <button 
                      onClick={() => alert(`Warning Flag: Feedback reporting generated for active template ID: ${currentQuestion.id}`)}
                      className="hover:text-amber-500 hover:scale-110 active:scale-90 transition"
                      title="Report / Flag Question"
                      id="report-flag-btn"
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                    
                    <button 
                      onClick={() => setMarkedForReview(prev => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }))}
                      className={`${markedForReview[currentQuestion.id] ? "text-amber-500 fill-amber-500 scale-110" : "hover:text-blue-600 hover:scale-110"} active:scale-95 transition-all duration-150`}
                      title="Mark for review / Bookmark"
                      id="bookmark-btn"
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>

                    <button 
                      onClick={() => alert("Marked as important/favorite for validation.")}
                      className="hover:text-yellow-500 hover:scale-110 active:scale-90 transition"
                      title="Favorite question"
                      id="favorite-btn"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Question Rich Text */}
                <div className="pt-2">
                  <div className="text-[17px] font-extrabold text-slate-900 leading-snug tracking-tight">
                    <MathRenderer content={currentQuestion.text} formula_latex={currentQuestion.formula_latex} />
                  </div>

                  <MathDiagram 
                    metadata={currentQuestion.diagramMetadata} 
                    diagram_svg={currentQuestion.diagram_svg} 
                  />

                  {currentQuestion.topic && (
                    <span className="inline-block mt-2 px-2.5 py-0.5 bg-slate-105 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md uppercase tracking-wider">
                      Topic: {currentQuestion.topic}
                    </span>
                  )}
                </div>

                {/* Option radios presenting exquisite labeled index prefixes */}
                {currentQuestion.options && currentQuestion.options.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    {currentQuestion.options.map((option, oIdx) => {
                      const prefixLabel = `${oIdx + 1}.`;
                      const isOptionSelected = answers[currentQuestion.id] === option;

                      return (
                        <button
                          key={oIdx}
                          onClick={() => {
                            setAnswers(prev => ({ ...prev, [currentQuestion.id]: option }));
                          }}
                          className={`w-full text-left py-4 px-5 rounded-2xl border text-base flex items-center justify-between transition-all duration-150 active:scale-[0.99] cursor-pointer shadow-sm ${
                            isOptionSelected 
                              ? "ring-2 ring-blue-600 bg-blue-50/40 border-blue-600 font-bold" 
                              : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                          }`}
                          id={`option-${activeIdx}-${oIdx}`}
                        >
                          <div className="flex items-center min-w-0 pr-1">
                            {/* Italicized Gray Index label "1.", "2." from Mockup */}
                            <span className="font-serif italic text-base text-slate-400 mr-3.5 shrink-0 select-none">
                              {prefixLabel}
                            </span>
                            <span className="text-[15px] font-bold text-slate-800 leading-tight">
                              <MathRenderer content={option} />
                            </span>
                          </div>
                          
                          {isOptionSelected && (
                            <span className="w-5.5 h-5.5 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-extrabold shadow-sm">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 px-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 italic">
                    This is a non-MCQ numerical or open standard template. Enter candidate input values inside live tests.
                  </div>
                )}
              </div>

              {/* Save, Next and Mark Action trigger belt */}
              <div className="pt-6 mt-auto pb-2 flex items-center justify-between gap-3 shrink-0">
                <button
                  onClick={() => {
                    if (activeIdx > 0) {
                      setActiveIdx(prev => prev - 1);
                    }
                  }}
                  className="flex-1 py-3.5 border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-widest rounded-2xl text-center active:scale-95 transition"
                  id="previous-btn"
                >
                  PREVIOUS
                </button>
                <button
                  onClick={() => {
                    if (activeIdx < finalQuestions.length - 1) {
                      setActiveIdx(prev => prev + 1);
                    }
                  }}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl text-center shadow-lg shadow-blue-500/20 active:scale-95 transition"
                  id="next-btn"
                >
                  NEXT
                </button>
              </div>

            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 text-sm font-semibold">
              No questions found inside mock configuration.
            </div>
          )}
        </div>

        {/* SIDEBAR NAVIGATION DRAWERS AND STATUS SHEET */}
        <AnimatePresence>
          {showDrawer && (
            <>
              {/* Sliding backdrop lock */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDrawer(false)}
                className="absolute inset-0 bg-neutral-950 z-40 cursor-pointer"
                id="drawer-backdrop"
              />

              {/* Side Drawer Body overlaying right viewport */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 220 }}
                className="absolute right-0 top-0 bottom-0 w-[84%] max-w-[340px] bg-white z-50 flex flex-col shadow-2xl p-4 select-none border-l border-zinc-150"
                id="drawer-sheet"
              >
                <div className="flex items-center justify-between border-b pb-3 border-gray-100">
                  {/* Switch Tab categories (Symbols vs Instructions matching Screenshot 1) */}
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => setActiveDrawerTab(activeDrawerTab === 'symbols' ? null : 'symbols')}
                      className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center space-x-1 transition duration-100 ${
                        activeDrawerTab === "symbols" ? "bg-blue-100 text-blue-700" : "bg-slate-100 hover:bg-slate-200 text-slate-650 text-slate-600"
                      }`}
                      id="tab-symbols-btn"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Symbols</span>
                    </button>
                    <button 
                      onClick={() => setActiveDrawerTab(activeDrawerTab === 'instructions' ? null : 'instructions')}
                      className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center space-x-1 transition duration-100 ${
                        activeDrawerTab === "instructions" ? "bg-blue-100 text-blue-700" : "bg-slate-100 hover:bg-slate-200 text-slate-650 text-slate-600"
                      }`}
                      id="tab-instructions-btn"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Instructions</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => setShowDrawer(false)}
                    className="p-1 px-2 text-slate-400 hover:bg-slate-100 rounded-lg text-sm text-center font-bold"
                  >
                    <X className="w-5 h-5 inline" />
                  </button>
                </div>

                {/* Conditional dropdown content based on Tab */}
                {activeDrawerTab && (
                  <motion.div 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="my-2.5 p-3.5 bg-blue-50 border border-blue-105 border-blue-100 rounded-2xl text-[11px] text-blue-805 leading-relaxed text-left text-blue-800"
                  >
                    <h4 className="font-extrabold text-blue-900 uppercase tracking-widest text-[9px] mb-1">
                      {activeDrawerTab === "symbols" ? "Math & Reasoning Key" : "Candidate Code of Conduct"}
                    </h4>
                    {activeDrawerTab === "symbols" ? (
                      <div className="space-y-1 font-mono text-[10px]">
                        <p>• <strong>P</strong> : Sum operator (+)</p>
                        <p>• <strong>Q</strong> : Product operator (×)</p>
                        <p>• <strong>Δ</strong> : Linear coefficient change</p>
                        <p>• <strong>Σ</strong> : Series additive sum step</p>
                      </div>
                    ) : (
                      <div className="space-y-1 text-[10px]">
                        <p>1. Keep eyes focused on screen margins.</p>
                        <p>2. Do not log out or clear transient cache.</p>
                        <p>3. Flags with review state will render bright amber.</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Subheader and Test Category Title from Screenshot */}
                <div className="pt-4 text-left">
                  <span className="inline-block bg-blue-600 text-white font-extrabold text-[10px] px-3 py-1 rounded-md tracking-wider mb-2">
                    PART - A
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">
                    Test
                  </h2>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-4 truncate">
                    {subject || "Draft Assessment Series"}
                  </p>
                </div>

                {/* Color and count Breakdown Stats box (from Screenshot 1) */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 mb-5 shrink-0 text-left">
                  <div className="flex items-center justify-between p-3.5 bg-neutral-50/50">
                    <span className="flex items-center space-x-2 text-[13px] font-bold text-slate-705 text-slate-750">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 block"></span>
                      <span>Answered Qs</span>
                    </span>
                    <span className="text-[14px] font-black text-slate-900 font-mono">
                      {answeredCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-neutral-50/50">
                    <span className="flex items-center space-x-2 text-[13px] font-bold text-slate-705 text-slate-750">
                      <span className="w-3.5 h-3.5 rounded-full bg-blue-600 block"></span>
                      <span>Unanswered Qs</span>
                    </span>
                    <span className="text-[14px] font-black text-slate-900 font-mono">
                      {unansweredCount}
                    </span>
                  </div>
                </div>

                {/* Custom-colored Grid Navigation layout matching exact screenshots specs */}
                <div className="flex-1 overflow-y-auto pr-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 leading-none">
                    Selection Grid ({finalQuestions.length} Questions)
                  </span>
                  
                  <div className="grid grid-cols-5 gap-2 pb-6">
                    {finalQuestions.map((q, idx) => {
                      const isAnswered = !!answers[q.id];
                      const isMarked = markedForReview[q.id];
                      const isActive = activeIdx === idx;

                      // SPECIFIED COLOR SCHEME IN SCREENSHOT 1:
                      // Active -> White bg, blue border, blue text
                      // Marked for Review -> Solid Orange bg, white text
                      // Answered -> Solid Green bg, white text
                      // Unanswered -> Solid Blue bg, white text
                      return (
                        <button
                          key={`${q.id || 'preview'}-${idx}`}
                          onClick={() => {
                            setActiveIdx(idx);
                            setShowDrawer(false);
                          }}
                          className={`aspect-square rounded-2xl text-sm font-extrabold flex items-center justify-center transition active:scale-90 duration-100 shadow-sm ${
                            isActive 
                              ? "bg-white border-3 border-blue-600 text-blue-600 ring-2 ring-blue-500/10 scale-105 font-black z-10"
                              : isMarked 
                                ? "bg-amber-500 text-white font-extrabold"
                                : isAnswered 
                                  ? "bg-emerald-500 text-white font-extrabold" 
                                  : "bg-blue-600 text-white font-extrabold"
                          }`}
                          id={`nav-grid-${idx}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit test drawer button (REMOVED) */}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* SUBMISSION VERIFY DIALOG MODAL OVERLAY (REMOVED) */}

      </div>
    </div>
  );
}
