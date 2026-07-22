import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { TestService } from '../../services/test';
import { updateUserProfile } from '../../services/users';
import { Test, TestAttempt } from '../../models/mission';
import { InlineYoutubePlayer } from '../../components/feed/FeedCards';
import { onSnapshot, collection, query, where, doc, getDoc, getDocs, getCountFromServer, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import MathDiagram from '../../components/MathDiagram';
import MathRenderer from '../../components/MathRenderer';
import { triggerPrint } from '../../utils/printUtils';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, CheckCircle2, XCircle, MinusCircle, Clock, Award, BarChart2, Check, X, 
  ExternalLink, Lightbulb, AlertTriangle, FileText, TrendingUp, TrendingDown, Percent, 
  Users, Target, Zap, Medal, Trophy, Star, ShieldAlert, Sparkles, HelpCircle, ArrowUp, ArrowDown,
  Music, Bookmark, ChevronLeft, ChevronRight, Filter, Shield, Info, AlertCircle, RotateCcw, RefreshCw,
  Share2, Download, Copy, CheckCircle, BookOpen, Brain, ListCollapse, ThumbsUp, ChevronDown, ChevronUp, Printer
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

interface Props {
  testId?: string;
  attemptId?: string;
  onBack: () => void;
  onPracticeIncorrect?: (newTestId: string) => void;
}

import { parseSquashedExplanation } from '../../utils/parseExplanation';

export default function TestResultView({ testId, attemptId, onBack, onPracticeIncorrect }: Props) {
  const { currentUser, userProfile, setUserProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [test, setTest] = useState<Test | null>(null);
  const [resolvedTestId, setResolvedTestId] = useState<string | null>(testId || null);
  const [rawAttempts, setRawAttempts] = useState<TestAttempt[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [uidToUser, setUidToUser] = useState<Record<string, any>>({});
  const [batches, setBatches] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [serverRank, setServerRank] = useState<number | null>(null);
  const [serverTotalRanked, setServerTotalRanked] = useState<number | null>(null);
  const [isCreatingPractice, setIsCreatingPractice] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'analysis' | 'solutions' | 'leaderboard'>('analysis');
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'batch' | 'premium' | 'group'>('all');
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Advanced solutions and bookmarks states
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`bookmarks_${testId || resolvedTestId || 'generic'}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [solutionsFilter, setSolutionsFilter] = useState<'all' | 'attempted' | 'unattempted' | 'correct' | 'wrong' | 'bookmarked'>('all');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [isExplanationExpanded, setIsExplanationExpanded] = useState<boolean>(false);
  const [showMentorCockpit, setShowMentorCockpit] = useState<boolean>(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [language, setLanguage] = useState<'en' | 'bn'>('en');

  // Resolve testId from attemptId if not provided directly
  useEffect(() => {
    const resolveIds = async () => {
      if (testId) {
        setResolvedTestId(testId);
        return;
      }
      if (attemptId) {
        try {
          const attemptSnap = await getDoc(doc(db, 'test_attempts', attemptId));
          if (attemptSnap.exists()) {
            setResolvedTestId(attemptSnap.data().testId);
          }
        } catch (err) {
          console.error("Error resolving testId from attemptId:", err);
        }
      }
    };
    resolveIds();
  }, [testId, attemptId]);

  // Real-time synchronization listeners
  useEffect(() => {
    if (!resolvedTestId || !currentUser || authLoading) return;

    setLoading(true);

    const unsubTest = onSnapshot(doc(db, 'tests', resolvedTestId), (snap) => {
      if (snap.exists()) {
        const testData = { id: snap.id, ...snap.data() } as Test;
        if (testData.questions) {
          testData.questions = testData.questions.map(q => {
            const parsed = parseSquashedExplanation(q);
            return {
              ...q,
              explanation: parsed.explanation,
              stepwiseSolution: parsed.stepwiseSolution,
              examApproach: parsed.examApproach,
              ruleOrTheorem: parsed.ruleOrTheorem
            };
          });
        }
        setTest(testData);
      }
    }, (err) => {
      console.warn("TestResultView: Failed to subscribe to test document in real-time:", err);
    });

    let active = true;

    const loadAttemptsAndStats = async () => {
      try {
        const attemptsMap = new Map<string, TestAttempt>();

        // 1. Fetch current user's attempts specifically
        const qUser = query(
          collection(db, 'test_attempts'),
          where('testId', '==', resolvedTestId),
          where('userId', '==', currentUser.uid)
        );
        const userSnap = await getDocs(qUser);
        userSnap.forEach(d => {
          attemptsMap.set(d.id, { id: d.id, ...d.data() } as TestAttempt);
        });

        // Fetch target attempt if specified and not in map
        if (attemptId && !attemptsMap.has(attemptId)) {
          const specSnap = await getDoc(doc(db, 'test_attempts', attemptId));
          if (specSnap.exists()) {
            attemptsMap.set(specSnap.id, { id: specSnap.id, ...specSnap.data() } as TestAttempt);
          }
        }

        // 2. Fetch up to 200 other attempts as a sample for stats/leaderboard
        const qSample = query(
          collection(db, 'test_attempts'),
          where('testId', '==', resolvedTestId),
          limit(200)
        );
        const sampleSnap = await getDocs(qSample);
        sampleSnap.forEach(d => {
          attemptsMap.set(d.id, { id: d.id, ...d.data() } as TestAttempt);
        });

        if (!active) return;

        const allFetchedAttempts = Array.from(attemptsMap.values());
        setRawAttempts(allFetchedAttempts);

        // Find correct target score to use for rank query
        let targetScore = 0;
        let hasTarget = false;
        if (attemptId && attemptsMap.has(attemptId)) {
          targetScore = attemptsMap.get(attemptId)?.marks || 0;
          hasTarget = true;
        } else {
          const userAtts = allFetchedAttempts.filter(a => a.userId === currentUser.uid && !a.isPracticeAttempt);
          if (userAtts.length > 0) {
            targetScore = userAtts.sort((a, b) => (b.attemptNumber || 1) - (a.attemptNumber || 1))[0].marks || 0;
            hasTarget = true;
          }
        }

        // 3. Count global rank and total participants on the server (low memory, extremely fast)
        try {
          const qTotal = query(
            collection(db, 'test_attempts'),
            where('testId', '==', resolvedTestId),
            where('status', 'in', ['submitted', 'evaluated'])
          );
          const totalSnap = await getCountFromServer(qTotal);
          setServerTotalRanked(totalSnap.data().count);

          if (hasTarget) {
            const qHigher = query(
              collection(db, 'test_attempts'),
              where('testId', '==', resolvedTestId),
              where('status', 'in', ['submitted', 'evaluated']),
              where('marks', '>', targetScore)
            );
            const higherSnap = await getCountFromServer(qHigher);
            setServerRank(higherSnap.data().count + 1);
          }
        } catch (countErr) {
          console.warn("Server rank count query failed (missing index fallback):", countErr);
        }

      } catch (err) {
        console.error("Error fetching attempts sample and stats:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadAttemptsAndStats();

    return () => {
      active = false;
      unsubTest();
    };
  }, [resolvedTestId, attemptId, currentUser, authLoading]);

  // Handle users and batches separately (triggered by rawAttempts changes)
  useEffect(() => {
    const fetchData = async () => {
      if (!resolvedTestId || rawAttempts.length === 0) return;
      
      try {
        // Fetch batches (one-time fetch)
        let bMap = { ...batches };
        if (Object.keys(bMap).length === 0) {
          const bSnap = await getDocs(collection(db, 'batches'));
          bSnap.docs.forEach(d => {
            bMap[d.id] = { id: d.id, ...d.data() };
          });
          setBatches(bMap);
        }

        // Fetch ONLY users who have attempts for this test
        const uniqueUserIds = Array.from(new Set(rawAttempts.map(a => a.userId)));
        const uMap: Record<string, any> = {};
        const uidMap: Record<string, any> = {};

        for (let i = 0; i < uniqueUserIds.length; i += 30) {
          const chunk = uniqueUserIds.slice(i, i + 30);
          const uSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', chunk)));
          uSnap.docs.forEach(d => {
            const data = { id: d.id, ...(d.data() as any) };
            uMap[d.id] = data;
            if (data.uid) uidMap[data.uid] = data;
          });
        }
        setUsers(uMap);
        setUidToUser(uidMap);
      } catch (err) {
        console.error("Error fetching users/batches:", err);
      }
    };

    fetchData();
  }, [resolvedTestId, rawAttempts]);

  const formatTime = (seconds: number) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Memoized derived calculations with real-time profile mapping
  const memoizedResults = useMemo(() => {
    if (rawAttempts.length === 0) return null;

    // 1. Create a efficient lookup for users
    const userLookup = { ...users, ...uidToUser };
    
    // 2. Enrich attempts in a single pass
    const enriched = rawAttempts.map(att => {
      const uData = att.userId ? userLookup[att.userId] : null;
      const rawBatchId = uData?.batchId || att.batchId || '';
      let displayBatch = 'General';
      
      if (rawBatchId && batches[rawBatchId]) {
        displayBatch = batches[rawBatchId].batchName || batches[rawBatchId].batchCode || rawBatchId;
      } else if (rawBatchId) {
        displayBatch = rawBatchId;
      }

      return {
        ...att,
        userName: uData?.name || att.userName || 'Candidate',
        userPhotoURL: uData?.photoUrl || att.userPhotoURL || '',
        batchId: displayBatch,
        category: uData?.category || 'Review Category',
        isPremium: uData?.isPremium || uData?.category === 'Elite' || att.isPremium || false
      };
    });

    // 3. Filter and sort for ranking in one pass if possible
    const activeAttempts = enriched
      .filter(a => (a.status === 'evaluated' || a.status === 'submitted') && !a.isPracticeAttempt)
      .sort((a, b) => {
        const scoreDiff = (b.marks || 0) - (a.marks || 0);
        if (scoreDiff !== 0) return scoreDiff;
        
        const attemptDiff = (a.attemptNumber || 1) - (b.attemptNumber || 1);
        if (attemptDiff !== 0) return attemptDiff;

        return (a.timeTaken || 0) - (b.timeTaken || 0);
      });

    const totalR = activeAttempts.length;
    
    // 4. Single pass for rank assignment and metrics calculation
    let peakScore = 0;
    let sumScore = 0;
    let sumAccuracy = 0;
    
    activeAttempts.forEach((att, idx) => {
      att.rank = idx + 1;
      att.percentile = totalR > 0 ? ((totalR - idx) / totalR) * 100 : 0;
      
      if ((att.marks || 0) > peakScore) peakScore = att.marks || 0;
      sumScore += (att.marks || 0);
      sumAccuracy += (att.percentage || 0);
    });

    // 5. Find target attempt
    let targetAtt: TestAttempt | null = null;
    if (attemptId) {
      targetAtt = enriched.find(a => a.id === attemptId) || null;
    } else {
      const userAtts = enriched.filter(a => a.userId === currentUser?.uid && !a.isPracticeAttempt);
      if (userAtts.length > 0) {
        targetAtt = userAtts.sort((a, b) => (b.attemptNumber || 1) - (a.attemptNumber || 1))[0];
      }
    }

    if (!targetAtt) return null;

    // Apply server-computed rank if available to support lakhs of students
    if (serverRank !== null && targetAtt && targetAtt.userId === currentUser?.uid) {
      targetAtt.rank = serverRank;
      const finalTotalRanked = serverTotalRanked || totalR;
      targetAtt.percentile = finalTotalRanked > 0 ? ((finalTotalRanked - serverRank) / finalTotalRanked) * 100 : 100;
    }

    // 6. Batch specific metrics
    const batchIdStr = targetAtt.batchId || '';
    const batchAttempts = activeAttempts.filter(a => a.batchId === batchIdStr);
    const batchAvgScore = batchAttempts.length > 0 
      ? batchAttempts.reduce((acc, a) => acc + (a.marks || 0), 0) / batchAttempts.length 
      : (totalR > 0 ? sumScore / totalR : 0);
    const batchAvgAccuracy = batchAttempts.length > 0 
      ? batchAttempts.reduce((acc, a) => acc + (a.percentage ?? 0), 0) / batchAttempts.length 
      : (totalR > 0 ? sumAccuracy / totalR : 0);

    // 7. Custom Rank Movement calculation across past attempts
    let computedRankDiff = 0;
    const userAttemptsSorted = activeAttempts
      .filter(a => a.userId === targetAtt!.userId)
      .sort((a, b) => (a.attemptNumber || 1) - (b.attemptNumber || 1));
    const tAttIdx = userAttemptsSorted.findIndex(a => a.id === targetAtt!.id);
    if (tAttIdx > 0) {
      const prevAttempt = userAttemptsSorted[tAttIdx - 1];
      if (prevAttempt && prevAttempt.rank && targetAtt.rank) {
        computedRankDiff = prevAttempt.rank - targetAtt.rank;
      }
    }

    return {
      allAttempts: enriched,
      attempt: targetAtt,
      highestScore: peakScore,
      averageScore: totalR > 0 ? sumScore / totalR : 0,
      averageAccuracy: totalR > 0 ? sumAccuracy / totalR : 0,
      myBatchId: batchIdStr,
      batchAverageScore: batchAvgScore,
      batchAverageAccuracy: batchAvgAccuracy,
      rankDiff: computedRankDiff,
      totalRanked: serverTotalRanked || totalR,
      topPerformers: activeAttempts.slice(0, 5)
    };
  }, [rawAttempts, users, uidToUser, batches, attemptId, currentUser, serverRank, serverTotalRanked]);

  // Destructure for ease of use
  const { 
    allAttempts = [], 
    attempt = null, 
    highestScore = 0, 
    averageScore = 0, 
    averageAccuracy = 0, 
    myBatchId = '', 
    batchAverageScore = 0, 
    batchAverageAccuracy = 0, 
    rankDiff = 0,
    totalRanked = 0, 
    topPerformers = [] 
  } = memoizedResults || {};

  // Detailed Time Analysis
  const timeAnalysis = useMemo(() => {
    if (!test || !attempt) return { avgTimeCorrect: 0, avgTimeWrong: 0, avgTimeSkipped: 0, totalTimeTaken: 0, timeLimitSecs: 0 };
    
    let correctTime = 0;
    let wrongTime = 0;
    let skippedTime = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;

    test.questions.forEach(q => {
      const ans = attempt.answers?.[q.id];
      const time = ans?.timeSpent || 0;
      
      const isSkipped = !ans || ans.value === undefined || ans.value === "" || (Array.isArray(ans.value) && ans.value.length === 0);
      if (isSkipped) {
        skippedTime += time;
        skippedCount++;
      } else {
        let isCorrect = false;
        if (ans.marksAwarded !== undefined) {
          isCorrect = ans.marksAwarded > 0;
        } else if (ans.isCorrect !== undefined) {
          isCorrect = ans.isCorrect;
        } else {
          // Fallback manual calc
          if (Array.isArray(ans.value) && q.correctAnswers) {
            isCorrect = q.correctAnswers.length === ans.value.length && q.correctAnswers.every(v => (ans.value as string[]).includes(v));
          } else if (q.correctAnswers && q.correctAnswers.length > 0) {
            isCorrect = String(ans.value) === String(q.correctAnswers[0]);
          }
        }

        if (isCorrect) {
          correctTime += time;
          correctCount++;
        } else {
          wrongTime += time;
          wrongCount++;
        }
      }
    });

    return {
      avgTimeCorrect: correctCount > 0 ? Math.round(correctTime / correctCount) : 0,
      avgTimeWrong: wrongCount > 0 ? Math.round(wrongTime / wrongCount) : 0,
      avgTimeSkipped: skippedCount > 0 ? Math.round(skippedTime / skippedCount) : 0,
      totalTimeTaken: attempt.timeTaken || 0,
      timeLimitSecs: (test.duration || 0) * 60
    };
  }, [test, attempt]);

  // Topic-wise analysis
  const topicStats = useMemo(() => {
    if (!test || !attempt) return [];
    const topics: Record<string, {
      name: string;
      total: number;
      correct: number;
      wrong: number;
      skipped: number;
      marks: number;
      maxMarks: number;
      timeSpent: number;
    }> = {};

    test.questions.forEach(q => {
      const topicName = q.topic || q.subject || "General";
      if (!topics[topicName]) {
        topics[topicName] = {
          name: topicName,
          total: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
          marks: 0,
          maxMarks: 0,
          timeSpent: 0
        };
      }

      const t = topics[topicName];
      t.total++;
      t.maxMarks += q.points || 2;

      const ans = attempt.answers?.[q.id];
      t.timeSpent += ans?.timeSpent || 0;

      const isSkipped = !ans || ans.value === undefined || ans.value === "" || (Array.isArray(ans.value) && ans.value.length === 0);
      if (isSkipped) {
        t.skipped++;
      } else {
        let isCorrect = false;
        if (ans.marksAwarded !== undefined) {
          isCorrect = ans.marksAwarded > 0;
          t.marks += ans.marksAwarded;
        } else {
          // Fallback manual calc
          if (Array.isArray(ans.value) && q.correctAnswers) {
            isCorrect = q.correctAnswers.length === ans.value.length && q.correctAnswers.every(v => (ans.value as string[]).includes(v));
          } else if (q.correctAnswers && q.correctAnswers.length > 0) {
            isCorrect = String(ans.value) === String(q.correctAnswers[0]);
          }
          if (isCorrect) {
            t.marks += q.points || 2;
          } else if (test.negativeMarking) {
            t.marks -= q.negativePoints || 0.5;
          }
        }

        if (isCorrect) {
          t.correct++;
        } else {
          t.wrong++;
        }
      }
    });

    return Object.values(topics).map(t => {
      const attempted = t.correct + t.wrong;
      const accuracy = attempted > 0 ? (t.correct / attempted) * 100 : 0;
      return {
        ...t,
        accuracy
      };
    });
  }, [test, attempt]);

  // Strongest and Weakest topics
  const { strongestTopics, weakestTopics, recommendedTopics } = useMemo(() => {
    if (topicStats.length === 0) return { strongestTopics: [], weakestTopics: [], recommendedTopics: [] };
    
    const sorted = [...topicStats].sort((a, b) => b.accuracy - a.accuracy);
    const strong = sorted.filter(t => t.accuracy >= 75);
    const weak = sorted.filter(t => t.accuracy < 60);
    
    // Recommendations: topics with accuracy < 75%, ordered by lowest accuracy first
    const recs = sorted.filter(t => t.accuracy < 75).reverse();

    return {
      strongestTopics: strong.length > 0 ? strong : sorted.slice(0, 1),
      weakestTopics: weak.length > 0 ? weak : sorted.slice(-1),
      recommendedTopics: recs
    };
  }, [topicStats]);

  // Topper details
  const topperDetails = useMemo(() => {
    if (topPerformers.length === 0) return null;
    return topPerformers[0];
  }, [topPerformers]);

  // Memoize section-wise stats for mock tests
  const sectionStats = useMemo(() => {
    if (!test || !attempt || !test.sections || test.sections.length === 0) {
      return { stats: [], strongest: null, weakest: null };
    }

    const stats = test.sections.map((sec: any) => {
      const secQs = test.questions ? test.questions.filter((q: any) => q.sectionId === sec.id) : [];
      let secCorrect = 0;
      let secWrong = 0;
      let secSkipped = 0;
      let secMarks = 0;
      let secTimeSpent = 0;

      secQs.forEach((q: any) => {
        const ans = attempt.answers?.[q.id];
        secTimeSpent += ans?.timeSpent || 0;

        if (!ans || ans.value === undefined || ans.value === "" || (Array.isArray(ans.value) && ans.value.length === 0)) {
          secSkipped++;
        } else {
          let isCorrect = false;
          if (ans.marksAwarded !== undefined) {
            isCorrect = ans.marksAwarded > 0;
            secMarks += ans.marksAwarded;
          } else {
            // fallback
            if (Array.isArray(ans.value) && q.correctAnswers) {
              isCorrect = q.correctAnswers.length === ans.value.length && 
                          q.correctAnswers.every((v: string) => (ans.value as string[]).includes(v));
            } else if (q.correctAnswers && q.correctAnswers.length > 0) {
              isCorrect = String(ans.value) === String(q.correctAnswers[0]);
            }
            if (isCorrect) {
              const pts = q.points || sec.marksPerQuestion || 2;
              secMarks += pts;
            } else {
              const negPts = q.negativePoints || sec.negativeMarks || 0.5;
              if (test.negativeMarking) {
                secMarks -= negPts;
              }
            }
          }

          if (isCorrect) {
            secCorrect++;
          } else {
            secWrong++;
          }
        }
      });

      const totalQs = secQs.length;
      const secMaxMarks = totalQs * (sec.marksPerQuestion || 2);
      const totalAttempted = secCorrect + secWrong;
      const secAccuracy = totalAttempted > 0 ? (secCorrect / totalAttempted) * 100 : 0;
      const scorePercentage = secMaxMarks > 0 ? Math.max(0, (secMarks / secMaxMarks) * 100) : 0;

      const elapsedFromAttempt = attempt.sectionElapsed?.[sec.id];
      const finalTimeSpent = elapsedFromAttempt !== undefined ? elapsedFromAttempt : secTimeSpent;

      return {
        id: sec.id,
        name: sec.name,
        correct: secCorrect,
        wrong: secWrong,
        skipped: secSkipped,
        marks: secMarks,
        maxMarks: secMaxMarks,
        accuracy: secAccuracy,
        scorePercentage,
        timeSpent: finalTimeSpent,
        questionCount: totalQs
      };
    });

    let strongest = stats[0];
    let weakest = stats[0];

    stats.forEach((s) => {
      if (s.accuracy > strongest.accuracy || (s.accuracy === strongest.accuracy && s.scorePercentage > strongest.scorePercentage)) {
        strongest = s;
      }
      if (s.accuracy < weakest.accuracy || (s.accuracy === weakest.accuracy && s.scorePercentage < weakest.scorePercentage)) {
        weakest = s;
      }
    });

    return {
      stats,
      strongest: strongest && strongest.accuracy > 0 ? strongest : null,
      weakest: weakest && stats.length > 1 && weakest.id !== strongest?.id ? weakest : null
    };
  }, [test, attempt]);

  // Subject & Topic Category Analysis for detailed breakdown of scores
  const subjectTopicStats = useMemo(() => {
    if (!test || !attempt) return [];

    interface TopicStat {
      name: string;
      total: number;
      correct: number;
      wrong: number;
      skipped: number;
      marks: number;
      maxMarks: number;
      timeSpent: number;
    }

    interface SubjectStat {
      name: string;
      total: number;
      correct: number;
      wrong: number;
      skipped: number;
      marks: number;
      maxMarks: number;
      timeSpent: number;
      topics: Record<string, TopicStat>;
    }

    const subjects: Record<string, SubjectStat> = {};

    test.questions.forEach(q => {
      // Determine subject and topic names
      const subjectName = q.subject || test.subject || "General";
      const topicName = q.topic || "General Topic";

      if (!subjects[subjectName]) {
        subjects[subjectName] = {
          name: subjectName,
          total: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
          marks: 0,
          maxMarks: 0,
          timeSpent: 0,
          topics: {}
        };
      }

      const s = subjects[subjectName];
      if (!s.topics[topicName]) {
        s.topics[topicName] = {
          name: topicName,
          total: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
          marks: 0,
          maxMarks: 0,
          timeSpent: 0
        };
      }

      const t = s.topics[topicName];

      // Update question count and max marks for topic and subject
      const points = q.points || 2;
      s.total++;
      s.maxMarks += points;
      t.total++;
      t.maxMarks += points;

      const ans = attempt.answers?.[q.id];
      const timeSpent = ans?.timeSpent || 0;
      s.timeSpent += timeSpent;
      t.timeSpent += timeSpent;

      const isSkipped = !ans || ans.value === undefined || ans.value === "" || (Array.isArray(ans.value) && ans.value.length === 0);
      if (isSkipped) {
        s.skipped++;
        t.skipped++;
      } else {
        let isCorrect = false;
        let marksAwarded = 0;
        
        if (ans.marksAwarded !== undefined) {
          isCorrect = ans.marksAwarded > 0;
          marksAwarded = ans.marksAwarded;
        } else {
          // Fallback manual calc
          if (Array.isArray(ans.value) && q.correctAnswers) {
            isCorrect = q.correctAnswers.length === ans.value.length && q.correctAnswers.every((v: string) => (ans.value as string[]).includes(v));
          } else if (q.correctAnswers && q.correctAnswers.length > 0) {
            isCorrect = String(ans.value) === String(q.correctAnswers[0]);
          }
          if (isCorrect) {
            marksAwarded = points;
          } else if (test.negativeMarking) {
            marksAwarded = -(q.negativePoints || 0.5);
          }
        }

        s.marks += marksAwarded;
        t.marks += marksAwarded;

        if (isCorrect) {
          s.correct++;
          t.correct++;
        } else {
          s.wrong++;
          t.wrong++;
        }
      }
    });

    // Convert to arrays with percentages and sorting
    return Object.values(subjects).map(s => {
      const sAttempted = s.correct + s.wrong;
      const sAccuracy = sAttempted > 0 ? (s.correct / sAttempted) * 100 : 0;
      const sScorePercentage = s.maxMarks > 0 ? Math.max(0, (s.marks / s.maxMarks) * 100) : 0;

      const topicsList = Object.values(s.topics).map(t => {
        const tAttempted = t.correct + t.wrong;
        const tAccuracy = tAttempted > 0 ? (t.correct / tAttempted) * 100 : 0;
        const tScorePercentage = t.maxMarks > 0 ? Math.max(0, (t.marks / t.maxMarks) * 100) : 0;
        return {
          ...t,
          accuracy: tAccuracy,
          scorePercentage: tScorePercentage
        };
      }).sort((a, b) => b.marks - a.marks); // sort topics by marks or total

      return {
        ...s,
        accuracy: sAccuracy,
        scorePercentage: sScorePercentage,
        topics: topicsList
      };
    }).sort((a, b) => b.marks - a.marks); // sort subjects by marks
  }, [test, attempt]);

  // Memoize filtered questions for solutions
  const filteredQuestions = useMemo(() => {
    if (!test || !attempt) return [];
    
    return test.questions.filter((q) => {
      const ansValue = attempt.answers[q.id]?.value;
      const isAttempted = ansValue !== undefined && (Array.isArray(ansValue) ? ansValue.length > 0 : ansValue !== '');
      const isCorrect = attempt.answers[q.id]?.isCorrect;

      if (solutionsFilter === 'attempted') return isAttempted;
      if (solutionsFilter === 'unattempted') return !isAttempted;
      if (solutionsFilter === 'correct') return isCorrect;
      if (solutionsFilter === 'wrong') return isAttempted && !isCorrect;
      if (solutionsFilter === 'bookmarked') return bookmarkedIds.includes(q.id);
      return true;
    });
  }, [test, attempt, solutionsFilter, bookmarkedIds]);

  const handleReattempt = (practiceType: 'incorrect' | 'incorrect_unattempted' | 'all') => {
    if (!test || !attempt || !currentUser) return;
    
    if (onPracticeIncorrect) {
      onPracticeIncorrect(`${resolvedTestId}?isPractice=true&practiceType=${practiceType}&parentAttemptId=${attempt.id}&forceNew=true`);
    }
  };

  const handleReattemptIncorrect = () => {
    handleReattempt('incorrect');
  };

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, backgroundColor: '#f8fafc' });
      const link = document.createElement('a');
      link.download = `Performance_${test?.title || 'Result'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating image:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCopySummary = () => {
    if (!test || !attempt) return;
    const summary = `🏆 My Test Performance!\n\n📚 Test: ${test.title}\n🎯 Score: ${attempt.marks}/${test.maximumMarks}\n✅ Correct: ${attempt.correct}\n❌ Incorrect: ${attempt.wrong}\n⏭️ Skipped: ${attempt.skipped}\n⏱️ Time: ${formatTime(attempt.timeTaken || 0)}\n\nCheck out MISSIONGRID!`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Load and Save Bookmarks dynamically
  useEffect(() => {
    if (resolvedTestId) {
      try {
        const saved = localStorage.getItem(`bookmarks_${resolvedTestId}`);
        if (saved) {
          setBookmarkedIds(JSON.parse(saved));
        } else {
          setBookmarkedIds([]);
        }
      } catch (e) {
        console.error("Localstorage bookmark error:", e);
      }
    }
  }, [resolvedTestId]);

  const toggleBookmark = (qId: string) => {
    setBookmarkedIds(prev => {
      const next = prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId];
      if (resolvedTestId) {
        localStorage.setItem(`bookmarks_${resolvedTestId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  // Derive Question Insights across rawAttempts
  const questionInsightsMap = useMemo(() => {
    const insights: Record<string, {
      correctPercent: number;
      wrongPercent: number;
      skippedPercent: number;
      avgTime: number;
      difficulty: string;
      totalCount: number;
    }> = {};

    if (!test) return insights;

    test.questions.forEach(q => {
      let correctCount = 0;
      let wrongCount = 0;
      let skippedCount = 0;
      let totalTimes = 0;
      let timesCount = 0;

      rawAttempts.forEach(att => {
        const ans = att.answers?.[q.id];
        const isSkipped = !ans || !ans.value || (Array.isArray(ans.value) && ans.value.length === 0);
        let isCorrect = false;

        if (!isSkipped) {
          if (q.type === 'MCQ' || q.type === 'MSQ') {
            if (Array.isArray(ans.value)) {
              isCorrect = !!q.correctAnswers && q.correctAnswers.length === ans.value.length && q.correctAnswers.every(v => (ans.value as string[]).includes(v));
            } else if (q.correctAnswers && q.correctAnswers.length > 0) {
              isCorrect = String(ans.value) === String(q.correctAnswers[0]);
            }
          } else if (q.type === 'Integer') {
            isCorrect = !!q.correctAnswers && String(ans.value) === String(q.correctAnswers[0]);
          } else if (q.type === 'Subjective' || q.type === 'Paragraph') {
            isCorrect = (ans.marksAwarded || 0) > 0;
          }

          if (isCorrect) correctCount++;
          else wrongCount++;

          if (ans?.timeSpent !== undefined) {
            totalTimes += ans.timeSpent;
            timesCount++;
          }
        } else {
          skippedCount++;
        }
      });

      const total = rawAttempts.length || 1;
      const correctRatio = (correctCount / total) * 100;
      const difficultyLevel = correctRatio > 70 ? 'Easy' : correctRatio > 40 ? 'Medium' : 'Hard';

      insights[q.id] = {
        correctPercent: total > 0 ? (correctCount / total) * 105 : 0,
        wrongPercent: total > 0 ? (wrongCount / total) * 105 : 0,
        skippedPercent: total > 0 ? (skippedCount / total) * 105 : 0,
        avgTime: timesCount > 0 ? Math.round(totalTimes / timesCount) : 45,
        difficulty: difficultyLevel,
        totalCount: total
      };

      // Cap at 100%
      if (insights[q.id].correctPercent > 100) insights[q.id].correctPercent = 100;
      if (insights[q.id].wrongPercent > 100) insights[q.id].wrongPercent = 100;
      if (insights[q.id].skippedPercent > 100) insights[q.id].skippedPercent = 100;
    });

    return insights;
  }, [test, rawAttempts]);

  // Mentor Stats Calculations
  const mentorAnalyticsEngine = useMemo(() => {
    const totalStudentsInCohort = (Object.values(users) as any[]).filter(u => u.role === 'student' || u.role === 'aspirant').length || 1;
    const totalAtts = rawAttempts.length;
    const participationRate = totalStudentsInCohort > 0 ? (totalAtts / totalStudentsInCohort) * 100 : 0;

    // Hardest Questions (lowest correct accuracy)
    const questionAccuracies = test?.questions.map(q => {
      const insight = questionInsightsMap[q.id];
      return {
        questionId: q.id,
        text: q.text,
        type: q.type,
        correctPercent: insight ? insight.correctPercent : 100
      };
    }) || [];
    questionAccuracies.sort((a,b) => a.correctPercent - b.correctPercent);
    const mostMissedQuestions = questionAccuracies.slice(0, 5);

    // Batch level comparison
    const batchDataMap: Record<string, { batchId: string; count: number; sumScore: number; sumAccuracy: number }> = {};
    rawAttempts.forEach(att => {
      const bid = att.batchId || 'Aspirants';
      if (!batchDataMap[bid]) {
        batchDataMap[bid] = { batchId: bid, count: 0, sumScore: 0, sumAccuracy: 0 };
      }
      batchDataMap[bid].count++;
      batchDataMap[bid].sumScore += att.marks || 0;
      batchDataMap[bid].sumAccuracy += att.percentage ?? 0;
    });

    const batchComparisons = Object.values(batchDataMap).map(b => ({
      batchId: b.batchId,
      participationRate: totalStudentsInCohort > 0 ? (b.count / totalStudentsInCohort) * 100 : 100,
      avgScore: b.count > 0 ? b.sumScore / b.count : 0,
      avgAccuracy: b.count > 0 ? b.sumAccuracy / b.count : 0,
      attemptsCount: b.count
    }));

    // Top Performers & Lowest Performers Evaluated
    const sortedActive = [...allAttempts].sort((a,b) => {
      const d = (b.marks || 0) - (a.marks || 0);
      if (d !== 0) return d;
      
      // Prioritize first attempt
      const attemptDiff = (a.attemptNumber || 1) - (b.attemptNumber || 1);
      if (attemptDiff !== 0) return attemptDiff;

      return (a.timeTaken || 0) - (b.timeTaken || 0);
    });

    const topPerformers = sortedActive.slice(0, 5);
    const lowestPerformers = [...sortedActive].reverse().slice(0, 5);

    return {
      participationRate,
      mostMissedQuestions,
      batchComparisons,
      topPerformers,
      lowestPerformers,
      totalStudentsInCohort,
      totalAttemptsCount: totalAtts
    };
  }, [rawAttempts, users, test, questionInsightsMap, allAttempts]);

  // Adjust selected index dynamically if solutionsFilter filters out selected elements
  useEffect(() => {
    setCurrentQuestionIdx(0);
    setIsExplanationExpanded(false);
  }, [solutionsFilter]);

  const jumpToQuestion = (absoluteIndex: number) => {
    if (!test) return;
    const targetQ = test.questions[absoluteIndex];
    if (!targetQ) return;
    const filteredIdx = filteredQuestions.findIndex(q => q.id === targetQ.id);
    if (filteredIdx !== -1) {
      setCurrentQuestionIdx(filteredIdx);
    } else {
      setSolutionsFilter('all');
      setTimeout(() => {
        const fullIdx = test.questions.findIndex(q => q.id === targetQ.id);
        setCurrentQuestionIdx(fullIdx !== -1 ? fullIdx : 0);
      }, 0);
    }
  };

  const filteredAttemptsList = useMemo(() => {
    let list = allAttempts.filter(a => !a.isPracticeAttempt);
    if (leaderboardFilter === 'batch') {
      list = list.filter(a => a.batchId === attempt?.batchId);
    } else if (leaderboardFilter === 'premium') {
      list = list.filter(a => a.isPremium || a.category === 'Elite');
    } else if (leaderboardFilter === 'group') {
      list = list.filter(a => a.category === 'Elite' || a.category === 'Base');
    }
    return list;
  }, [allAttempts, leaderboardFilter, attempt]);

  const isMentor = userProfile?.role === 'mentor' || userProfile?.role === 'primary-mentor' || userProfile?.role === 'examiner' || userProfile?.role === 'staff' || userProfile?.role === 'admin';

  const isLocked = !isMentor && !userProfile && !test?.isPublic;

  const handleEnroll = async () => {
    if (isEnrolling) return;
    setIsEnrolling(true);
    try {
      if (!userProfile) {
        throw new Error("User profile not found. Please log in first.");
      }
      
      const userIdOrMobile = userProfile.id || userProfile.mobile || currentUser?.uid;
      if (!userIdOrMobile) {
        throw new Error("Unable to identify current user profile.");
      }

      await updateUserProfile(userIdOrMobile, {
        role: 'student',
        membership: 'free',
        isEnrolled: true,
        joinedMissionGridAt: new Date().toISOString()
      });

      // Update local state instantly for an extremely fast user experience
      setUserProfile({
        ...userProfile,
        role: 'student',
        membership: 'free',
        isEnrolled: true,
        joinedMissionGridAt: new Date().toISOString()
      });

      toast.success("Welcome to MissionGrid Free! Results unlocked! 🎉");
      setShowWelcomeBanner(true);
    } catch (err: any) {
      console.error("Enrollment failed:", err);
      toast.error(err.message || "Failed to join. Please try again.");
    } finally {
      setIsEnrolling(false);
    }
  };

  if (loading || !test || !attempt) {
    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col items-center justify-center p-6 text-center">
        <Trophy className="w-12 h-12 text-indigo-500 animate-bounce mb-3" />
        <h3 className="font-extrabold text-slate-900 text-sm">Analyzing Test Metrics</h3>
        <p className="text-xs text-slate-500 mt-1">Synchronizing real-time profiles...</p>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col justify-center items-center p-4 sm:p-6 md:p-12 overflow-y-auto">
        {/* Decorative background light */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-lg bg-slate-800/50  border border-slate-700/50 p-6 sm:p-10 rounded-3xl shadow-2xl text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
          
          {/* Animated Success Badge */}
          <div className="flex justify-center">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.6, times: [0, 0.7, 1] }}
              className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-lg"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </motion.div>
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              🎉 Test Submitted Successfully
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Your performance analysis and solutions have been processed and are ready.
            </p>
          </div>

          {/* conversion / value prop block */}
          <div className="bg-slate-900/40 border border-slate-700/40 rounded-2xl p-5 text-left space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-1">
              Join MissionGrid FREE to unlock:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-200">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Score & Rank Analytics</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Detailed Explanations</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Global Leaderboard Position</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Performance Charts</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Free Student Dashboard</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Real-Time Batches & Study Hub</span>
              </div>
            </div>
          </div>

          {/* Call to action button */}
          <div className="space-y-4 pt-2">
            <button
              onClick={handleEnroll}
              disabled={isEnrolling}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isEnrolling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enrolling into MissionGrid...</span>
                </>
              ) : (
                <>
                  <span>🚀 Join MissionGrid Free</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-500 font-medium">
              By joining, you instantly activate your lifetime free student account. No credit card required.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col pt-[env(safe-area-inset-top)]">
      {/* HEADER SECTION */}
      <div className="bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center space-x-3 p-4">
           <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-600 transition-colors">
             <ArrowLeft className="w-5 h-5" />
           </button>
           <div className="flex-1 min-w-0">
             <h2 className="text-md font-black text-slate-900 truncate">{test.title}</h2>
             <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
               <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Test Result & Analytics
             </p>
           </div>
        </div>
        
        {/* TAB NAVIGATION */}
        <div className="flex space-x-6 px-6 overflow-x-auto scrollbar-hide bg-slate-50 border-b border-slate-200">
           <button 
             onClick={() => setActiveTab('analysis')} 
             className={`py-3 shrink-0 relative text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1 border-b-2 ${
               activeTab === 'analysis' ? 'border-b-indigo-600 text-indigo-700' : 'border-b-transparent text-slate-500 font-medium hover:text-slate-800'
             }`}
           >
             📊 Analysis
           </button>
           {userProfile && (
             <button 
               onClick={() => setActiveTab('solutions')} 
               className={`py-3 shrink-0 relative text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1 border-b-2 ${
                 activeTab === 'solutions' ? 'border-b-indigo-600 text-indigo-700' : 'border-b-transparent text-slate-500 font-medium hover:text-slate-800'
               }`}
             >
               📖 Solutions
             </button>
           )}
           {(test.rankVisibility !== false || isMentor) && (
             <button 
               onClick={() => setActiveTab('leaderboard')} 
               className={`py-3 shrink-0 relative text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1 border-b-2 ${
                 activeTab === 'leaderboard' ? 'border-b-indigo-600 text-indigo-700' : 'border-b-transparent text-slate-500 font-medium hover:text-slate-800'
               }`}
             >
               🏆 Leaderboard
             </button>
           )}
        </div>
      </div>

      {/* VIEW CONTENTPORTALS */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
         {/* TAB 1: INTEGRATED PERFORMANCE ANALYSIS */}
         {activeTab === 'analysis' && (
           <>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-start mb-6">
             {/* Left Card: Main Performance Card */}
             <div className="bg-white rounded-[2rem] border border-slate-200 p-6 text-center shadow-sm relative overflow-hidden md:col-span-2 space-y-6">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 blur-2xl opacity-50" />
                <div className="flex justify-between items-center">
                   <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Your Performance Card</h3>
                   <div className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">Cutoff limit: {test.passingMarks} M</div>
                </div>

                <div className={`grid grid-cols-1 ${test.rankVisibility !== false ? 'sm:grid-cols-2' : ''} gap-4`}>
                  {/* Rank Callout */}
                  {test.rankVisibility !== false && (
                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center text-rose-500">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-[9px] uppercase font-bold text-slate-400 tracking-tight">Percentile Rank</div>
                        <div className="text-sm font-black text-slate-900">Your Rank</div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="text-xl font-black text-rose-500 tabular-nums">#{attempt.rank || 'N/A'} <span className="text-[10px] text-slate-400 font-extrabold">/{totalRanked}</span></div>
                      
                      {/* Rank Movement */}
                      {rankDiff !== 0 ? (
                        <div className={`text-[9px] font-black uppercase flex items-center gap-0.5 mt-1 ${rankDiff > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {rankDiff > 0 ? (
                            <>
                              <ArrowUp className="w-3 h-3" /> Improved by {rankDiff}
                            </>
                          ) : (
                            <>
                              <ArrowDown className="w-3 h-3" /> Slipped by {Math.abs(rankDiff)}
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-bold mt-1">No Rank Change</span>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Marks Score Callout */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-500">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-[9px] uppercase font-bold text-slate-400 tracking-tight">Score Achieved</div>
                        <div className="text-sm font-black text-slate-900">My Marks</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-slate-900 tabular-nums">{attempt.marks}<span className="text-[10px] text-slate-400 font-extrabold">/{test.maximumMarks} Max</span></div>
                      <div className="text-[9px] font-bold text-emerald-600 mt-1">Highest: {highestScore} M</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <div className="text-[9px] text-slate-400 font-extrabold uppercase mb-1">Percentile</div>
                      <div className="text-xs font-black text-slate-900">{(attempt.percentile || 0).toFixed(1)}%</div>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <div className="text-[9px] text-slate-400 font-extrabold uppercase mb-1">Accuracy</div>
                      <div className="text-xs font-black text-emerald-600">{(attempt.percentage ?? 0).toFixed(0)}%</div>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <div className="text-[9px] text-slate-400 font-extrabold uppercase mb-1">Answered</div>
                      <div className="text-xs font-black text-slate-900">{attempt.correct + attempt.wrong}/{test.questions.length}</div>
                   </div>
                </div>

                <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-4 text-center">
                    <div>
                        <div className="text-[9px] font-extrabold text-emerald-600 flex flex-col items-center gap-0.5">
                          <Check className="w-3 h-3" /> 
                          <span>Correct</span>
                          <span className="text-xs">{attempt.correct}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-[9px] font-extrabold text-red-500 flex flex-col items-center gap-0.5">
                          <X className="w-3 h-3" /> 
                          <span>Wrong</span>
                          <span className="text-xs">{attempt.wrong}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-[9px] font-extrabold text-amber-600 flex flex-col items-center gap-0.5">
                          <AlertCircle className="w-3 h-3" /> 
                          <span>Negative</span>
                          <span className="text-xs">{(attempt.wrong * 0.5).toFixed(1)}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-[9px] font-extrabold text-slate-500 flex flex-col items-center gap-0.5">
                          <MinusCircle className="w-3 h-3" /> 
                          <span>Skipped</span>
                          <span className="text-xs">{attempt.skipped}</span>
                        </div>
                    </div>
                </div>

                {!isMentor && (
                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                      <RotateCcw size={12} className="text-slate-400" />
                      Revision & Practice Options
                    </h4>
                    <div className="space-y-2">
                      <button 
                        onClick={() => handleReattempt('incorrect')}
                        disabled={isCreatingPractice}
                        className="w-full flex items-center justify-between p-3 border border-indigo-150 hover:bg-indigo-50/50 rounded-xl text-left transition-all active:scale-[0.99] text-xs font-black text-indigo-700"
                      >
                        <span className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-indigo-500" />
                          Reattempt Incorrect Questions ({attempt.wrong})
                        </span>
                        <ChevronRight size={14} />
                      </button>

                      <button 
                        onClick={() => handleReattempt('incorrect_unattempted')}
                        disabled={isCreatingPractice}
                        className="w-full flex items-center justify-between p-3 border border-violet-150 hover:bg-violet-50/50 rounded-xl text-left transition-all active:scale-[0.99] text-xs font-black text-violet-700"
                      >
                        <span className="flex items-center gap-2">
                          <AlertTriangle size={14} className="text-violet-500" />
                          Reattempt Incorrect + Unattempted ({attempt.wrong + attempt.skipped})
                        </span>
                        <ChevronRight size={14} />
                      </button>

                      <button 
                        onClick={() => handleReattempt('all')}
                        disabled={isCreatingPractice}
                        className="w-full flex items-center justify-between p-3 border border-emerald-150 hover:bg-emerald-50/50 rounded-xl text-left transition-all active:scale-[0.99] text-xs font-black text-emerald-700"
                      >
                        <span className="flex items-center gap-2">
                          <RotateCcw size={14} className="text-emerald-500" />
                          Reattempt Entire Test ({test.questions.length})
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
             </div>

             {/* Right Column: Key performance metrics & Top performers */}
             <div className="space-y-6">
                {/* Secondary metadata stats */}
                <div className="bg-white p-4.5 rounded-[1.5rem] border border-slate-200 shadow-sm grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl">
                      <Clock className="w-5 h-5 text-indigo-400 mb-1" />
                      <span className="text-sm font-black text-slate-900">{formatTime(attempt.timeTaken)}</span>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-1">Time Taken</span>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl">
                      <BarChart2 className="w-5 h-5 text-rose-450 mb-1" />
                      <span className="text-sm font-black text-rose-500">{(test.maximumMarks - attempt.marks)} pts</span>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-1">Marks Dropped</span>
                    </div>
                </div>

                {/* Top Performers Podium list */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
                   <div className="flex items-center justify-between mb-4">
                     <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                       <Trophy className="w-4 h-4 text-amber-500" /> Top Performers
                     </h4>
                     <span className="text-[9px] font-black text-slate-400 uppercase">Aces Board</span>
                   </div>
                   <div className="space-y-3">
                     {topPerformers.map((item, idx) => (
                       <div key={`${item.id}-${idx}`} className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all">
                         <div className="flex items-center gap-2.5">
                           <div className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center ${
                             idx === 0 ? 'bg-amber-100 text-amber-700' :
                             idx === 1 ? 'bg-slate-200 text-slate-700' :
                             idx === 2 ? 'bg-amber-50 text-amber-600' : 'bg-slate-200/50 text-slate-500'
                           }`}>
                             #{idx + 1}
                           </div>
                           {item.userPhotoURL ? (
                             <img src={item.userPhotoURL} alt={item.userName} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                           ) : (
                             <div className="w-7 h-7 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full flex items-center justify-center">
                               {item.userName ? item.userName[0].toUpperCase() : 'S'}
                             </div>
                           )}
                           <div className="min-w-0">
                             <div className="text-xs font-extrabold text-slate-800 truncate max-w-[100px] sm:max-w-xs">{item.userName}</div>
                             <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{item.batchId || 'Aspirants'}</div>
                           </div>
                         </div>
                         <div className="text-right">
                           <div className="text-xs font-black text-indigo-600 tabular-nums">{item.marks} M</div>
                           <div className="text-[8px] font-bold text-slate-400">{(item.percentage ?? 0).toFixed(0)}% Acc</div>
                         </div>
                       </div>
                     ))}
                     {topPerformers.length === 0 && (
                       <div className="text-center py-4 text-xs text-slate-400 font-bold">No competitors evaluated yet</div>
                     )}
                   </div>
                </div>
             </div>
           </div>

            {/* Section-wise Performance breakdown */}
            {test?.isFullMockTest && sectionStats.stats.length > 0 && (
              <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm max-w-6xl mx-auto mb-6 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-2xl opacity-75" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-indigo-600" />
                      Section-wise Performance Analysis
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">
                      Detailed diagnostic break-up of your scores, speed, and accuracy across individual sections.
                    </p>
                  </div>
                  <div className="text-xs font-black uppercase text-slate-400 font-mono tracking-wider">
                    {test.sections?.length} Active Sections
                  </div>
                </div>

                {/* Strongest / Weakest section callouts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sectionStats.strongest && (
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-start gap-3.5">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl flex items-center justify-center shrink-0">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Strongest Section</span>
                        <h4 className="text-sm font-black text-slate-950">{sectionStats.strongest.name}</h4>
                        <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                          Peak accuracy of <span className="text-emerald-700 font-black">{sectionStats.strongest.accuracy.toFixed(0)}%</span> with {sectionStats.strongest.correct} correct out of {sectionStats.strongest.correct + sectionStats.strongest.wrong} attempted questions. Excellent conversion rate!
                        </p>
                      </div>
                    </div>
                  )}

                  {sectionStats.weakest && (
                    <div className="p-4 bg-rose-50/40 border border-rose-150 rounded-2xl flex items-start gap-3.5">
                      <div className="w-10 h-10 bg-rose-100 text-rose-700 border border-rose-200 rounded-xl flex items-center justify-center shrink-0">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider">Focus Area (Weakest)</span>
                        <h4 className="text-sm font-black text-slate-950">{sectionStats.weakest.name}</h4>
                        <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                          Accuracy was <span className="text-rose-600 font-black">{sectionStats.weakest.accuracy.toFixed(0)}%</span>. Spend more time analyzing step-by-step solutions to address critical conceptual gaps.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Grid list of all sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectionStats.stats.map((secStat: any) => {
                    return (
                      <div key={secStat.id} className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate max-w-[150px]" title={secStat.name}>
                              {secStat.name}
                            </h4>
                            <span className="text-[10px] font-mono font-black text-slate-500 bg-slate-200/65 px-2 py-0.5 rounded-lg border border-slate-300/40">
                              {secStat.questionCount} Qs
                            </span>
                          </div>

                          {/* Accuracy bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                              <span>Accuracy Ratio</span>
                              <span className={`font-black ${secStat.accuracy >= 70 ? 'text-emerald-600' : secStat.accuracy >= 45 ? 'text-amber-600' : 'text-rose-600'}`}>
                                {secStat.accuracy.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  secStat.accuracy >= 70 ? 'bg-emerald-500' : secStat.accuracy >= 45 ? 'bg-amber-500' : 'bg-rose-500'
                                }`} 
                                style={{ width: `${secStat.accuracy}%` }} 
                              />
                            </div>
                          </div>
                        </div>

                        {/* Stats items list */}
                        <div className="grid grid-cols-2 gap-2 text-center text-[10px] border-t border-slate-200/50 pt-3">
                          <div className="p-1.5 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 font-extrabold uppercase block mb-0.5">Score</span>
                            <span className="font-black text-slate-800 text-xs">{secStat.marks} <span className="text-[9px] text-slate-400">/{secStat.maxMarks}</span></span>
                          </div>
                          <div className="p-1.5 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 font-extrabold uppercase block mb-0.5">Time Spent</span>
                            <span className="font-black text-slate-800 text-xs flex items-center justify-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              {formatTime(secStat.timeSpent)}
                            </span>
                          </div>
                        </div>

                        {/* Correct/Wrong/Skipped break-up */}
                        <div className="grid grid-cols-3 gap-1 pt-1 text-[9px] font-black text-center font-mono uppercase">
                          <div className="text-emerald-600 bg-emerald-50 border border-emerald-100/60 rounded-lg py-1">
                            {secStat.correct} Correct
                          </div>
                          <div className="text-rose-600 bg-rose-50 border border-rose-100/60 rounded-lg py-1">
                            {secStat.wrong} Wrong
                          </div>
                          <div className="text-slate-500 bg-slate-100 border border-slate-200/40 rounded-lg py-1">
                            {secStat.skipped} Skip
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Subject & Topic Category Wise Score Breakdown */}
            {subjectTopicStats.length > 0 && (
              <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm max-w-6xl mx-auto mb-6 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-2xl opacity-75" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      Subject & Topic Category Score Breakdown
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">
                      Detailed diagnostic summary of your scores, accuracy, and efficiency categorized by subjects and dynamic topic tags.
                    </p>
                  </div>
                  <div className="text-xs font-black uppercase text-indigo-600 font-mono bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100/60 tracking-wider">
                    {subjectTopicStats.length} Subjects Evaluated
                  </div>
                </div>

                <div className="space-y-4">
                  {subjectTopicStats.map((subStat) => {
                    const isExpanded = !!expandedSubjects[subStat.name];
                    return (
                      <div key={subStat.name} className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50/40 hover:bg-slate-50/70 transition-all duration-200">
                        {/* Subject Header */}
                        <div 
                          onClick={() => setExpandedSubjects(prev => ({ ...prev, [subStat.name]: !prev[subStat.name] }))}
                          className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                              <Brain className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900 tracking-tight">{subStat.name}</h4>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded-md">
                                  {subStat.total} Questions
                                </span>
                                <span className="text-[9px] font-mono font-semibold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded-md">
                                  Time: {formatTime(subStat.timeSpent)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-center">
                            {/* Score Display */}
                            <div className="text-right">
                              <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Score</div>
                              <div className="text-sm font-black text-slate-850 tabular-nums">
                                {subStat.marks.toFixed(1)} <span className="text-[10px] text-slate-400">/{subStat.maxMarks}</span>
                              </div>
                            </div>

                            {/* Accuracy Gauge */}
                            <div className="text-right">
                              <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Accuracy</div>
                              <span className={`text-sm font-black tabular-nums ${
                                subStat.accuracy >= 75 ? 'text-emerald-600' : subStat.accuracy >= 50 ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {subStat.accuracy.toFixed(0)}%
                              </span>
                            </div>

                            {/* Chevron Toggle Button */}
                            <div className="w-8 h-8 rounded-full bg-white border border-slate-150 flex items-center justify-center text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Subject Mini-Progress Bar */}
                        <div className="px-4 sm:px-5 pb-3">
                          <div className="h-1.5 bg-slate-200/70 rounded-full overflow-hidden w-full">
                            <div 
                              className={`h-full rounded-full transition-all duration-550 ${
                                subStat.accuracy >= 75 ? 'bg-emerald-500' : subStat.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${subStat.accuracy}%` }}
                            />
                          </div>
                        </div>

                        {/* Expanded Topics Details with transition */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 bg-white p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                            <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Topic Category Breakdown</div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {subStat.topics.map((topic) => (
                                <div key={topic.name} className="p-4 bg-slate-50/50 border border-slate-150 rounded-xl flex flex-col justify-between gap-3 hover:border-indigo-100 hover:bg-indigo-50/10 transition-colors">
                                  <div className="flex justify-between items-start gap-2">
                                    <h5 className="text-xs font-black text-slate-800 leading-tight truncate max-w-[200px]" title={topic.name}>
                                      {topic.name}
                                    </h5>
                                    <span className="text-[9px] font-mono font-extrabold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md shrink-0">
                                      {topic.total} Qs
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                      <span>Topic Accuracy</span>
                                      <span className={`font-black ${
                                        topic.accuracy >= 75 ? 'text-emerald-600' : topic.accuracy >= 50 ? 'text-amber-600' : 'text-rose-600'
                                      }`}>
                                        {topic.accuracy.toFixed(0)}%
                                      </span>
                                    </div>
                                    <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${
                                          topic.accuracy >= 75 ? 'bg-emerald-500' : topic.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${topic.accuracy}%` }}
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2 border-t border-slate-200/40 pt-2.5 text-center text-[9px] font-mono">
                                    <div className="bg-white border border-slate-100 rounded-lg p-1.5">
                                      <span className="text-slate-400 font-extrabold block mb-0.5">SCORE</span>
                                      <span className="font-black text-slate-700 text-[10px]">
                                        {topic.marks.toFixed(1)} <span className="text-[8px] text-slate-400">/{topic.maxMarks}</span>
                                      </span>
                                    </div>
                                    <div className="bg-white border border-slate-100 rounded-lg p-1.5">
                                      <span className="text-slate-400 font-extrabold block mb-0.5">TIME</span>
                                      <span className="font-black text-slate-700 text-[10px]">{formatTime(topic.timeSpent)}</span>
                                    </div>
                                    <div className="bg-white border border-slate-100 rounded-lg p-1.5 flex flex-col justify-between">
                                      <span className="text-slate-400 font-extrabold block mb-0.5">ACC ratio</span>
                                      <span className="font-black text-[10px] text-indigo-600">{topic.correct}C / {topic.total - topic.skipped}A</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

             {/* Subject & Topic-wise Score Summary Breakdown */}
            {subjectTopicStats.length > 0 && (
              <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm max-w-6xl mx-auto mb-6 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-2xl opacity-75" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      Subject & Topic-wise Diagnostics
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">
                      Comprehensive score summary, accuracy metrics, and time distribution categorized by subject and key topics.
                    </p>
                  </div>
                  <div className="text-xs font-black uppercase text-slate-450 font-mono tracking-wider">
                    {subjectTopicStats.length} Active {subjectTopicStats.length === 1 ? 'Subject' : 'Subjects'}
                  </div>
                </div>

                {/* Grid list of Subjects */}
                <div className="grid grid-cols-1 gap-6">
                  {subjectTopicStats.map((subStat: any) => {
                    const isExpanded = expandedSubjects[subStat.name] !== undefined 
                      ? expandedSubjects[subStat.name] 
                      : (subjectTopicStats.length === 1);
                    const accuracyColorClass = subStat.accuracy >= 75 
                      ? 'text-emerald-600' 
                      : subStat.accuracy >= 50 
                        ? 'text-amber-600' 
                        : 'text-rose-600';
                    const accuracyBgClass = subStat.accuracy >= 75 
                      ? 'bg-emerald-500' 
                      : subStat.accuracy >= 50 
                        ? 'bg-amber-500' 
                        : 'bg-rose-500';

                    return (
                      <div key={subStat.name} className="bg-slate-50 border border-slate-150 rounded-[1.5rem] overflow-hidden transition-all duration-250">
                        {/* Header Row / Accordion Trigger */}
                        <div 
                          onClick={() => setExpandedSubjects(prev => ({ ...prev, [subStat.name]: !prev[subStat.name] }))}
                          className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                              <Brain className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-950 uppercase tracking-tight">{subStat.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{subStat.topics.length} {subStat.topics.length === 1 ? 'topic' : 'topics'} analyzed</p>
                            </div>
                          </div>

                          {/* Quick Metrics in Header */}
                          <div className="flex flex-wrap items-center gap-4 text-xs md:ml-auto">
                            <div className="px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-center min-w-[80px]">
                              <span className="text-[9px] text-slate-400 font-extrabold uppercase block mb-0.5">Score</span>
                              <span className="font-black text-slate-800 tabular-nums">
                                {subStat.marks.toFixed(1)} <span className="text-[9px] text-slate-450">/{subStat.maxMarks}</span>
                              </span>
                            </div>

                            <div className="px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-center min-w-[70px]">
                              <span className="text-[9px] text-slate-400 font-extrabold uppercase block mb-0.5">Accuracy</span>
                              <span className={`font-black ${accuracyColorClass}`}>{subStat.accuracy.toFixed(0)}%</span>
                            </div>

                            <div className="px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-center min-w-[80px] hidden sm:block">
                              <span className="text-[9px] text-slate-400 font-extrabold uppercase block mb-0.5">Time Spent</span>
                              <span className="font-black text-slate-800 font-mono">{formatTime(subStat.timeSpent)}</span>
                            </div>

                            {/* Chevron expand indicator */}
                            <div className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 ml-2">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expandable Topic Details Container */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-slate-200/60 bg-white"
                            >
                              {/* Subject stats summary bar */}
                              <div className="p-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-4 gap-2 text-center text-[10px] font-black uppercase font-mono">
                                <div className="text-emerald-600 bg-emerald-50/50 border border-emerald-100/60 rounded-xl py-1.5">
                                  {subStat.correct} Correct
                                </div>
                                <div className="text-rose-600 bg-rose-50/50 border border-rose-100/60 rounded-xl py-1.5">
                                  {subStat.wrong} Wrong
                                </div>
                                <div className="text-slate-500 bg-slate-100 border border-slate-200/40 rounded-xl py-1.5">
                                  {subStat.skipped} Skipped
                                </div>
                                <div className="text-indigo-600 bg-indigo-50/50 border border-indigo-100/40 rounded-xl py-1.5">
                                  {subStat.total} Total Qs
                                </div>
                              </div>

                              {/* Topics List Table */}
                              <div className="p-5 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-150 text-[9px] uppercase font-black text-slate-400 tracking-wider">
                                      <th className="pb-3 pl-2">Topic Category</th>
                                      <th className="pb-3 text-center">Questions</th>
                                      <th className="pb-3 text-center">Score Contribution</th>
                                      <th className="pb-3 text-center">Time Spent</th>
                                      <th className="pb-3 text-center">Accuracy Ratio</th>
                                      <th className="pb-3 pr-2 text-right">Progress Bar</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-[11px]">
                                    {subStat.topics.map((topic: any, tIdx: number) => {
                                      const topicAccColor = topic.accuracy >= 75 
                                        ? 'text-emerald-600 bg-emerald-50' 
                                        : topic.accuracy >= 50 
                                          ? 'text-amber-600 bg-amber-50' 
                                          : 'text-rose-600 bg-rose-50';
                                      const topicAccBar = topic.accuracy >= 75 
                                        ? 'bg-emerald-500' 
                                        : topic.accuracy >= 50 
                                          ? 'bg-amber-500' 
                                          : 'bg-rose-500';

                                      return (
                                        <tr key={tIdx} className="hover:bg-slate-50/40 transition-colors">
                                          <td className="py-3 pl-2 font-black text-slate-800">{topic.name}</td>
                                          <td className="py-3 text-center font-mono font-bold text-slate-600">{topic.total}</td>
                                          <td className="py-3 text-center font-bold text-slate-800">
                                            {topic.marks.toFixed(1)} <span className="text-[10px] text-slate-400">/{topic.maxMarks}</span>
                                          </td>
                                          <td className="py-3 text-center font-mono font-semibold text-slate-500">{formatTime(topic.timeSpent)}</td>
                                          <td className="py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${topicAccColor}`}>
                                              {topic.accuracy.toFixed(0)}%
                                            </span>
                                          </td>
                                          <td className="py-3 pr-2 text-right w-28">
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full inline-block">
                                              <div 
                                                className={`h-full rounded-full ${topicAccBar}`}
                                                style={{ width: `${topic.accuracy}%` }}
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

           {test && test.isPublic && !userProfile && (
             <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-purple-900 text-white rounded-[2rem] p-8 border border-white/10 shadow-xl text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden mt-6 max-w-4xl mx-auto">
               {/* Background Glow */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
               
               <div className="relative z-10 max-w-xl space-y-2">
                 <div className="inline-flex items-center gap-1 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider text-indigo-200">
                   <Sparkles className="w-3 h-3 text-cyan-300 animate-pulse" /> Live Test Complete
                 </div>
                 <h3 className="text-xl md:text-2xl font-black tracking-tight text-white leading-tight">Continue your preparation with MissionGrid</h3>
                 <p className="text-xs text-indigo-200/80 leading-relaxed font-semibold">
                   Take your learning to the next level. Join our active preparation batches to unlock curated practice materials, daily missions, personal rank trackers, and direct guidance from top mentors.
                 </p>
               </div>
               
               <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                 <button 
                   onClick={() => {
                     onBack();
                   }}
                   className="px-6 py-3.5 bg-white text-indigo-950 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 text-center shadow-lg cursor-pointer"
                 >
                   Join MissionGrid
                 </button>
                 <button 
                   onClick={() => {
                     onBack();
                   }}
                   className="px-6 py-3.5 bg-white/10 border border-white/20 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95 text-center cursor-pointer"
                 >
                   Explore Batch
                 </button>
               </div>
             </div>
           )}
         </>
        )}

         {/* TAB 2: METICULOUS PERFORMANCE COMPARISON & GRAPHICS */}
         {activeTab === 'analysis' && (
           <div className="space-y-6 max-w-4xl mx-auto">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Rank metrics */}
               <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-40" />
                 <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-6 flex items-center gap-1.5">
                     <Medal className="w-4.5 h-4.5 text-amber-500" /> Class Ranking Status
                 </h3>

                 <div className="grid grid-cols-2 gap-4 items-center">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Your position</span>
                       <span className="text-3xl font-black text-indigo-600 mt-2 block tabular-nums">#{attempt.rank || 'N/A'}</span>
                       <span className="text-[9px] text-slate-400 font-bold mt-1.5 block">Out of {totalRanked} competitors</span>
                    </div>
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                       <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider block">Apex Marks</span>
                       <span className="text-3xl font-black text-amber-600 mt-2 block tabular-nums">{highestScore} M</span>
                       <span className="text-[9px] text-amber-600 font-bold mt-1.5 block">Apex Benchmark</span>
                    </div>
                 </div>

                 <div className="mt-4 p-4 bg-indigo-50 border border-indigo-150 rounded-2xl flex items-center gap-3">
                    <Zap className="w-5 h-5 text-indigo-600 shrink-0 animate-pulse" />
                    <p className="text-xs text-indigo-900 font-semibold leading-normal">
                       You scored in the top <span className="font-black">{(attempt.percentile || 0).toFixed(1)}%</span> of all candidates in this batch!
                    </p>
                 </div>
               </div>

               {/* Score stats bar list */}
               <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-6 flex items-center gap-1.5">
                      <Target className="w-4.5 h-4.5 text-indigo-500" /> Score Distribution (Benchmark)
                  </h3>

                  <div className="space-y-4">
                     <div>
                        <div className="flex justify-between items-center text-xs font-bold mb-1.5 text-slate-700">
                           <span>Your Score</span>
                           <span className="font-black text-slate-900">{attempt.marks} / {test.maximumMarks} Marks</span>
                        </div>
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                           <div className="h-full bg-gradient-to-r from-indigo-550 to-indigo-600 rounded-full" style={{ width: `${(attempt.marks / test.maximumMarks) * 100}%` }} />
                        </div>
                     </div>

                     <div>
                        <div className="flex justify-between items-center text-xs font-bold mb-1.5 text-slate-600">
                           <span>Highest Competitor Score</span>
                           <span className="font-black text-amber-600">{highestScore} / {test.maximumMarks} Marks</span>
                        </div>
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                           <div className="h-full bg-amber-450 rounded-full" style={{ width: `${(highestScore / test.maximumMarks) * 100}%` }} />
                        </div>
                     </div>

                     <div>
                        <div className="flex justify-between items-center text-xs font-bold mb-1.5 text-slate-600">
                           <span>Global Average Score</span>
                           <span className="font-black text-slate-700">{(averageScore).toFixed(1)} / {test.maximumMarks} Marks</span>
                        </div>
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                           <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(averageScore / test.maximumMarks) * 100}%` }} />
                        </div>
                     </div>
                  </div>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Accuracy Metrics panel */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                   <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-6 flex items-center gap-1.5">
                       <Percent className="w-4.5 h-4.5 text-emerald-500" /> Accuracy Index
                   </h3>

                   <div className="grid grid-cols-2 gap-4 text-center">
                       <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl">
                          <span className="text-[9px] font-black text-emerald-800 uppercase block">My accuracy</span>
                          <span className="text-2xl font-black text-emerald-600 mt-1 block">{(attempt.percentage ?? 0).toFixed(0)}%</span>
                       </div>

                       <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <span className="text-[9px] font-black text-slate-400 uppercase block">Global Average</span>
                          <span className="text-2xl font-black text-slate-700 mt-1 block">{(averageAccuracy).toFixed(1)}%</span>
                       </div>
                   </div>

                   <div className="mt-4 p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
                       <span className="text-xs font-extrabold text-slate-800">
                          {attempt.percentage! >= averageAccuracy ? (
                              <span className="text-emerald-700 leading-normal">🎉 Excellent effort! You are {(attempt.percentage! - averageAccuracy).toFixed(1)}% ahead of the class average!</span>
                          ) : (
                              <span className="text-rose-700 leading-normal">💡 You are below the average accuracy target by {(averageAccuracy - attempt.percentage!).toFixed(1)}%. Check solutions!</span>
                          )}
                       </span>
                   </div>
                </div>

                {/* Batch metrics panel */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
                   <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-1.5">
                       <Users className="w-4.5 h-4.5 text-primary-500" /> Batch-Level Metrics
                   </h3>
                   <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-5">Batch Enrolled: {myBatchId || 'General Batch'}</p>

                   <div className="divide-y divide-slate-100">
                      <div className="py-2.5 flex justify-between items-center">
                         <span className="text-xs font-semibold text-slate-600">Your Marks</span>
                         <span className="text-xs font-black text-slate-900">{attempt.marks} M</span>
                      </div>
                      <div className="py-2.5 flex justify-between items-center">
                         <span className="text-xs font-semibold text-slate-600">Batch Average Score</span>
                         <span className="text-xs font-black text-slate-900">{(batchAverageScore).toFixed(1)} M</span>
                      </div>
                      <div className="py-2.5 flex justify-between items-center">
                         <span className="text-xs font-semibold text-slate-600">Your Accuracy Ratio</span>
                         <span className="text-xs font-black text-emerald-600">{(attempt.percentage ?? 0).toFixed(0)}%</span>
                      </div>
                      <div className="py-2.5 flex justify-between items-center">
                         <span className="text-xs font-semibold text-slate-600">Batch Average Accuracy</span>
                         <span className="text-xs font-black text-slate-900">{(batchAverageAccuracy).toFixed(1)}%</span>
                      </div>
                   </div>
                </div>
             </div>

             {/* 3. PERFORMANCE CHARTS */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Topic-wise Accuracy Bar Chart */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
                   <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-1.5">
                       <BarChart2 className="w-4.5 h-4.5 text-indigo-500" /> Topic-wise Accuracy
                   </h3>
                   <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-5">Comparative accuracy across preparation topics</p>
                   <div className="h-64">
                     {topicStats.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={topicStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                           <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                           <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" domain={[0, 100]} />
                           <Tooltip 
                             contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                             formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Accuracy']}
                           />
                           <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                             {topicStats.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.accuracy >= 75 ? '#10b981' : entry.accuracy >= 50 ? '#f59e0b' : '#ef4444'} />
                             ))}
                           </Bar>
                         </BarChart>
                       </ResponsiveContainer>
                     ) : (
                       <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">No topic data available</div>
                     )}
                   </div>
                </div>

                {/* Score Benchmark Chart */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
                   <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-1.5">
                       <Target className="w-4.5 h-4.5 text-rose-500" /> Score Benchmarking
                   </h3>
                   <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-5 font-mono">Your score vs Topper vs Batch average</p>
                   <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={[
                            { name: 'My Score', score: attempt.marks },
                            { name: 'Batch Avg', score: batchAverageScore },
                            { name: 'Topper', score: topperDetails ? topperDetails.marks : highestScore }
                          ]}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                           <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                           <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                           <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                           <Tooltip 
                             contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                             formatter={(value: any) => [`${Number(value).toFixed(1)} M`, 'Score']}
                           />
                           <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                             <Cell fill="#6366f1" />
                             <Cell fill="#cbd5e1" />
                             <Cell fill="#f59e0b" />
                           </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             </div>

             {/* 4. DETAILED TIME ANALYSIS CARD */}
             <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm mt-6">
                <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <Clock className="w-4.5 h-4.5 text-indigo-500" /> Detailed Time-spent Analysis
                </h3>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-5">Average time spent per question outcome</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col items-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" />
                      <span className="text-[9px] font-black text-emerald-800 uppercase">Correct Questions</span>
                      <span className="text-xl font-black text-slate-800 mt-1">{timeAnalysis.avgTimeCorrect}s</span>
                      <span className="text-[8px] text-slate-400 mt-1 uppercase font-semibold">avg time / question</span>
                   </div>

                   <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex flex-col items-center">
                      <XCircle className="w-6 h-6 text-rose-500 mb-2" />
                      <span className="text-[9px] font-black text-rose-800 uppercase">Incorrect Questions</span>
                      <span className="text-xl font-black text-slate-800 mt-1">{timeAnalysis.avgTimeWrong}s</span>
                      <span className="text-[8px] text-slate-400 mt-1 uppercase font-semibold">avg time / question</span>
                   </div>

                   <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center">
                      <MinusCircle className="w-6 h-6 text-slate-400 mb-2" />
                      <span className="text-[9px] font-black text-slate-500 uppercase">Skipped Questions</span>
                      <span className="text-xl font-black text-slate-800 mt-1">{timeAnalysis.avgTimeSkipped}s</span>
                      <span className="text-[8px] text-slate-400 mt-1 uppercase font-semibold">avg time / question</span>
                   </div>
                </div>
             </div>

             {/* 5. TOPIC WISE ANALYSIS TABLE & PROGRESS */}
             <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm mt-6">
                <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <ListCollapse className="w-4.5 h-4.5 text-indigo-500" /> Topic-wise Performance Details
                </h3>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-5">Detailed analysis of accuracy and time distribution by topic</p>
                <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                      <thead>
                         <tr className="border-b border-slate-100 text-[10px] uppercase font-black text-slate-400">
                            <th className="pb-3 pl-2">Topic Name</th>
                            <th className="pb-3 text-center">Questions</th>
                            <th className="pb-3 text-center">Score</th>
                            <th className="pb-3 text-center">Time Spent</th>
                            <th className="pb-3 text-center">Accuracy</th>
                            <th className="pb-3 pr-2 text-right">Performance Bar</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60 text-xs">
                         {topicStats.map((stat, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                               <td className="py-3.5 pl-2 font-black text-slate-900">{stat.name}</td>
                               <td className="py-3.5 text-center font-mono font-bold text-slate-600">{stat.total}</td>
                               <td className="py-3.5 text-center font-bold text-slate-800">{stat.marks.toFixed(1)} <span className="text-[10px] text-slate-400">/{stat.maxMarks}</span></td>
                               <td className="py-3.5 text-center font-mono font-semibold text-slate-500">{formatTime(stat.timeSpent)}</td>
                               <td className="py-3.5 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                     stat.accuracy >= 75 ? 'bg-emerald-50 text-emerald-700' : stat.accuracy >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                                  }`}>
                                     {stat.accuracy.toFixed(0)}%
                                  </span>
                               </td>
                               <td className="py-3.5 pr-2 text-right w-36">
                                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full inline-block">
                                     <div 
                                        className={`h-full rounded-full ${
                                           stat.accuracy >= 75 ? 'bg-emerald-500' : stat.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${stat.accuracy}%` }}
                                     />
                                  </div>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>

             {/* 6. BENTO CARDS: STRONGEST & WEAKEST TOPICS */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Strongest Topics Card */}
                <div className="bg-emerald-50/20 border border-emerald-100/60 rounded-[2rem] p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                   <h3 className="font-black text-emerald-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-1.5">
                       <ThumbsUp className="w-4.5 h-4.5 text-emerald-600" /> Strongest Topics
                   </h3>
                   <p className="text-[10px] text-emerald-800/60 font-black uppercase tracking-wider mb-5">Topics with solid mastery (75%+ Accuracy)</p>
                   {strongestTopics.length > 0 ? (
                      <div className="space-y-3">
                         {strongestTopics.map((topic, idx) => (
                            <div key={idx} className="bg-white/80 p-3.5 rounded-xl border border-emerald-100 flex justify-between items-center">
                               <span className="font-bold text-slate-800 text-xs">{topic.name}</span>
                               <span className="font-black text-emerald-600 text-xs">{topic.accuracy.toFixed(0)}% Accuracy</span>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="p-4 bg-white/40 border border-emerald-100 rounded-xl text-center text-xs text-emerald-800 font-bold leading-normal">
                         Keep working! Focus on thorough concept clearance to build topics in this zone.
                      </div>
                   )}
                </div>

                {/* Weakest Topics Card */}
                <div className="bg-rose-50/20 border border-rose-100/60 rounded-[2rem] p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                   <h3 className="font-black text-rose-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-1.5">
                       <ShieldAlert className="w-4.5 h-4.5 text-rose-600" /> Critical Focus Zones
                   </h3>
                   <p className="text-[10px] text-rose-800/60 font-black uppercase tracking-wider mb-5">Topics needing immediate remedial review (&lt;60% Accuracy)</p>
                   {weakestTopics.length > 0 ? (
                      <div className="space-y-3">
                         {weakestTopics.map((topic, idx) => (
                            <div key={idx} className="bg-white/80 p-3.5 rounded-xl border border-rose-100 flex justify-between items-center">
                               <span className="font-bold text-slate-800 text-xs">{topic.name}</span>
                               <span className="font-black text-rose-600 text-xs">{topic.accuracy.toFixed(0)}% Accuracy</span>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="p-4 bg-white/40 border border-rose-100 rounded-xl text-center text-xs text-rose-850 font-bold">
                         Outstanding! None of your topics have critical low accuracy.
                      </div>
                   )}
                </div>
             </div>

             {/* 7. RECOMMENDED TOPICS FOR IMPROVEMENT */}
             <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-950 text-white rounded-[2rem] p-6 border border-white/10 shadow-xl relative overflow-hidden mt-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <h3 className="font-black text-indigo-300 text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4.5 h-4.5 text-yellow-300" /> Dynamic Actionable recommendations
                </h3>
                <p className="text-[10px] text-indigo-200/60 font-black uppercase tracking-wider mb-5">AI-powered preparation strategy generated from your attempt analytics</p>
                {recommendedTopics.length > 0 ? (
                   <div className="space-y-3">
                      {recommendedTopics.slice(0, 3).map((topic, idx) => (
                         <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                               <h4 className="font-black text-sm text-white">{topic.name}</h4>
                               <p className="text-[11px] text-indigo-200/80 mt-1 leading-relaxed">
                                  Your accuracy stands at <strong className="text-rose-400 font-black">{topic.accuracy.toFixed(0)}%</strong>. 
                                  {topic.accuracy < 40 
                                     ? " Re-watch core video lectures, clarify basic formula application, and take untimed topic tests." 
                                     : " Practice previous year question bank sets and mark key errors in your mistake notebook."
                                  }
                               </p>
                            </div>
                            <div className="shrink-0">
                               <button 
                                 onClick={() => {
                                    toast.success(`Redirecting to remedial resources for: ${topic.name}`);
                                 }}
                                 className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] uppercase font-black tracking-wider transition-colors"
                               >
                                  Study Topic
                               </button>
                            </div>
                         </div>
                      ))}
                   </div>
                ) : (
                   <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center text-xs text-indigo-200">
                      Excellent job! You have cleared all targets perfectly. Continue tracking accuracy in full tests.
                   </div>
                )}
             </div>
            </div>
          )}

          {/* TAB 3: LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
              <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" /> Test Leaderboard
                  </h4>
                  
                  {/* Filter tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                      onClick={() => setLeaderboardFilter('all')}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                        leaderboardFilter === 'all' ? 'bg-white shadow-sm text-indigo-600 font-extrabold' : 'text-slate-500'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setLeaderboardFilter('batch')}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                        leaderboardFilter === 'batch' ? 'bg-white shadow-sm text-indigo-600 font-extrabold' : 'text-slate-500'
                      }`}
                    >
                      My Batch
                    </button>
                    <button
                      onClick={() => setLeaderboardFilter('premium')}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                        leaderboardFilter === 'premium' ? 'bg-white shadow-sm text-indigo-600 font-extrabold' : 'text-slate-500'
                      }`}
                    >
                      Elite
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 font-black text-slate-400 uppercase tracking-wider text-[10px] select-none">
                        <th className="p-4 text-center">Rank</th>
                        <th className="p-4">Student</th>
                        <th className="p-4">Batch ID</th>
                        <th className="p-4 text-center">Score Marks</th>
                        <th className="p-4 text-center">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredAttemptsList.map((item, idx) => {
                        const isElite = item.isPremium || item.category === 'Elite';
                        return (
                          <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-4 text-center select-none font-black text-slate-700">
                              <span className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center mx-auto ${
                                idx === 0 ? 'bg-amber-100 text-amber-700' :
                                idx === 1 ? 'bg-slate-200 text-slate-800' :
                                idx === 2 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                              }`}>
                                #{idx + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {item.userPhotoURL ? (
                                  <img src={item.userPhotoURL} alt={item.userName} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs select-none">
                                    {item.userName ? item.userName[0].toUpperCase() : 'S'}
                                  </div>
                                )}
                                <div>
                                  <span className="font-extrabold text-slate-800 block truncate">{item.userName}</span>
                                  <span className="text-[9px] font-bold text-indigo-650 uppercase">
                                    {isElite ? '★ Elite Tier' : 'Standard Tier'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-[10px] font-extrabold text-slate-500 border border-slate-150 px-2 py-0.5 rounded-md uppercase select-none">
                                {item.batchId || 'Aspirants'}
                              </span>
                            </td>
                            <td className="p-4 text-center font-black">
                              <span className={`text-sm ${item.marks >= test.passingMarks ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {item.marks}
                              </span>
                              <span className="text-[10px] text-slate-400">/{test.maximumMarks}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="font-black text-slate-700">{(item.percentage ?? 0).toFixed(0)}%</span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredAttemptsList.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-xs font-bold text-slate-400">
                            No leaderboard positions recorded for this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

         {/* TAB 2: SOLUTIONS & EXPLANATIONS */}
         {activeTab === 'solutions' && (
           <div className="max-w-3xl mx-auto space-y-4 pb-20">
             {/* Navigation Controls */}
             <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
               <button 
                 onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                 disabled={currentQuestionIdx === 0}
                 className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 disabled:opacity-50"
               >
                 <ChevronLeft className="w-5 h-5" />
               </button>
               <div className="flex flex-col items-center gap-2">
                 <span className="text-sm font-black text-slate-900">Q{currentQuestionIdx + 1} of {test.questions.length}</span>
                 <div className="flex items-center gap-2">
                   <div className="flex bg-slate-100 p-1 rounded-lg">
                     <button
                       onClick={() => setLanguage('en')}
                       className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${language === 'en' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                       EN
                     </button>
                     <button
                       onClick={() => setLanguage('bn')}
                       className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${language === 'bn' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                       BN
                     </button>
                   </div>
                   <button
                     onClick={() => triggerPrint(`Q${currentQuestionIdx + 1}. ${test.title}`, `Solution Report`)}
                     className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                     title="Print Solution"
                   >
                     <Printer className="w-4 h-4" />
                   </button>
                 </div>
               </div>
               <button 
                 onClick={() => setCurrentQuestionIdx(prev => Math.min(test.questions.length - 1, prev + 1))}
                 disabled={currentQuestionIdx === test.questions.length - 1}
                 className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 disabled:opacity-50"
               >
                 <ChevronRight className="w-5 h-5" />
               </button>
             </div>

             {[test.questions[currentQuestionIdx]].map((q, i) => {
                const idx = currentQuestionIdx;
               const ans = attempt.answers?.[q.id];
               let isCorrect = false;
               let isSkipped = !ans || !ans.value || (Array.isArray(ans.value) && ans.value.length === 0);
               
               if (!isSkipped && (q.type === 'MCQ' || q.type === 'MSQ')) {
                 if (Array.isArray(ans.value)) {
                   isCorrect = !!q.correctAnswers && q.correctAnswers.length === ans.value.length && q.correctAnswers.every(v => (ans.value as string[]).includes(v));
                 } else if (q.correctAnswers && q.correctAnswers.length > 0) {
                   isCorrect = String(ans.value) === String(q.correctAnswers[0]);
                 }
               } else if (!isSkipped && q.type === 'Integer') {
                 isCorrect = !!q.correctAnswers && String(ans.value) === String(q.correctAnswers[0]);
               } else if (!isSkipped && (q.type === 'Subjective' || q.type === 'Paragraph')) {
                 isCorrect = (ans.marksAwarded || 0) > 0;
               }

               return (
                 <div id="printable-solution-root" key={`${q.id || 'q'}-${idx}`} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="flex justify-between items-start mb-3">
                     <div className="flex items-center space-x-2">
                       <span className="text-sm font-bold text-slate-900">Q{idx + 1}.</span>
                       {isSkipped ? (
                         <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Skipped</span>
                       ) : isCorrect ? (
                         <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center"><Check className="w-3 h-3 mr-0.5"/> Correct</span>
                       ) : (
                         <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center"><X className="w-3 h-3 mr-0.5"/> Wrong</span>
                       )}
                     </div>
                     <span className="text-xs font-bold text-slate-500">{ans?.marksAwarded || 0} / {q.points} pt</span>
                   </div>
                   
                   <div className="text-slate-800 text-sm mb-4 leading-relaxed"><MathRenderer content={language === 'bn' && q.text_bn ? q.text_bn : q.text} formula_latex={q.formula_latex} /></div>                    <MathDiagram metadata={q.diagramMetadata} diagram_svg={q.diagram_svg} />

                   {/* Question Images */}
                   {(q.imageUrls || (q.imageUrl ? [q.imageUrl] : [])).length > 0 && (
                     <div className="flex flex-wrap gap-2 mb-4">
                       {(q.imageUrls || (q.imageUrl ? [q.imageUrl] : [])).map((url, i) => (
                         <img key={i} src={url} className="w-20 h-20 object-cover rounded-xl border border-slate-200 cursor-pointer" onClick={() => window.open(url, '_blank')} referrerPolicy="no-referrer" />
                       ))}
                     </div>
                   )}
                   
                   <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-250/60">
                     <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 text-center select-none">Your Answer</div>
                     
                     {(q.type === 'MCQ' || q.type === 'MSQ') && (
                        isSkipped ? <div className="text-sm text-slate-500 italic text-center">Not answered</div> :
                        q.options?.map((originalOpt, i) => {
                          const opt = (language === 'bn' && q.options_bn?.length) ? q.options_bn[i] : originalOpt;
                          const isSelected = Array.isArray(ans.value) ? ans.value.includes(String(i)) : ans.value === String(i);
                          const isActualCorrect = q.correctAnswers?.includes(String(i));
                          
                          if (!isSelected && !isActualCorrect) return null;
                          
                          return (
                            <div key={i} className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                               isActualCorrect && isSelected ? 'bg-emerald-50 border-emerald-250 text-emerald-800 font-semibold' :
                               isSelected && !isActualCorrect ? 'bg-rose-50 border-rose-200 text-rose-800' :
                               isActualCorrect && !isSelected ? 'bg-emerald-50/50 border-emerald-200/50 text-emerald-700 border-dashed' : ''
                            }`}>
                              <span className="flex-1 text-left"><MathRenderer content={opt} /></span>
                              {isActualCorrect ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-rose-500" />}
                            </div>
                          )
                        })
                     )}

                     {q.type === 'Integer' && (
                       <div className="text-center">
                         {isSkipped ? <div className="text-sm text-slate-500 italic">Not answered</div> : (
                           <div className={`text-lg font-mono font-bold ${isCorrect ? 'text-emerald-600' : 'text-rose-500'}`}>{ans.value}</div>
                         )}
                         {!isCorrect && (
                           <div className="mt-2 text-xs font-semibold text-slate-500">Correct Value: <span className="text-emerald-600">{q.correctAnswers?.[0]}</span></div>
                         )}
                       </div>
                     )}

                     {(q.type === 'Subjective' || q.type === 'Paragraph') && (
                       <div>
                         {isSkipped ? <div className="text-sm text-slate-500 italic text-center">Not answered</div> : (
                           <div className="text-sm text-slate-700 whitespace-pre-wrap">{ans.value}</div>
                         )}
                         {ans?.evaluatorRemarks && (
                           <div className="mt-3 p-3 bg-amber-50 rounded-lg text-sm border border-amber-100">
                             <span className="font-bold text-amber-800 uppercase text-[10px] block mb-1">Evaluator Remark</span>
                             {ans.evaluatorRemarks}
                           </div>
                         )}
                       </div>
                     )}
                   </div>

                   {/* Multimedia Solution Display */}
                   {(q.solution || q.explanation || (q.stepwiseSolution && q.stepwiseSolution.length > 0)) && (
                     <div className="mt-6 border-t border-slate-100 pt-6 print-avoid-break">
                        <div className="flex items-center space-x-2 mb-4">
                           <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                             <Lightbulb className="w-4 h-4 text-indigo-600" />
                           </div>
                           <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Multimedia Solved Details</h4>
                        </div>
                        <div className="space-y-6">

                                 {/* Custom Parsed Solution Details */}
                            {(q.ruleOrTheorem || q.ruleOrTheorem_bn) && (
                              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-4 print-avoid-break">
                                <div className="flex items-center text-purple-700 font-bold text-[10px] uppercase mb-2">
                                  <Shield className="w-3" /> Rule / Theorem
                                </div>
                                <div className="text-purple-900 text-xs leading-relaxed"><MathRenderer content={language === 'bn' && q.ruleOrTheorem_bn ? q.ruleOrTheorem_bn : (q.ruleOrTheorem || '')} /></div>
                              </div>
                            )}
                            {(q.examApproach || q.examApproach_bn) && (
                              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4 print-avoid-break">
                                <div className="flex items-center text-amber-700 font-bold text-[10px] uppercase mb-2">
                                  <Zap className="w-3" /> Exam Approach / Shortcut
                                </div>
                                <div className="text-amber-900 text-xs leading-relaxed"><MathRenderer content={language === 'bn' && q.examApproach_bn ? q.examApproach_bn : (q.examApproach || '')} /></div>
                              </div>
                            )}

                            {(language === 'bn' && q.stepwiseSolution_bn?.length ? q.stepwiseSolution_bn : q.stepwiseSolution)?.length > 0 && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Step-by-Step Solution</label>
                                <div className="space-y-2">
                                  {(language === 'bn' && q.stepwiseSolution_bn?.length ? q.stepwiseSolution_bn : q.stepwiseSolution).map((step, idx) => (
                                    <div key={idx} className="flex gap-2 text-sm text-slate-700 leading-relaxed print-avoid-break">
                                      <span className="font-black text-slate-400">{idx + 1}.</span>
                                      <MathRenderer content={step} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                           {/* Solution Text */}
                           {q.solution?.text?.short && (
                             <div className="bg-indigo-50 p-4 rounded-xl border-l-4 border-l-indigo-500">
                               <div className="text-indigo-950 text-sm font-semibold leading-relaxed"><MathRenderer content={q.solution.text.short} /></div>
                             </div>
                           )}

                           {q.solution?.text?.detailed && (
                             <div>
                               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Detailed Steps</label>
                               <div className="text-slate-700 text-sm leading-relaxed"><MathRenderer content={q.solution.text.detailed} /></div>
                             </div>
                           )}

                           {(q.solution?.text?.tips || q.solution?.text?.mistakes) && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {q.solution?.text?.tips && (
                                 <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                   <div className="flex items-center text-emerald-700 font-bold text-[10px] uppercase mb-2">
                                     <Star className="w-3" /> Mentor Tip
                                   </div>
                                   <p className="text-emerald-800 text-xs leading-relaxed">{q.solution.text.tips}</p>
                                 </div>
                               )}
                               {q.solution?.text?.mistakes && (
                                 <div className="bg-rose-50 p-4 rounded-xl border border-rose-150">
                                   <div className="flex items-center text-rose-700 font-bold text-[10px] uppercase mb-2">
                                     <ShieldAlert className="w-3" /> Common Mistake
                                   </div>
                                   <p className="text-rose-800 text-xs leading-relaxed">{q.solution.text.mistakes}</p>
                                 </div>
                               )}
                             </div>
                           )}

                           {/* YouTube url */}
                           {q.solution?.youtubeUrl && (
                             <InlineYoutubePlayer fallbackUrl={q.solution.youtubeUrl} embedAllowed={false} />
                           )}

                           {/* Audio play backup */}
                           {q.solution?.audioUrl && (
                             <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                               <div className="flex items-center mb-2">
                                  <Music className="w-4 h-4 text-indigo-600 mr-2" />
                                  <span className="text-xs font-bold text-indigo-800">Voice Explanation Node</span>
                               </div>
                               <audio controls src={q.solution.audioUrl} className="w-full h-8 outline-none" />
                             </div>
                           )}

                           {(language === 'bn' && q.stepwiseSolution_bn?.length ? q.stepwiseSolution_bn : q.stepwiseSolution)?.length > 0 ? (
                             <div>
                               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-3">Step-by-Step Details</label>
                               <div className="space-y-4">
                                 {(language === 'bn' && q.stepwiseSolution_bn?.length ? q.stepwiseSolution_bn : q.stepwiseSolution).map((step, sIdx, arr) => (
                                   <div key={sIdx} className="flex gap-4 print-avoid-break">
                                     <div className="flex flex-col items-center">
                                       <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0 z-10">
                                         {sIdx + 1}
                                       </div>
                                       {sIdx < arr.length - 1 && (
                                         <div className="w-px flex-1 bg-indigo-50 my-1" />
                                       )}
                                     </div>
                                     <div className="pb-4 text-slate-700 leading-relaxed text-sm">
                                       <MathRenderer content={step} />
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           ) : !q.solution && (q.explanation || q.explanation_bn) && (
                             <div>
                               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Explanation</label>
                               <div className="text-slate-700 text-sm leading-relaxed"><MathRenderer content={language === 'bn' && q.explanation_bn ? q.explanation_bn : (q.explanation || '')} /></div>
                             </div>
                           )}

                           {q.examApproach && (
                             <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                               <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-1">
                                 <Lightbulb className="w-3 h-3" /> Exam Approach / Shortcut
                               </label>
                               <div className="text-emerald-800 text-sm leading-relaxed"><MathRenderer content={q.examApproach} /></div>
                             </div>
                           )}

                           {q.ruleOrTheorem && (
                             <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                               <label className="block text-[10px] font-bold text-blue-600 uppercase mb-2 flex items-center gap-1">
                                 <BookOpen className="w-3 h-3" /> Rule / Theorem / Trick
                               </label>
                               <div className="text-blue-800 text-sm leading-relaxed"><MathRenderer content={q.ruleOrTheorem} /></div>
                             </div>
                           )}
                        </div>
                     </div>
                   )}
                 </div>
               );
             })}
           </div>
         )}

      </div>


      {/* Welcome Banner */}
      {showWelcomeBanner && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl sticky bottom-0 left-0 right-0 z-50">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 animate-pulse" />
            <div>
              <p className="font-bold text-sm">Welcome to MissionGrid Free! 🎉</p>
              <p className="text-xs opacity-90">All test metrics, solutions, and leaderboards are now fully unlocked for you.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/app/home')} 
            className="px-5 py-2.5 bg-white text-emerald-700 font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-emerald-50 transition-all shrink-0 cursor-pointer"
          >
            Go to Student Dashboard →
          </button>
        </div>
      )}
    </div>
  );
}
