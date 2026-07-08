import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import { TestService } from '../../services/test';
import { safeDate } from '../../utils/date';
import { Test, TestAttempt, Question, Answer } from '../../models/mission';
import { Clock, Play, FileText, Award, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle, Menu, X, Eye, Bookmark, WifiOff, Maximize } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { sanitizeQuestionObject } from '../../utils/questionSanitizer';
import MathDiagram from '../../components/MathDiagram';
import MathRenderer from '../../components/MathRenderer';
import { MockTestTimer } from '../../components/MockTestTimer';
import { db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

interface Props {
  testId: string;
  onExit: (attemptId?: string) => void;
  forceNewAttempt?: boolean;
}

// Memoized Question Card for extreme smoothness
const QuestionCard = React.memo(({ 
  question, 
  answer, 
  onAnswerChange, 
  markedForReview, 
  onToggleMark 
}: { 
  question: Question; 
  answer: any; 
  onAnswerChange: (qId: string, val: any) => void;
  markedForReview: boolean;
  onToggleMark: (qId: string) => void;
}) => {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
          {question.subject || 'General'}
        </span>
        <button 
          onClick={() => onToggleMark(question.id)}
          className={`p-2 rounded-xl transition-colors ${markedForReview ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
        >
          <Bookmark size={20} fill={markedForReview ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="prose prose-slate max-w-none mb-8">
        <div className="text-lg font-bold text-slate-900 leading-relaxed">
           <MathRenderer content={question.text} />
        </div>
        {question.diagramMetadata && (
          <div className="mt-6 flex justify-center bg-slate-50 rounded-2xl p-4">
            <MathDiagram metadata={question.diagramMetadata} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {question.options.map((opt, i) => {
          const isSelected = Array.isArray(answer?.value) 
            ? answer.value.includes(opt) 
            : answer?.value === opt;
          
          return (
            <button
              key={i}
              onClick={() => {
                if (question.type === 'MCQ' || question.type === 'Boolean' || question.type === 'Integer') {
                  onAnswerChange(question.id, opt);
                } else {
                  const current = Array.isArray(answer?.value) ? answer.value : [];
                  const next = current.includes(opt) 
                    ? current.filter((v: string) => v !== opt) 
                    : [...current, opt];
                  onAnswerChange(question.id, next);
                }
              }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                isSelected 
                  ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50' 
                  : 'border-slate-100 hover:border-slate-200 bg-white'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-transparent'
              }`}>
                {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
              </div>
              <span className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                <MathRenderer content={opt} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default function AttemptTestView({ testId, onExit, forceNewAttempt }: Props) {
  const { currentUser, userProfile } = useAuth();
  const studentId = userProfile?.id || currentUser?.uid;
  const [searchParams] = useSearchParams();
  const isPractice = searchParams.get('isPractice') === 'true';
  const practiceType = searchParams.get('practiceType') || 'all';
  const parentAttemptId = searchParams.get('parentAttemptId') || '';
  const [practiceQuestionIds, setPracticeQuestionIds] = useState<string[]>([]);

  const localStorageKey = useMemo(() => {
    return isPractice 
      ? `test_attempt_${testId}_${studentId}_practice` 
      : `test_attempt_${testId}_${studentId}`;
  }, [isPractice, testId, studentId]);

  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bypassedFullscreen, setBypassedFullscreen] = useState(false);
  const [sectionElapsed, setSectionElapsed] = useState<Record<string, number>>({});

  // Fullscreen Management
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const enterFullscreen = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        setBypassedFullscreen(true);
        return;
      }
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          const fsPromise = document.documentElement.requestFullscreen();
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Fullscreen timeout")), 1500));
          await Promise.race([fsPromise, timeoutPromise]);
        } else {
          setBypassedFullscreen(true);
        }
      }
    } catch (err) {
      console.warn('Error entering fullscreen:', err);
      setBypassedFullscreen(true);
    }
  };
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Mark for review state (local sync with attempt)
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [visitedQuestions, setVisitedQuestions] = useState<string[]>([]);
  
  const q = useMemo(() => test?.questions[currentIdx], [test, currentIdx]);
  const ans = useMemo(() => attempt && q ? attempt.answers[q.id]?.value : undefined, [attempt, q?.id]);

  // Refs to maintain absolute latest values inside debounced closures
  const markedForReviewRef = useRef<string[]>([]);
  markedForReviewRef.current = markedForReview;
  const visitedQuestionsRef = useRef<string[]>([]);
  visitedQuestionsRef.current = visitedQuestions;
  const attemptRef = useRef<any>(null);
  attemptRef.current = attempt;
  const isSubmittingRef = useRef<boolean>(false);
  isSubmittingRef.current = isSubmitting;
  const currentIdxRef = useRef<number>(0);
  currentIdxRef.current = currentIdx;

  // Sync state
  const saveTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string>(Math.random().toString(36).substring(2, 15));
  const heartbeatIntRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadTestAndAttempt();
    }
    
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [testId, forceNewAttempt, currentUser]);

  useEffect(() => {
    if (attempt?.id && started) {
      // Periodic heartbeat
      heartbeatIntRef.current = setInterval(() => {
        TestService.refreshHeartbeat(attempt.id, sessionTokenRef.current);
      }, 30000);

      // Visibility change & Unload listeners for critical save
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // We attempt a sync save
        if (attempt?.status === 'in_progress') {
          TestService.updateAttemptProgress(attempt.id, {
            lastQuestionIdx: currentIdx,
            visitedQuestions,
            markedForReview
          });
        }
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden' && attempt?.status === 'in_progress') {
          TestService.updateAttemptProgress(attempt.id, {
            lastQuestionIdx: currentIdx,
            visitedQuestions,
            markedForReview
          });
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (heartbeatIntRef.current) clearInterval(heartbeatIntRef.current);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [attempt?.id, started, currentIdx, visitedQuestions, markedForReview]);

  // Track question visitation and progress
  useEffect(() => {
    if (!test || !started || !attempt) return;
    const qId = test.questions[currentIdx].id;
    if (!visitedQuestions.includes(qId)) {
      setVisitedQuestions(prev => [...prev, qId]);
    }

    // Update progress on Firestore
    const timeout = setTimeout(() => {
      const currentVisited = visitedQuestionsRef.current;
      TestService.updateAttemptProgress(attempt.id, {
        lastQuestionIdx: currentIdx,
        visitedQuestions: currentVisited.includes(qId) ? currentVisited : [...currentVisited, qId]
      });
    }, 2000);

    return () => clearTimeout(timeout);
  }, [currentIdx, started]);

  const loadTestAndAttempt = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      const resp = await TestService.getTest(testId);
      const t = sanitizeQuestionObject(resp);

      // Premium Validation Guard
      if (t.testType === 'premium' && !isPractice && !userProfile?.isPremium && userProfile?.role === "student") {
        toast.error("Premium Access Required: This test is restricted to premium students.");
        onExit();
        return;
      }

      // Security check: Validate that student belongs to one of the assigned batches of this test (unless shared to community or is public)
      if (userProfile?.role === "student" && !t.isPractice && !t.shareToCommunity && !t.isPublic) {
        const studentBatchId = userProfile.batchId || "";
        const isAssigned = (t.batchIds && t.batchIds.includes(studentBatchId)) || (t.batchId === studentBatchId);
        if (!isAssigned) {
          toast.error("Security Alert: This test is not assigned to your batch.");
          onExit();
          return;
        }
      }

      // Sort questions to match section order if Full Mock Test
      if (t.isFullMockTest && t.sections && t.sections.length > 0) {
        const secOrder = t.sections.map((s: any) => s.id);
        t.questions = [...(t.questions || [])].sort((a, b) => {
          const aIdx = secOrder.indexOf(a.sectionId || '');
          const bIdx = secOrder.indexOf(b.sectionId || '');
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      }

      if (isPractice && parentAttemptId) {
        try {
          const docRef = doc(db, 'test_attempts', parentAttemptId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const parentAttempt = snap.data() as TestAttempt;
            const filteredQs = t.questions.filter(q => {
              const ans = parentAttempt.answers?.[q.id];
              const isSkipped = !ans || ans.value === undefined || ans.value === "" || (Array.isArray(ans.value) && ans.value.length === 0);
              
              if (practiceType === 'incorrect') {
                if (isSkipped) return false;
                if (ans.marksAwarded !== undefined) {
                  return ans.marksAwarded <= 0;
                }
                if (ans.isCorrect === false) return true;
                if (ans.isCorrect === true) return false;
                let isCorrect = false;
                if (q.type === 'MCQ' || q.type === 'MSQ') {
                  if (Array.isArray(ans.value)) {
                    isCorrect = !!q.correctAnswers && q.correctAnswers.length === ans.value.length && q.correctAnswers.every(v => (ans.value as string[]).includes(v));
                  } else if (q.correctAnswers && q.correctAnswers.length > 0) {
                    isCorrect = String(ans.value) === String(q.correctAnswers[0]);
                  }
                } else if (q.type === 'Integer') {
                  isCorrect = !!q.correctAnswers && String(ans.value) === String(q.correctAnswers[0]);
                }
                return !isCorrect;
              } else if (practiceType === 'incorrect_unattempted') {
                if (isSkipped) return true;
                if (ans.marksAwarded !== undefined) {
                  return ans.marksAwarded <= 0;
                }
                if (ans.isCorrect === false) return true;
                if (ans.isCorrect === true) return false;
                let isCorrect = false;
                if (q.type === 'MCQ' || q.type === 'MSQ') {
                  if (Array.isArray(ans.value)) {
                    isCorrect = !!q.correctAnswers && q.correctAnswers.length === ans.value.length && q.correctAnswers.every(v => (ans.value as string[]).includes(v));
                  } else if (q.correctAnswers && q.correctAnswers.length > 0) {
                    isCorrect = String(ans.value) === String(q.correctAnswers[0]);
                  }
                } else if (q.type === 'Integer') {
                  isCorrect = !!q.correctAnswers && String(ans.value) === String(q.correctAnswers[0]);
                }
                return !isCorrect;
              }
              return true; // For 'all'
            });

            if (filteredQs.length === 0) {
              toast.error("There are no questions matching this criteria to practice.");
              onExit();
              return;
            }

            t.questions = filteredQs;
            setPracticeQuestionIds(filteredQs.map(q => q.id));
            t.duration = Math.max(5, Math.ceil(filteredQs.length * 1.5));
            t.maximumMarks = filteredQs.reduce((acc, q) => acc + (q.points || 2), 0);
            t.title = `Practice: ${t.title} (${practiceType === 'incorrect' ? 'Incorrect' : practiceType === 'incorrect_unattempted' ? 'Revision' : 'Entire'}_Practice)`;
          }
        } catch (e) {
          console.error("Error loading parent attempt:", e);
        }
      }

      setTest(t);
      
      let finalAttempt: TestAttempt | undefined;
      
      if (!forceNewAttempt) {
        const atts = await TestService.getAttemptsForTestAndStudent(testId, studentId);
        const inProgress = atts.find(a => 
          (a.status === 'in_progress' || a.status === 'started') &&
          (isPractice ? a.isPracticeAttempt === true : !a.isPracticeAttempt)
        );
        const finished = atts.find(a => 
          (a.status === 'submitted' || a.status === 'evaluated') &&
          (isPractice ? a.isPracticeAttempt === true : !a.isPracticeAttempt)
        );
        
        if (inProgress) {
          finalAttempt = inProgress;
        } else if (finished && t.status === 'live' && !isPractice) {
          // If it's a live test and they have ANY finished attempt, we must stop them
          toast.error("Only one attempt is permissible for live tests.");
          onExit();
          return;
        } else if (finished && t.status !== 'live') {
          // Optional: for non-live tests, maybe they can retake, but we should probably warn or show history
          // For now, we allow retake unless the user says otherwise, but we should at least have found 'finished'
        }
      }
      
      // Check localStorage for a potentially newer or offline cached version
      if (studentId && !forceNewAttempt) {
        const cached = localStorage.getItem(localStorageKey);
        if (cached) {
            const cachedAtt = JSON.parse(cached);
            if (!finalAttempt || new Date(cachedAtt.updatedAt).getTime() > new Date(finalAttempt.updatedAt || 0).getTime()) {
                finalAttempt = cachedAtt;
            }
        }
      }

      if (finalAttempt) {
        setAttempt(finalAttempt);
        setMarkedForReview(finalAttempt.markedForReview || []);
        setVisitedQuestions(finalAttempt.visitedQuestions || []);
        if (finalAttempt.sectionElapsed) setSectionElapsed(finalAttempt.sectionElapsed);
        if (finalAttempt.lastQuestionIdx !== undefined) setCurrentIdx(finalAttempt.lastQuestionIdx);

        if (finalAttempt.status === 'in_progress' || finalAttempt.status === 'started') {
          // Check session token for multi-tab
          if (finalAttempt.activeSessionToken && finalAttempt.activeSessionToken !== sessionTokenRef.current) {
             // Optional: warn or takeover
             // For now we takeover
             TestService.refreshHeartbeat(finalAttempt.id, sessionTokenRef.current);
          }

          // calculate remaining time
          const elapsed = Math.floor((Date.now() - safeDate(finalAttempt.startedAt).getTime()) / 1000);
          const rem = (t.duration * 60) - elapsed;
          if (rem <= 0) {
            // Auto submit immediately
            await autoSubmit(finalAttempt.id, t.duration * 60);
          } else {
            setTimeRemaining(rem);
            setStarted(true);
          }
        } else if (t.status === 'live') {
           // Live test, finished attempt - forbid entry
           toast.error("Only one attempt is permissible for live tests.");
           onExit();
           return;
        }
      } else {
        setTimeRemaining(t.duration * 60);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load test data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Section index and helpers
  const activeSection = useMemo(() => {
    if (!test || !test.sections || test.sections.length === 0) return null;
    const currentQ = test.questions[currentIdx];
    return test.sections.find((s: any) => s.id === currentQ?.sectionId) || test.sections[0];
  }, [test, currentIdx]);

  const activeSectionIdx = useMemo(() => {
    if (!test || !test.sections || !activeSection) return -1;
    return test.sections.findIndex((s: any) => s.id === activeSection.id);
  }, [test, activeSection]);

  const isSectionPrevious = useCallback((secId: string) => {
    if (!test || !test.sections || activeSectionIdx === -1) return false;
    const targetIdx = test.sections.findIndex((s: any) => s.id === secId);
    return targetIdx < activeSectionIdx;
  }, [test, activeSectionIdx]);

  const questionTimeRef = useRef(0);
  useEffect(() => {
    questionTimeRef.current = 0;
  }, [currentIdx]);

  useEffect(() => {
    if (!started || !attempt || attempt.status !== 'in_progress') return;
    const interval = setInterval(() => {
      questionTimeRef.current += 1;
    }, 1000);
    return () => clearInterval(interval);
  }, [started, attempt?.id]);

  const saveToLocalStorage = useCallback((attemptData: TestAttempt) => {
    if (studentId) {
      localStorage.setItem(localStorageKey, JSON.stringify({
        ...attemptData,
        lastQuestionIdx: attemptData.lastQuestionIdx !== undefined ? attemptData.lastQuestionIdx : currentIdx,
        markedForReview: attemptData.markedForReview !== undefined ? attemptData.markedForReview : markedForReview,
        visitedQuestions: attemptData.visitedQuestions !== undefined ? attemptData.visitedQuestions : visitedQuestions,
        sectionElapsed: attemptData.sectionElapsed !== undefined ? attemptData.sectionElapsed : sectionElapsed,
        updatedAt: new Date().toISOString()
      }));
    }
  }, [studentId, localStorageKey, currentIdx, markedForReview, visitedQuestions, sectionElapsed]);

  const flushQuestionTime = useCallback(() => {
    if (!attempt || !test) return;
    const qId = test.questions[currentIdx]?.id;
    if (!qId) return;
    const elapsed = questionTimeRef.current;
    if (elapsed > 0) {
      const currentAns = attempt.answers[qId] || { questionId: qId, value: '' };
      const newTimeSpent = (currentAns.timeSpent || 0) + elapsed;
      const newAnswers = {
        ...attempt.answers,
        [qId]: { ...currentAns, timeSpent: newTimeSpent }
      };
      const newAttempt = { ...attempt, answers: newAnswers };
      setAttempt(newAttempt);
      saveToLocalStorage(newAttempt);
      questionTimeRef.current = 0;
      TestService.saveAnswer(attempt.id, { questionId: qId, value: currentAns.value, timeSpent: newTimeSpent });
    }
  }, [attempt, currentIdx, test, sectionElapsed, saveToLocalStorage]);

  const jumpToSection = useCallback((secId: string) => {
    if (!test) return;
    flushQuestionTime();
    const firstQIdx = test.questions.findIndex((qu: any) => qu.sectionId === secId);
    if (firstQIdx !== -1) {
      setCurrentIdx(firstQIdx);
    }
  }, [test, currentIdx, attempt, flushQuestionTime]);

  const getSectionTimeRemaining = useCallback(() => {
    if (!test || !activeSection || !activeSection.timeLimit) return null;
    const elapsed = sectionElapsed[activeSection.id] || 0;
    return Math.max(0, (activeSection.timeLimit * 60) - elapsed);
  }, [test, activeSection, sectionElapsed]);

  useEffect(() => {
    if (!started || !attempt || attempt.status !== 'in_progress' || !test) return;

    const interval = setInterval(() => {
      // 1. Tick overall timer
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          autoSubmit(attempt.id, test.duration * 60);
          return 0;
        }
        return prev - 1;
      });

      // 2. Tick section-wise elapsed timer
      if (test.isFullMockTest && activeSection) {
        setSectionElapsed(prev => {
          const currentElapsed = (prev[activeSection.id] || 0) + 1;
          const updated = { ...prev, [activeSection.id]: currentElapsed };
          
          // If we are in section timing mode, check if limit is reached
          if (test.timingMode === 'section' && activeSection.timeLimit) {
            const limitSecs = activeSection.timeLimit * 60;
            if (currentElapsed >= limitSecs) {
              clearInterval(interval);
              // Handle section timeout
              setTimeout(() => {
                const nextIdx = test.sections.findIndex((s: any) => s.id === activeSection.id) + 1;
                if (nextIdx < test.sections.length) {
                  const nextSec = test.sections[nextIdx];
                  toast.success(`Time is up for ${activeSection.name}! Shifting to ${nextSec.name}.`);
                  jumpToSection(nextSec.id);
                } else {
                  toast.success("Time is up for the final section! Submitting test.");
                  autoSubmit(attempt.id, test.duration * 60);
                }
              }, 100);
            }
          }
          
          return updated;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [started, attempt?.id, test, activeSection, currentIdx, jumpToSection]);

  const autoSubmit = async (attemptId: string, timeTaken: number) => {
    if (isSubmittingRef.current) return;
    console.log("Attempting to auto-submit:", attemptId, "Time taken:", timeTaken);
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const latestAnswers = attemptRef.current?.answers || {};
      const latestIdx = currentIdxRef.current;
      await TestService.submitAttempt(attemptId, timeTaken, latestAnswers, latestIdx);
      // Clear localStorage on successful submission
      if (studentId) {
        localStorage.removeItem(localStorageKey);
      }
      if (onExit) onExit(attemptId);
    } catch (e) {
      console.error("Submission failed:", e);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      alert("Submission failed. Please try again.");
    }
  };

  const handleStart = async () => {
    enterFullscreen();
    setLoading(true);
    try {
      if (!attempt) {
        const attId = await TestService.startAttempt(
          testId, 
          studentId!, 
          isPractice, 
          practiceType, 
          parentAttemptId, 
          practiceQuestionIds
        );
        const newAtt = await TestService.getAttempt(attId);
        // Clear any old localStorage data when starting a completely new attempt
        if (studentId) {
          localStorage.removeItem(localStorageKey);
        }
        setAttempt(newAtt);
        setMarkedForReview([]);
        setVisitedQuestions([]);
      }
      setStarted(true);
      // Recalculate time if it was in progress
      const currentAttempt = attempt || (await TestService.getAttemptsForTestAndStudent(testId, studentId!)).find(a => 
        (a.status === 'in_progress' || a.status === 'started') &&
        (isPractice ? a.isPracticeAttempt === true : !a.isPracticeAttempt)
      );
      if (currentAttempt) {
        const elapsed = Math.floor((Date.now() - safeDate(currentAttempt.startedAt).getTime()) / 1000);
        setTimeRemaining(Math.max(0, (test!.duration * 60) - elapsed));
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMarkForReview = useCallback(async (qId: string) => {
    if (!attempt) return;
    const isMarked = markedForReview.includes(qId);
    let newMarked: string[];
    if (isMarked) newMarked = markedForReview.filter(id => id !== qId);
    else newMarked = [...markedForReview, qId];
    
    setMarkedForReview(newMarked);
    const newAttempt = { ...attempt, markedForReview: newMarked };
    setAttempt(newAttempt);
    saveToLocalStorage(newAttempt);

    // Debounce progress update to Firestore using current ref state
    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    progressTimeoutRef.current = setTimeout(() => {
      TestService.updateAttemptProgress(attempt.id, { markedForReview: markedForReviewRef.current });
    }, 1500);
  }, [attempt, markedForReview]);

  const handleMarkAndNext = useCallback(async (qId: string) => {
    flushQuestionTime();
    // Ensure any pending answer is saved immediately
    if (saveTimeoutsRef.current[qId]) {
      clearTimeout(saveTimeoutsRef.current[qId]);
      const currentVal = attempt?.answers[qId]?.value;
      if (currentVal !== undefined) {
        await TestService.saveAnswer(attempt!.id, { questionId: qId, value: currentVal });
      }
      delete saveTimeoutsRef.current[qId];
    }

    if (!markedForReview.includes(qId)) {
      await toggleMarkForReview(qId);
    }
    
    if (test && test.isFullMockTest && test.timingMode === 'section') {
      const nextQ = test.questions[currentIdx + 1];
      if (nextQ && nextQ.sectionId === activeSection?.id) {
        setCurrentIdx(currentIdx + 1);
      } else {
        toast.error("You have reached the end of this section's questions.");
      }
    } else {
      if (currentIdx < (test?.questions.length || 0) - 1) {
        setCurrentIdx(currentIdx + 1);
      }
    }
  }, [attempt, markedForReview, currentIdx, test, activeSection, toggleMarkForReview, flushQuestionTime]);

  const handleSaveAndNext = useCallback(async (qId: string) => {
    flushQuestionTime();
    // Ensure current answer is saved immediately to avoid race conditions
    if (saveTimeoutsRef.current[qId]) {
      clearTimeout(saveTimeoutsRef.current[qId]);
      const currentVal = attempt?.answers[qId]?.value;
      if (currentVal !== undefined) {
        await TestService.saveAnswer(attempt!.id, { questionId: qId, value: currentVal });
      }
      delete saveTimeoutsRef.current[qId];
    }

    if (test && test.isFullMockTest && test.timingMode === 'section') {
      const nextQ = test.questions[currentIdx + 1];
      if (nextQ && nextQ.sectionId === activeSection?.id) {
        setCurrentIdx(currentIdx + 1);
      } else {
        // Active section ends. Check if next section exists
        if (activeSectionIdx < test.sections.length - 1) {
          if (confirm(`You have completed the questions in "${activeSection?.name}". Would you like to proceed to the next section?`)) {
            const nextSec = test.sections[activeSectionIdx + 1];
            jumpToSection(nextSec.id);
          }
        } else {
          setShowConfirmModal(true);
        }
      }
    } else {
      if (currentIdx < (test?.questions.length || 0) - 1) {
        setCurrentIdx(currentIdx + 1);
      } else {
        setShowConfirmModal(true);
      }
    }
  }, [attempt, currentIdx, test, activeSection, activeSectionIdx, jumpToSection, flushQuestionTime]);

  const handleNext = useCallback(() => {
    flushQuestionTime();
    if (test && test.isFullMockTest && test.timingMode === 'section') {
      const nextQ = test.questions[currentIdx + 1];
      if (nextQ && nextQ.sectionId === activeSection?.id) {
        setCurrentIdx(currentIdx + 1);
      } else {
        toast.error("You are at the end of this section.");
      }
    } else {
      if (currentIdx < (test?.questions.length || 0) - 1) {
        setCurrentIdx(currentIdx + 1);
      }
    }
  }, [currentIdx, test, activeSection, flushQuestionTime]);

  const handlePrev = useCallback(() => {
    flushQuestionTime();
    if (test && test.isFullMockTest && test.timingMode === 'section') {
      const prevQ = test.questions[currentIdx - 1];
      if (prevQ && prevQ.sectionId === activeSection?.id) {
        setCurrentIdx(currentIdx - 1);
      }
    } else {
      if (currentIdx > 0) {
        setCurrentIdx(currentIdx - 1);
      }
    }
  }, [currentIdx, test, activeSection, flushQuestionTime]);

  // Periodic Save to LocalStorage for recovery (every 15 seconds)
  useEffect(() => {
    if (!started || !attempt || attempt.status !== 'in_progress') return;
    
    const interval = setInterval(() => {
      saveToLocalStorage(attempt);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [started, attempt, currentIdx, markedForReview, visitedQuestions]);

  const handleAnswerChange = (qId: string, value: string | string[]) => {
    if (!attempt || !test) return;
    
    const existing = attempt.answers[qId] || { questionId: qId, value: '' };
    const newAnswers = { ...attempt.answers };
    newAnswers[qId] = { ...existing, value };
    
    const newAttempt = { ...attempt, answers: newAnswers };
    setAttempt(newAttempt);
    saveToLocalStorage(newAttempt);

    // Debounce save to Firestore independently for each question ID to avoid race conditions
    if (saveTimeoutsRef.current[qId]) {
      clearTimeout(saveTimeoutsRef.current[qId]);
    }
    saveTimeoutsRef.current[qId] = setTimeout(() => {
      TestService.saveAnswer(attempt.id, { questionId: qId, value, timeSpent: existing.timeSpent });
      delete saveTimeoutsRef.current[qId];
    }, 1000);
  };

  const clearAnswer = (qId: string) => {
    if (!attempt || !test) return;
    const existing = attempt.answers[qId] || { questionId: qId, value: '' };
    const newAnswers = { ...attempt.answers };
    delete newAnswers[qId];
    const newAttempt = { ...attempt, answers: newAnswers };
    setAttempt(newAttempt);
    saveToLocalStorage(newAttempt);

    // Debounce clear answer to Firestore independently for each question ID
    if (saveTimeoutsRef.current[qId]) {
      clearTimeout(saveTimeoutsRef.current[qId]);
    }
    saveTimeoutsRef.current[qId] = setTimeout(() => {
      TestService.saveAnswer(attempt.id, { questionId: qId, value: '', timeSpent: existing.timeSpent });
      delete saveTimeoutsRef.current[qId];
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading || !test) {
    return <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">Loading...</div>;
  }

const TestHeader = React.memo(({
  title,
  onExit,
  onShowPalette,
  answeredCount,
  timeRemaining,
  totalDuration,
  activeSection,
  sectionElapsed,
  isFullMockTest,
  timingMode,
  onSubmit
}: {
  title: string;
  onExit: () => void;
  onShowPalette: () => void;
  answeredCount: number;
  timeRemaining: number;
  totalDuration: number;
  activeSection: any;
  sectionElapsed: Record<string, number>;
  isFullMockTest: boolean;
  timingMode: 'overall' | 'section' | 'hybrid';
  onSubmit: () => void;
}) => {
  return (
    <div className="bg-white px-4 py-3 border-b border-slate-200 flex justify-between items-center shadow-sm z-20 sticky top-0">
      <div className="flex items-center gap-3">
        <button onClick={onShowPalette} className="p-2 bg-slate-100 text-slate-700 rounded-lg relative">
          <Menu className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {answeredCount}
          </span>
        </button>
        <MockTestTimer
          timingMode={isFullMockTest ? (timingMode || 'overall') : 'overall'}
          timeRemaining={timeRemaining}
          totalDuration={totalDuration}
          activeSection={isFullMockTest ? activeSection : null}
          sectionElapsed={isFullMockTest ? sectionElapsed : undefined}
        />
      </div>
      <button
        className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-red-500 transition-colors"
        onClick={onSubmit}
      >
        Submit Test
      </button>
    </div>
  );
});

  if (!started) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col pt-[env(safe-area-inset-top)] overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8 space-y-6">
            <div className="space-y-2 text-center">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-widest rounded-full">
                {isPractice ? "Practice Test Mode" : "Official Test Attempt"}
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {test.title}
              </h2>
              <p className="text-slate-500 text-sm">
                Please read the instructions carefully before starting the test.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Duration</p>
                  <p className="text-slate-800 font-extrabold">{test.duration} Minutes</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Questions</p>
                  <p className="text-slate-800 font-extrabold">{test.questions.length} Qs</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Marks</p>
                  <p className="text-slate-800 font-extrabold">
                    {test.maximumMarks || test.questions.reduce((sum, q) => sum + (q.points || 0), 0)} Marks
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Negative Marking</p>
                  <p className="text-slate-800 font-extrabold">
                    {test.negativeMarking ? "Yes (Varies)" : "No"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Test Guidelines:</h4>
              <ul className="space-y-2.5 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                  <span>The test must be attempted in **Full Screen** mode. Exiting fullscreen might lead to automatic submission.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                  <span>Once started, the timer cannot be paused. Ensure you have a stable internet connection.</span>
                </li>
                {test.isFullMockTest && test.sections && test.sections.length > 0 && (
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                    <span>This is a **Full Mock Test** containing sections: {test.sections.map((s: any) => s.name).join(', ')}.</span>
                  </li>
                )}
                {test.timingMode === 'section' && (
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                    <span className="text-amber-700 font-medium">This test uses **Section-wise timing**. When a section's time ends, you will be moved automatically and cannot return.</span>
                  </li>
                )}
              </ul>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={() => onExit()}
                className="flex-1 py-4 border-2 border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 text-sm uppercase tracking-wider"
              >
                Go Back
              </button>
              <button
                onClick={handleStart}
                className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 text-sm uppercase tracking-wider text-center"
              >
                Start Test Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <TestHeader 
        title={test.title}
        onExit={() => onExit()}
        onShowPalette={() => setShowPalette(!showPalette)}
        answeredCount={Object.keys(attempt?.answers || {}).filter(k => {
          const v = attempt?.answers[k]?.value;
          return v && (Array.isArray(v) ? v.length > 0 : v !== '');
        }).length}
        timeRemaining={timeRemaining}
        totalDuration={test.duration || 0}
        activeSection={test.isFullMockTest ? activeSection : null}
        sectionElapsed={test.isFullMockTest ? sectionElapsed : {}}
        isFullMockTest={!!test.isFullMockTest}
        timingMode={(test.timingMode as 'overall' | 'section' | 'hybrid') || 'overall'}
        onSubmit={() => setShowConfirmModal(true)}
      />

      {/* Section Tab Bar for Full Mock Tests */}
      {test.isFullMockTest && test.sections && test.sections.length > 0 && (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none sticky top-[57px] z-10 shadow-sm">
          {test.sections.map((sec: any) => {
            const isCurrent = activeSection?.id === sec.id;
            const isLocked = test.timingMode === 'section' && sec.id !== activeSection?.id;
            
            // Calculate answered/total questions in this section
            const secQuestions = test.questions.filter((qu: any) => qu.sectionId === sec.id);
            const totalCount = secQuestions.length;
            const answeredCount = secQuestions.filter((qu: any) => {
              const ansValue = attempt?.answers[qu.id]?.value;
              return ansValue !== undefined && (Array.isArray(ansValue) ? ansValue.length > 0 : ansValue !== '');
            }).length;

            return (
              <button
                key={sec.id}
                disabled={isLocked}
                onClick={() => jumpToSection(sec.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isLocked
                    ? 'opacity-40 bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                {isLocked && <X className="w-3 h-3 text-red-400 shrink-0" />}
                <span>{sec.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${isCurrent ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {answeredCount}/{totalCount}
                </span>
                {sec.timeLimit && (
                  <span className="text-[9px] font-semibold opacity-85 flex items-center">
                    ⏱️ {sec.timeLimit}m
                  </span>
                )}
              </button>
            );
          })}

          {test.timingMode === 'section' && activeSectionIdx < test.sections.length - 1 && (
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to complete "${activeSection?.name}" and proceed to the next section? You will not be able to return.`)) {
                  const nextSec = test.sections[activeSectionIdx + 1];
                  jumpToSection(nextSec.id);
                }
              }}
              className="ml-auto bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              Submit Section
            </button>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
         {!isFullscreen && !bypassedFullscreen && (
           <div className="absolute inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
             <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
               <Maximize className="w-10 h-10 text-indigo-400" />
             </div>
             <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Full Screen Mandatory</h2>
             <p className="text-slate-400 text-sm max-w-xs mb-8 font-medium">
               To ensure test integrity and prevent distractions, this test must be attempted in full screen mode.
             </p>
             <button 
               onClick={enterFullscreen}
               className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
             >
               Enter Full Screen Mode
             </button>
             <button 
               onClick={() => setBypassedFullscreen(true)}
               className="mt-4 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider underline decoration-slate-500 hover:decoration-white"
             >
               Continue in Window Mode
             </button>
           </div>
         )}
         <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
               <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                 <h3 className="font-bold text-slate-800">Question {currentIdx + 1} of {test.questions.length}</h3>
                 <div className="flex items-center space-x-2">
                   <button 
                     onClick={() => toggleMarkForReview(q.id)}
                     className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                       markedForReview.includes(q.id) 
                         ? 'bg-amber-100 text-amber-700' 
                         : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                     }`}
                   >
                     <Bookmark className={`w-3 h-3 ${markedForReview.includes(q.id) ? 'fill-current' : ''}`} />
                     <span>{markedForReview.includes(q.id) ? 'Marked' : 'Mark'}</span>
                   </button>
                   <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded">{q.type}</span>
                   <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">+{q.points}</span>
                   {test.negativeMarking && q.negativePoints && (
                     <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">-{q.negativePoints}</span>
                   )}
                 </div>
               </div>
               
               <div className="text-slate-900 text-lg leading-relaxed mb-6"><MathRenderer content={q.text} formula_latex={q.formula_latex} /></div>

              {/* Math Diagram */}
              <MathDiagram 
                metadata={q.diagramMetadata} 
                diagram_svg={q.diagram_svg} 
              />

               {/* Multi-Image Display */}
               {(q.imageUrls || (q.imageUrl ? [q.imageUrl] : [])).length > 0 && (
                 <div className="space-y-4 mb-8">
                   <div className="grid grid-cols-1 gap-4">
                     {(q.imageUrls || (q.imageUrl ? [q.imageUrl] : [])).map((url, i) => (
                       <motion.div 
                         key={i}
                         initial={{ opacity: 0, scale: 0.95 }}
                         animate={{ opacity: 1, scale: 1 }}
                         transition={{ delay: i * 0.1 }}
                         className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50"
                       >
                         <img 
                           src={url} 
                           alt={`Question asset ${i + 1}`} 
                           className="w-full h-auto max-h-[400px] object-contain mx-auto"
                           referrerPolicy="no-referrer"
                         />
                         <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => window.open(url, '_blank')}
                              className="p-2 bg-white/90 backdrop-blur shadow-sm rounded-lg text-slate-700 hover:bg-white"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                         </div>
                       </motion.div>
                     ))}
                   </div>
                 </div>
               )}

               {/* Inputs */}
               <div className="space-y-3">
                 {q.type === 'MCQ' && q.options?.map((opt, i) => (
                   <label key={i} className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-colors ${ans === String(i) ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                     <input type="radio" name={`q-${q.id}`} className="w-5 h-5 mt-0.5 text-primary-600" checked={ans === String(i)} onChange={() => handleAnswerChange(q.id, String(i))} />
                     <span className="ml-3 text-slate-700 font-medium"><MathRenderer content={opt} /></span>
                   </label>
                 ))}

                 {q.type === 'Boolean' && ['True', 'False'].map((opt) => (
                    <label key={opt} className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-colors ${ans === opt ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name={`q-${q.id}`} className="w-5 h-5 mt-0.5 text-primary-600" checked={ans === opt} onChange={() => handleAnswerChange(q.id, opt)} />
                      <span className="ml-3 text-slate-700 font-medium"><MathRenderer content={opt} /></span>
                    </label>
                  ))}

                  {q.type === 'Fill' && (
                    <div className="space-y-4">
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Type your answer exactly</p>
                       <input type="text" value={(ans as string) || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} placeholder="Type answer here..." className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-lg font-bold focus:border-primary-500 focus:ring-4 focus:ring-primary-50 outline-none transition-all" />
                    </div>
                  )}

                 {q.type === 'MSQ' && q.options?.map((opt, i) => (
                   <label key={i} className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-colors ${(ans as string[])?.includes(String(i)) ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                     <input type="checkbox" className="w-5 h-5 mt-0.5 text-primary-600 rounded" checked={(ans as string[])?.includes(String(i))} onChange={(e) => {
                       const current = (ans as string[]) || [];
                       if (e.target.checked) handleAnswerChange(q.id, [...current, String(i)]);
                       else handleAnswerChange(q.id, current.filter(x => x !== String(i)));
                     }} />
                     <span className="ml-3 text-slate-700 font-medium"><MathRenderer content={opt} /></span>
                   </label>
                 ))}

                 {q.type === 'Integer' && (
                   <input type="number" value={(ans as string) || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} placeholder="Type integer value..." className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-lg font-mono focus:border-primary-500 focus:ring-4 focus:ring-primary-50 outline-none transition-all" />
                 )}

                 {(q.type === 'Subjective' || q.type === 'Paragraph') && (
                   <textarea rows={6} value={(ans as string) || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} placeholder="Type your answer here..." className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:border-primary-500 focus:ring-4 focus:ring-primary-50 outline-none transition-all resize-none" />
                 )}
               </div>

               <div className="mt-8 flex justify-end">
                 <button onClick={() => clearAnswer(q.id)} className="text-sm font-semibold text-slate-400 hover:text-slate-600">Clear Answer</button>
               </div>
            </div>
         </div>

         {/* Question Palette Overlay */}
         <AnimatePresence>
           {showPalette && (
             <motion.div 
               initial={{ opacity: 0, x: -300 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -300 }}
               className="absolute top-0 bottom-0 left-0 w-72 bg-white shadow-2xl z-30 border-r border-slate-200 flex flex-col"
             >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h4 className="font-bold text-slate-900">Questions</h4>
                  <button onClick={() => setShowPalette(false)} className="p-1 hover:bg-slate-200 rounded-lg"><X className="w-5 h-5 text-slate-500"/></button>
                </div>
                <div className="p-4 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                  {test.questions.map((qu, idx) => {
                    const ansValue = attempt?.answers[qu.id]?.value;
                    const isAnswered = ansValue !== undefined && (Array.isArray(ansValue) ? ansValue.length > 0 : ansValue !== '');
                    const isMarked = markedForReview.includes(qu.id);
                    const isVisited = visitedQuestions.includes(qu.id);

                    let bgColor = 'bg-white border-slate-300 text-slate-500';
                    let label = '';

                    if (isAnswered && isMarked) {
                      bgColor = 'bg-violet-600 border-violet-600 text-white';
                      label = 'Ans & Marked';
                    } else if (isMarked) {
                      bgColor = 'bg-violet-500 border-violet-500 text-white';
                      label = 'Marked';
                    } else if (isAnswered) {
                      bgColor = 'bg-emerald-600 border-emerald-600 text-white';
                      label = 'Answered';
                    } else if (isVisited) {
                      bgColor = 'bg-rose-500 border-rose-500 text-white';
                      label = 'Not Answered';
                    }

                    return (
                      <button 
                        key={`${qu.id || 'qu'}-${idx}`}
                        disabled={test.isFullMockTest && test.timingMode === 'section' && qu.sectionId !== activeSection?.id}
                        onClick={() => {
                          flushQuestionTime();
                          setCurrentIdx(idx);
                          setShowPalette(false);
                        }}
                        className={`aspect-square rounded-xl font-black text-sm flex items-center justify-center border-2 transition-all relative ${
                          test.isFullMockTest && test.timingMode === 'section' && qu.sectionId !== activeSection?.id ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-50' : currentIdx === idx ? 'ring-4 ring-primary-100 border-primary-500 scale-110 z-10' : bgColor
                        }`}
                      >
                        {test.isFullMockTest && test.timingMode === 'section' && qu.sectionId !== activeSection?.id ? '🔒' : idx + 1}
                        {isAnswered && isMarked && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-600 rounded-sm" />
                      <span className="text-slate-600">Answered</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-rose-500 rounded-sm" />
                      <span className="text-slate-600">Not Answered</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-violet-500 rounded-sm" />
                      <span className="text-slate-600">Marked</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-violet-600 relative rounded-sm">
                         <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-white" />
                      </div>
                      <span className="text-slate-600">Ans & Marked</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-white border border-slate-300 rounded-sm" />
                      <span className="text-slate-600">Not Visited</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => { setShowPalette(false); setShowConfirmModal(true); }}
                    className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-100 active:scale-95 transition-all"
                  >
                    Submit Test
                  </button>
                </div>
             </motion.div>
           )}
         </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="bg-white border-t border-slate-200 p-4 pb-[calc(env(safe-area-inset-bottom,12px)+12px)] flex flex-col gap-3 z-20">
         {/* Action Tier */}
         <div className="flex items-center justify-between gap-2">
            <button 
              onClick={() => handleMarkAndNext(q.id)}
              className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-4 rounded-xl font-black bg-violet-50 text-violet-700 border-2 border-violet-100 hover:bg-violet-100 transition-all active:scale-95 shadow-sm"
            >
              <Bookmark className="w-4 h-4 fill-current" />
              <span className="text-[10px] sm:text-xs uppercase tracking-tighter">Mark for Review & Next</span>
            </button>

            <button 
              onClick={() => clearAnswer(q.id)}
              className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-4 rounded-xl font-black bg-slate-50 text-slate-500 border-2 border-slate-200 hover:bg-slate-100 transition-all active:scale-95"
            >
              <X className="w-4 h-4" />
              <span className="text-[10px] sm:text-xs uppercase tracking-tighter">Clear Response</span>
            </button>

            <button 
              onClick={() => handleSaveAndNext(q.id)}
              className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-4 rounded-xl font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100"
            >
              <span className="text-[10px] sm:text-xs uppercase tracking-wider">Save & Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
         </div>

         {/* Navigation Tier */}
         <div className="flex items-center justify-between gap-2 px-1">
            <button 
              onClick={handlePrev}
              disabled={currentIdx === 0 || (test.isFullMockTest && test.timingMode === 'section' && test.questions[currentIdx - 1]?.sectionId !== activeSection?.id)}
              className="flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 disabled:opacity-30 transition-all active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-xs">Previous</span>
            </button>
 
            <button 
              onClick={handleNext}
              disabled={currentIdx === test.questions.length - 1 || (test.isFullMockTest && test.timingMode === 'section' && test.questions[currentIdx + 1]?.sectionId !== activeSection?.id)}
              className="flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 disabled:opacity-30 transition-all active:scale-95"
            >
              <span className="text-xs">Skip / Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
         </div>
      </div>
      {showConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Submit Test</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to submit your test? You won't be able to change your answers after this.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowConfirmModal(false);
                  autoSubmit(attempt!.id, (test.duration * 60) - timeRemaining);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
