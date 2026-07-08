import React, { useState, useEffect, useMemo } from 'react';
import { Test, TestAttempt } from '../../models/mission';
import { 
  ArrowLeft, Users, TrendingUp, Award, Clock, CheckCircle, XCircle, AlertCircle, 
  BarChart2, List, Calendar, Filter, Sparkles, UserCheck, UserMinus, ShieldCheck, 
  ChevronDown, BookOpen, Search, Star, AlertTriangle, HelpCircle, Mail, RotateCw, CheckCircle2,
  TrendingDown, FileText, ChevronRight
} from 'lucide-react';
import { onSnapshot, collection, query, where, doc, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatIST } from '../../utils/date';

interface Props {
  testId: string;
  onBack: () => void;
}

export default function TestAnalyticsView({ testId, onBack }: Props) {
  const [activeTestId, setActiveTestId] = useState<string>(testId);
  const [test, setTest] = useState<Test | null>(null);
  const [allTests, setAllTests] = useState<Test[]>([]);
  const [rawAttempts, setRawAttempts] = useState<TestAttempt[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [uidToUser, setUidToUser] = useState<Record<string, any>>({});
  const [batches, setBatches] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const resolveBatchDisplayField = (rawId: string) => {
    if (!rawId) return 'General';
    const matching = batches[rawId];
    return matching ? (matching.batchName || matching.batchCode || rawId) : rawId;
  };
  
  // Custom headers dropdown
  const [showTestDropdown, setShowTestDropdown] = useState(false);

  // Tabs navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'insights' | 'leaderboard'>('overview');

  // Advanced Filters states for Mentor Leaderboard
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedPremium, setSelectedPremium] = useState<'all' | 'premium' | 'regular'>('all');
  const [selectedPerf, setSelectedPerf] = useState<'all' | 'top' | 'low'>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [showNotAttemptedOnly, setShowNotAttemptedOnly] = useState<boolean>(false);

  // 1. Fetch all tests to populate Test Switcher (one-time fetch)
  useEffect(() => {
    const fetchTests = async () => {
      try {
        const snap = await getDocs(collection(db, 'tests'));
        const tests = snap.docs.map(d => ({ id: d.id, ...d.data() } as Test));
        setAllTests(tests);
      } catch (err) {
        console.error("Error fetching tests:", err);
      }
    };
    fetchTests();
  }, []);

  // 2. Fetch user profiles and batches based on attempts
  useEffect(() => {
    const fetchData = async () => {
      if (rawAttempts.length === 0) return;
      
      try {
        // Fetch batches (one-time is fine, usually not many)
        const bSnap = await getDocs(collection(db, 'batches'));
        const bMap: Record<string, any> = {};
        bSnap.docs.forEach(d => {
          bMap[d.id] = { id: d.id, ...d.data() };
        });
        setBatches(bMap);

        // Fetch ONLY users who have attempts
        const uniqueUserIds = Array.from(new Set(rawAttempts.map(a => a.userId)));
        const uMap: Record<string, any> = {};
        const uidMap: Record<string, any> = {};

        // Firestore 'in' query limit is 30, so chunk them
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
  }, [rawAttempts]);

  // 3. Subscribe to test details and attempts dynamically based on activeTestId
  useEffect(() => {
    setLoading(true);
    const unsubTest = onSnapshot(doc(db, 'tests', activeTestId), (snap) => {
      if (snap.exists()) {
        setTest({ id: snap.id, ...snap.data() } as Test);
      }
    }, (err) => {
      console.warn("TestAnalyticsView: Failed to subscribe to test document in real-time:", err);
    });

    const qAttempts = query(collection(db, 'test_attempts'), where('testId', '==', activeTestId));
    const unsubAttempts = onSnapshot(qAttempts, (snap) => {
      const atts = snap.docs.map(d => ({ id: d.id, ...d.data() } as TestAttempt));
      setRawAttempts(atts);
      setLoading(false);
    }, (err) => {
      console.error("Error reading attempts real-time snapshot:", err);
      setLoading(false);
    });

    return () => {
      unsubTest();
      unsubAttempts();
    };
  }, [activeTestId]);

  // Format Helper
  const formatTime = (seconds: number) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // 4. Clean Vectorized in-memory Memo calculations for total sync!
  const dataEngine = useMemo(() => {
    // A. Bind UIDs to public collection (uidToUser is already mapped by UID in the effect)
    
    // B. Enrich all attempts lists with 100% current user profiles
    const enriched = rawAttempts.map(att => {
      let uData = att.userId ? (uidToUser[att.userId] || users[att.userId]) : null;
      const rawBatchId = uData?.batchId || att.batchId || '';
      const displayBatch = resolveBatchDisplayField(rawBatchId);

      if (uData) {
        return {
          ...att,
          userName: uData.name || att.userName || 'Candidate',
          userPhotoURL: uData.photoUrl || att.userPhotoURL || '',
          batchId: displayBatch,
          category: uData.category || 'Review Category',
          isPremium: uData.isPremium || uData.category === 'Elite' || att.isPremium || false
        };
      }
      return {
        ...att,
        userName: att.userName || 'Candidate',
        batchId: displayBatch,
        isPremium: (att as any).category === 'Elite' || att.isPremium || false
      };
    });

    // C. Find all distinct batches present across our users and attempts
    const batchesSet = new Set<string>();
    enriched.forEach(e => { if (e.batchId) batchesSet.add(e.batchId); });
    (Object.values(users) as any[]).forEach(u => {
      if (u.role === 'student' || u.role === 'aspirant') {
        batchesSet.add(resolveBatchDisplayField(u.batchId));
      }
    });
    const allBatches = Array.from(batchesSet).sort();

    // D. Isolate active attempts (submitted or evaluated) & sort to assign Ranks and Percentiles
    const activeAttempts = enriched
      .filter(a => a.status === 'evaluated' || a.status === 'submitted')
      .sort((a,b) => {
        const scoreDiff = (b.marks || 0) - (a.marks || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.timeTaken || 0) - (b.timeTaken || 0);
      });

    // Assign Rank and Percentile
    const totalR = activeAttempts.length;
    activeAttempts.forEach((att, idx) => {
      att.rank = idx + 1;
      att.percentile = totalR > 0 ? ((totalR - idx) / totalR) * 100 : 0;
    });

    // Mirror ranks and percentiles back to enriched collection
    const rankMap: Record<string, number> = {};
    activeAttempts.forEach(att => {
      rankMap[att.id] = att.rank || 1;
    });
    enriched.forEach(att => {
      if (rankMap[att.id]) {
        att.rank = rankMap[att.id];
        att.percentile = totalR > 0 ? ((totalR - (rankMap[att.id] - 1)) / totalR) * 100 : 0;
      }
    });

    // E. Global Statistics Overview calculations
    const uniqueParticipants = new Set(enriched.map(a => a.userId)).size;
    const totalAttempts = rawAttempts.length;

    const scores = activeAttempts.map(a => a.marks || 0);
    const averageScoreVal = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
    const peakScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    const completedCount = rawAttempts.filter(a => a.status === 'evaluated' || a.status === 'submitted').length;
    const compRate = totalAttempts > 0 ? (completedCount / totalAttempts) * 100 : 0;

    // F. Question Difficulty Analysis engine
    const questionStats: Record<string, {
      correctAttempts: number;
      wrongAttempts: number;
      skippedAttempts: number;
      submissions: number;
      accuracy: number;
    }> = {};

    if (test?.questions) {
      test.questions.forEach(q => {
        questionStats[q.id] = { correctAttempts: 0, wrongAttempts: 0, skippedAttempts: 0, submissions: 0, accuracy: 0 };
      });

      activeAttempts.forEach(a => {
        if (!a.answers) return;
        test.questions.forEach(q => {
          const ans = a.answers[q.id];
          if (ans) {
            if ((ans.marksAwarded || 0) > 0) {
              questionStats[q.id].correctAttempts++;
            } else if ((ans.marksAwarded || 0) < 0 || ans.value) {
              questionStats[q.id].wrongAttempts++;
            } else {
              questionStats[q.id].skippedAttempts++;
            }
          } else {
            questionStats[q.id].skippedAttempts++;
          }
        });
      });

      test.questions.forEach(q => {
        const stats = questionStats[q.id];
        stats.submissions = stats.correctAttempts + stats.wrongAttempts + stats.skippedAttempts;
        stats.accuracy = stats.submissions > 0 ? (stats.correctAttempts / stats.submissions) * 100 : 0;
      });
    }

    // Classify difficulty metrics
    let easyCount = 0, mediumCount = 0, hardCount = 0;
    const difficultyMap: Record<string, 'Easy' | 'Medium' | 'Hard'> = {};
    if (test?.questions) {
      test.questions.forEach(q => {
        const accuracy = questionStats[q.id]?.accuracy || 0;
        if (accuracy > 70) {
          easyCount++;
          difficultyMap[q.id] = 'Easy';
        } else if (accuracy >= 40) {
          mediumCount++;
          difficultyMap[q.id] = 'Medium';
        } else {
          hardCount++;
          difficultyMap[q.id] = 'Hard';
        }
      });
    }

    // Top 3 hardest questions (ordered by accuracy ascending)
    const sortedQuestionsByDifficulty = test?.questions ? [...test.questions].sort((a,b) => {
      const accA = questionStats[a.id]?.accuracy || 0;
      const accB = questionStats[b.id]?.accuracy || 0;
      return accA - accB;
    }) : [];

    const hardestQuestions = sortedQuestionsByDifficulty.slice(0, 3);

    // G. Dynamic Cohort insights engine
    const bestAttemptByStudent: Record<string, typeof enriched[0]> = {};
    activeAttempts.forEach(att => {
      const existing = bestAttemptByStudent[att.userId];
      if (!existing || (att.marks || 0) > (existing.marks || 0)) {
        bestAttemptByStudent[att.userId] = att;
      }
    });
    const uniqueStudentBestAttempts = Object.values(bestAttemptByStudent);

    // 1. Top 10 Students (based on high score)
    const top10 = [...uniqueStudentBestAttempts].sort((a,b) => (b.marks || 0) - (a.marks || 0)).slice(0, 10);

    // 2. Bottom 10 Students
    const bottom10 = [...uniqueStudentBestAttempts].sort((a,b) => (a.marks || 0) - (b.marks || 0)).slice(0, 10);

    // Grouping attempts representing history
    const studentAttemptsListMatched: Record<string, typeof enriched> = {};
    enriched.forEach(att => {
      if (!studentAttemptsListMatched[att.userId]) studentAttemptsListMatched[att.userId] = [];
      studentAttemptsListMatched[att.userId].push(att);
    });

    // 3. Most Improved: (score difference > 0 from first attempt to last attempt)
    const improvedList: { student: any, firstScore: number, lastScore: number, improvement: number }[] = [];
    Object.keys(studentAttemptsListMatched).forEach(uid => {
      const attsSorted = studentAttemptsListMatched[uid]
        .filter(a => a.status === 'evaluated' || a.status === 'submitted')
        .sort((a,b) => a.attemptNumber - b.attemptNumber);
      if (attsSorted.length > 1) {
        const first = attsSorted[0];
        const last = attsSorted[attsSorted.length - 1];
        const diff = (last.marks || 0) - (first.marks || 0);
        if (diff > 0) {
          const profile = uidToUser[uid] || users[uid];
          const resolvedStudent = profile ? {
            ...profile,
            name: profile.name || profile.displayName || 'Candidate',
            batchId: resolveBatchDisplayField(profile.batchId)
          } : {
            name: first.userName || 'Candidate',
            photoUrl: first.userPhotoURL || '',
            batchId: resolveBatchDisplayField(first.batchId)
          };
          improvedList.push({
            student: resolvedStudent,
            firstScore: first.marks || 0,
            lastScore: last.marks || 0,
            improvement: diff
          });
        }
      }
    });
    const sortedImproved = improvedList.sort((a,b) => b.improvement - a.improvement).slice(0, 10);

    // 4. Consistent Performers (score deviation <= 5 and average marks >= cutoff or reasonably high score)
    const consistentList: { student: any, avgScore: number, stdDev: number, attemptsCount: number }[] = [];
    Object.keys(studentAttemptsListMatched).forEach(uid => {
      const atts = studentAttemptsListMatched[uid]
        .filter(a => a.status === 'evaluated' || a.status === 'submitted');
      if (atts.length >= 2) {
        const scoresMatched = atts.map(a => a.marks || 0);
        const avg = scoresMatched.reduce((a, b) => a + b, 0) / scoresMatched.length;
        const variance = scoresMatched.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scoresMatched.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev <= 5 && avg >= (test?.passingMarks || 0)) {
          const profile = uidToUser[uid] || users[uid];
          const resolvedStudent = profile ? {
            ...profile,
            name: profile.name || profile.displayName || 'Candidate',
            batchId: resolveBatchDisplayField(profile.batchId)
          } : {
            name: atts[0].userName || 'Candidate',
            photoUrl: atts[0].userPhotoURL || '',
            batchId: resolveBatchDisplayField(atts[0].batchId)
          };
          consistentList.push({
            student: resolvedStudent,
            avgScore: avg,
            stdDev,
            attemptsCount: atts.length
          });
        }
      }
    });
    const sortedConsistent = consistentList.sort((a,b) => b.avgScore - a.avgScore).slice(0, 10);

    // 5. Students Requiring Attention (score < cutoff OR hasn't attempted yet)
    const attentionList: { student: any, bestScore: number, attemptsCount: number, reason: string }[] = [];
    uniqueStudentBestAttempts.forEach(att => {
      if ((att.marks || 0) < (test?.passingMarks || 0)) {
        const profile = uidToUser[att.userId] || users[att.userId];
        const resolvedStudent = profile ? {
          ...profile,
          name: profile.name || profile.displayName || 'Candidate',
          batchId: resolveBatchDisplayField(profile.batchId)
        } : {
          name: att.userName || 'Candidate',
          photoUrl: att.userPhotoURL || '',
          batchId: resolveBatchDisplayField(att.batchId)
        };
        attentionList.push({
          student: resolvedStudent,
          bestScore: att.marks || 0,
          attemptsCount: studentAttemptsListMatched[att.userId]?.length || 1,
          reason: `Obtained score (${att.marks} / ${test?.passingMarks || 0}) is below cutoff limit.`
        });
      }
    });

    return {
      enrichedAttempts: enriched,
      uniqueParticipants,
      totalAttempts,
      averageScore: averageScoreVal,
      maxScore: peakScore,
      minScore: lowestScore,
      completionRate: compRate,
      questionStats,
      difficultySummary: { easyCount, mediumCount, hardCount, difficultyMap, hardestQuestions },
      insights: {
        top10,
        bottom10,
        improved: sortedImproved,
        consistent: sortedConsistent,
        attention: attentionList
      },
      allBatches
    };
  }, [rawAttempts, users, uidToUser, batches, test]);

  // 5. Advanced filters handler mapped to the Leaderboard Tab
  const processedLeaderboardAndNotAttempted = useMemo(() => {
    // Collect all students role profiles from users
    const allStudentsList = (Object.values(users) as any[]).filter(u => u.role === 'student' || u.role === 'aspirant');

    // Case 1: Filter to show "Not Attempted" students only
    if (showNotAttemptedOnly) {
      const attemptedUserIds = new Set(rawAttempts.map(a => a.userId));
      const notAttempted = allStudentsList.filter(s => !attemptedUserIds.has(s.id));

      // Filter by Batch if selected
      const filteredNotAttempted = selectedBatch === 'all' 
        ? notAttempted 
        : notAttempted.filter(s => s.batchId === selectedBatch);

      // Filter by Premium if selected
      const finalNotAttempted = selectedPremium === 'all'
        ? filteredNotAttempted
        : selectedPremium === 'premium'
          ? filteredNotAttempted.filter(s => s.category === 'Elite' || s.isPremium)
          : filteredNotAttempted.filter(s => s.category !== 'Elite' && !s.isPremium);

      return {
        leaderboardData: finalNotAttempted.map(s => ({
          id: s.id,
          userId: s.id,
          userName: s.name || 'Candidate',
          userPhotoURL: s.photoUrl || '',
          batchId: resolveBatchDisplayField(s.batchId),
          marks: 0,
          rank: 0,
          percentile: 0,
          percentage: 0,
          timeTaken: 0,
          submittedAt: '',
          status: 'not_attempted',
          improvementFromPrevious: 0,
          category: s.category || 'Standard'
        })),
        isNotAttemptedGroup: true
      };
    }

    // Case 2: Apply multi-layered filters on enriched attempts
    let data = [...dataEngine.enrichedAttempts].filter(a => a.status === 'submitted' || a.status === 'evaluated');

    // Filter A: Batch
    if (selectedBatch !== 'all') {
      data = data.filter(a => a.batchId === selectedBatch);
    }

    // Filter B: Premium Status (Elite / isPremium)
    if (selectedPremium !== 'all') {
      data = selectedPremium === 'premium'
        ? data.filter(a => a.isPremium || a.category === 'Elite')
        : data.filter(a => !a.isPremium && a.category !== 'Elite');
    }

    // Filter C: Performance Index
    if (selectedPerf !== 'all') {
      const testMaxMarkVal = test?.maximumMarks || 100;
      data = selectedPerf === 'top'
        ? data.filter(a => ((a.marks || 0) / testMaxMarkVal) >= 0.8)
        : data.filter(a => ((a.marks || 0) / testMaxMarkVal) < 0.5);
    }

    // Filter D: Date Range
    if (selectedDateRange !== 'all') {
      const now = new Date();
      data = data.filter(a => {
        if (!a.submittedAt) return false;
        const subDate = new Date(a.submittedAt);
        const dayDiff = (now.getTime() - subDate.getTime()) / (1000 * 3600 * 24);
        
        if (selectedDateRange === 'today') {
          return subDate.toDateString() === now.toDateString();
        } else if (selectedDateRange === '7days') {
          return dayDiff <= 7;
        } else if (selectedDateRange === '30days') {
          return dayDiff <= 30;
        }
        return true;
      });
    }

    // Sort the final filtered dataset
    data.sort((a,b) => {
      const scoreDiff = (b.marks || 0) - (a.marks || 0);
      if (scoreDiff !== 0) return scoreDiff;
      
      // Prioritize first attempt
      const attemptDiff = (a.attemptNumber || 1) - (b.attemptNumber || 1);
      if (attemptDiff !== 0) return attemptDiff;

      return (a.timeTaken || 0) - (b.timeTaken || 0);
    });

    return {
      leaderboardData: data,
      isNotAttemptedGroup: false
    };

  }, [dataEngine.enrichedAttempts, users, rawAttempts, selectedBatch, selectedPremium, selectedPerf, selectedDateRange, showNotAttemptedOnly, test, batches]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col items-center justify-center p-6 text-center">
        <RotateCw className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
        <h3 className="font-extrabold text-slate-900 text-sm">Aggregating Statistics</h3>
        <p className="text-xs text-slate-400 mt-1">Recalculating score metrics, question difficulty, and insights...</p>
      </div>
    );
  }

  if (!test) return <div className="p-8 text-center text-sm font-bold text-slate-500">Selected Test not found.</div>;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col pt-[env(safe-area-inset-top)] overflow-x-hidden">
      {/* HEADER SECTION WITH SPECIFIC TEST SELECTOR */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shrink-0">
        <div className="flex items-center space-x-3 p-4">
           <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-600 transition-colors">
             <ArrowLeft className="w-5 h-5" />
           </button>
           <div className="flex-1 min-w-0 relative">
             <button 
               onClick={() => setShowTestDropdown(!showTestDropdown)} 
               className="flex items-center space-x-1 hover:bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-150 transition-all text-left w-full sm:max-w-md max-w-xs"
             >
               <div className="flex-1 truncate">
                 <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Active Analytics Test</h2>
                 <p className="text-sm font-extrabold text-slate-900 truncate mt-0.5">{test.title}</p>
               </div>
               <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
             </button>

             {/* Dynamic Test Switcher dropdown list */}
             {showTestDropdown && (
               <div className="absolute top-[110%] left-0 z-50 w-full sm:max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                 {allTests.map((tOption, idx) => (
                   <button 
                     key={`${tOption.id}-${idx}`} 
                     onClick={() => {
                       setActiveTestId(tOption.id);
                       setShowTestDropdown(false);
                     }}
                     className={`w-full p-3 text-left transition-colors flex items-center justify-between text-xs font-semibold ${tOption.id === activeTestId ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-700 hover:bg-slate-50'}`}
                   >
                     <span className="truncate pr-3">{tOption.title}</span>
                     {tOption.id === activeTestId && <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />}
                   </button>
                 ))}
               </div>
             )}
           </div>
        </div>

        {/* METAB NAVIGATION */}
        <div className="flex space-x-6 px-6 overflow-x-auto scrollbar-hide">
           <button onClick={() => { setActiveTab('overview'); setShowNotAttemptedOnly(false); }} className={`py-3 shrink-0 relative text-xs font-black uppercase tracking-wider transition-colors ${activeTab === 'overview' ? 'text-indigo-600' : 'text-slate-400 font-medium'}`}>
             Overview
             {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
           </button>
           <button onClick={() => { setActiveTab('questions'); setShowNotAttemptedOnly(false); }} className={`py-3 shrink-0 relative text-xs font-black uppercase tracking-wider transition-colors ${activeTab === 'questions' ? 'text-indigo-600' : 'text-slate-400 font-medium'}`}>
             Difficulty Analysis
             {activeTab === 'questions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
           </button>
           <button onClick={() => { setActiveTab('insights'); setShowNotAttemptedOnly(false); }} className={`py-3 shrink-0 relative text-xs font-black uppercase tracking-wider transition-colors ${activeTab === 'insights' ? 'text-indigo-600' : 'text-slate-400 font-medium'}`}>
             Performance Insights
             {activeTab === 'insights' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
           </button>
           <button onClick={() => { setActiveTab('leaderboard'); }} className={`py-3 shrink-0 relative text-xs font-black uppercase tracking-wider transition-colors ${activeTab === 'leaderboard' ? 'text-indigo-600' : 'text-slate-400 font-medium'}`}>
             Leaderboard
             {activeTab === 'leaderboard' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
           </button>
        </div>
      </div>

      {/* CORE DISPLAY WINDOW */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
         
         {/* TAB 1: OVERVIEW METRIC DEBRIS */}
         {activeTab === 'overview' && (
            dataEngine.totalAttempts === 0 ? (
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-150 text-center py-20 flex flex-col items-center justify-center max-w-lg mx-auto">
                 <TrendingUp className="w-12 h-12 text-slate-300 mb-3 animate-pulse" />
                 <h3 className="font-extrabold text-slate-900 text-sm">No Attempts Lodged</h3>
                 <p className="text-slate-400 text-xs max-w-xs mt-1 leading-relaxed">
                   Statistics will populate in real-time once students finalize attempts on this test. Current profile synchronizations are active.
                 </p>
               </div>
            ) : (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Stats bento layout */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-white p-4.5 rounded-[1.5rem] shadow-sm border border-slate-200">
                    <Users className="w-5 h-5 text-indigo-500 mb-2" />
                    <div className="text-2xl font-black text-slate-900">{dataEngine.uniqueParticipants}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Unique Participants</div>
                 </div>
                 <div className="bg-white p-4.5 rounded-[1.5rem] shadow-sm border border-slate-200">
                    <List className="w-5 h-5 text-emerald-500 mb-2" />
                    <div className="text-2xl font-black text-slate-900">{dataEngine.totalAttempts}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Attempts</div>
                 </div>
                 <div className="bg-white p-4.5 rounded-[1.5rem] shadow-sm border border-slate-200">
                    <Award className="w-5 h-5 text-amber-500 mb-2" />
                    <div className="text-2xl font-black text-slate-900">{dataEngine.averageScore.toFixed(1)}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Average Marks</div>
                 </div>
                 <div className="bg-white p-4.5 rounded-[1.5rem] shadow-sm border border-slate-200">
                    <Clock className="w-5 h-5 text-rose-500 mb-2" />
                    <div className="text-2xl font-black text-slate-900">{dataEngine.completionRate.toFixed(1)}%</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Completion Rate</div>
                 </div>
              </div>

              {/* Range & Dispersion panel */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                 <div className="text-center md:text-left">
                   <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Score Ranges achieved</h4>
                   <p className="text-slate-500 text-xs mt-1">High and low evaluated score indexes</p>
                 </div>
                 <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                   <span className="text-[10px] font-black text-emerald-700 uppercase">Highest Score Marks</span>
                   <span className="text-2xl font-black text-emerald-600 block mt-1">{dataEngine.maxScore} M</span>
                 </div>
                 <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl text-center">
                   <span className="text-[10px] font-black text-rose-700 uppercase">Lowest Score Marks</span>
                   <span className="text-2xl font-black text-rose-500 block mt-1">{dataEngine.minScore} M</span>
                 </div>
              </div>

              {/* Recent attempts sub-board */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Recent Evaluation Activity</h3>
                 </div>
                 <div className="divide-y divide-slate-100">
                    {dataEngine.enrichedAttempts.slice(0, 5).map((att, idx) => (
                       <div key={`${att.id}-${idx}`} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                             {att.userPhotoURL ? (
                               <img src={att.userPhotoURL} alt={att.userName} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                             ) : (
                               <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs select-none">
                                 {att.userName ? att.userName[0].toUpperCase() : 'S'}
                               </div>
                             )}
                             <div>
                                <div className="text-xs font-bold text-slate-800">{att.userName}</div>
                                <div className="text-[9px] text-slate-400 uppercase font-bold flex items-center gap-2 mt-0.5">
                                  <span>Batch: {att.batchId || 'Aspirants'}</span>
                                  <span>•</span>
                                  <span>{att.submittedAt ? formatIST(att.submittedAt) : 'N/A'}</span>
                                </div>
                             </div>
                          </div>
                          <div className="text-right">
                             <div className={`text-base font-black ${att.marks >= test.passingMarks ? 'text-emerald-600' : 'text-rose-505'}`}>
                                {att.marks}<span className="text-[10px] text-slate-400 ml-0.5">/{test.maximumMarks}</span>
                             </div>
                             <div className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-0.5">{att.status}</div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
            </div>
            )
         )}

         {/* TAB 2: DIFFICULTY ANALYSIS GROUP */}
         {activeTab === 'questions' && (
           <div className="space-y-6 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Difficulty segments summary */}
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm md:col-span-1 space-y-4">
                    <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider select-none">Difficulty Dispersion</h3>
                    <div className="space-y-3 pt-3">
                      <div className="flex justify-between items-center p-3 bg-red-50 border border-red-100 rounded-xl">
                        <span className="text-xs font-extrabold text-red-700">Hard Questions</span>
                        <span className="text-sm font-black text-red-600">{dataEngine.difficultySummary.hardCount}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <span className="text-xs font-extrabold text-amber-700">Medium Questions</span>
                        <span className="text-sm font-black text-amber-600">{dataEngine.difficultySummary.mediumCount}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <span className="text-xs font-extrabold text-emerald-700">Easy Questions</span>
                        <span className="text-sm font-black text-emerald-600">{dataEngine.difficultySummary.easyCount}</span>
                      </div>
                    </div>
                 </div>

                 {/* Top 3 hardest questions highlight */}
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm md:col-span-2 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1">
                         <AlertTriangle className="w-4 h-4 text-red-500" /> Toughest Class Knowledge Gaps
                       </h3>
                       <span className="text-[10px] font-bold text-slate-400">Low Accuracy Spotlight</span>
                    </div>

                    <div className="space-y-4">
                       {dataEngine.difficultySummary.hardestQuestions.map((q, idx) => {
                          const stat = dataEngine.questionStats[q.id] || { accuracy: 0 };
                          return (
                             <div key={`${q.id || 'gap'}-${idx}`} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                               <div className="min-w-0 flex-1">
                                 <span className="bg-red-100 text-red-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider select-none">GAP SPOT #{idx+1}</span>
                                 <p className="text-slate-800 text-xs font-bold truncate mt-1">{q.text}</p>
                                 <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Correct Option: Option {q.correctAnswers?.join(', ') || 'None'}</p>
                               </div>
                               <div className="text-right shrink-0">
                                 <span className="text-sm font-black text-red-500">{stat.accuracy.toFixed(0)}%</span>
                                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Class Accuracy</span>
                               </div>
                             </div>
                          );
                       })}
                       {dataEngine.difficultySummary.hardestQuestions.length === 0 && (
                          <div className="text-center py-6 text-xs text-slate-400 font-bold select-none">No evaluations recorded to isolate tough topics</div>
                       )}
                    </div>
                 </div>
              </div>

              {/* Complete Question Table */}
              <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
                 <div className="flex items-center space-x-2 mb-6">
                    <BarChart2 className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Question Wise evaluation reports</h3>
                 </div>
                 <div className="space-y-6">
                    {test.questions.map((q, idx) => {
                       const stat = dataEngine.questionStats[q.id] || { accuracy: 0, wrongAttempts: 0, correctAttempts: 0, skippedAttempts: 0, submissions: 0 };
                       return (
                          <div key={`${q.id || 'q'}-${idx}`} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                             <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 pr-4 min-w-0">
                                   <div className="flex items-center gap-2">
                                     <span className="text-[9px] font-black text-slate-400">Q{idx+1}</span>
                                     <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase select-none ${
                                       stat.accuracy > 70 ? 'bg-emerald-150/70 text-emerald-800' :
                                       stat.accuracy >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                     }`}>{stat.accuracy > 70 ? 'Easy' : stat.accuracy >= 40 ? 'Medium' : 'Hard'}</span>
                                   </div>
                                   <p className="text-xs font-bold text-slate-700 truncate max-w-md mt-1">{q.text}</p>
                                </div>
                                <span className={`text-xs font-black ${stat.accuracy > 70 ? 'text-emerald-605' : stat.accuracy >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{stat.accuracy.toFixed(0)}% accuracy</span>
                             </div>

                             <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                <div className="h-full bg-emerald-500" style={{ width: `${stat.accuracy}%` }} />
                                <div className="h-full bg-red-400" style={{ width: `${stat.submissions > 0 ? (stat.wrongAttempts / stat.submissions * 100) : 0}%` }} />
                             </div>

                             <div className="flex items-center space-x-4 mt-2 select-none">
                                <div className="flex items-center space-x-1">
                                   <span className="text-[8px] text-slate-400 font-bold uppercase">Correct:</span>
                                   <span className="text-[10px] text-slate-600 font-extrabold">{stat.correctAttempts}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                   <span className="text-[8px] text-slate-400 font-bold uppercase">Wrong:</span>
                                   <span className="text-[10px] text-slate-600 font-extrabold">{stat.wrongAttempts}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                   <span className="text-[8px] text-slate-400 font-bold uppercase">Skipped:</span>
                                   <span className="text-[10px] text-slate-600 font-extrabold">{stat.skippedAttempts}</span>
                                </div>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>
           </div>
         )}

         {/* TAB 3: PERFORMANCE INSIGHTS COHORTS */}
         {activeTab === 'insights' && (
           <div className="space-y-6 max-w-5xl mx-auto">
             {/* Bento Row 1: Top 10 vs Bottom 10 */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* TOP 10 */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-indigo-755 text-xs uppercase tracking-wider flex items-center gap-1 text-indigo-700">
                    <UserCheck className="w-4 h-4 text-indigo-650" /> Top 10 Performers
                  </h3>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                    {dataEngine.insights.top10.map((att, idx) => (
                      <div key={`${att.id}-${idx}`} className="py-2.5 flex justify-between items-center bg-slate-50/20 hover:bg-slate-50 p-2 rounded-xl mt-1.5 transition-all">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-black text-indigo-600">#{idx + 1}</span>
                          {att.userPhotoURL ? (
                            <img src={att.userPhotoURL} alt={att.userName} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs select-none">
                              {att.userName[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-800 block truncate max-w-[150px]">{att.userName}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{att.batchId || 'General'}</span>
                          </div>
                        </div>
                        <span className="text-sm font-black text-indigo-600 tabular-nums">{att.marks} M</span>
                      </div>
                    ))}
                    {dataEngine.insights.top10.length === 0 && (
                      <p className="text-center py-6 text-xs font-bold text-slate-450 select-none">No evaluations recorded yet</p>
                    )}
                  </div>
                </div>

                {/* BOTTOM 10 */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-orange-755 text-xs uppercase tracking-wider flex items-center gap-1 text-orange-700">
                    <UserMinus className="w-4 h-4 text-orange-655" /> Bottom 10 Performers
                  </h3>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                    {dataEngine.insights.bottom10.map((att, idx) => (
                      <div key={`${att.id}-${idx}`} className="py-2.5 flex justify-between items-center bg-slate-50/20 hover:bg-slate-50 p-2 rounded-xl mt-1.5 transition-all">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-black text-orange-600">Rank #{att.rank || idx + 1}</span>
                          {att.userPhotoURL ? (
                            <img src={att.userPhotoURL} alt={att.userName} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-750 flex items-center justify-center font-bold text-xs select-none">
                              {att.userName[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-800 block truncate max-w-[150px]">{att.userName}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{att.batchId || 'General'}</span>
                          </div>
                        </div>
                        <span className="text-sm font-black text-orange-600 tabular-nums">{att.marks} M</span>
                      </div>
                    ))}
                    {dataEngine.insights.bottom10.length === 0 && (
                      <p className="text-center py-6 text-xs font-bold text-slate-450 select-none">No evaluations recorded yet</p>
                    )}
                  </div>
                </div>
             </div>

             {/* Bento Row 2: Most Improved & Consistent Performers */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* MOST IMPROVED */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-emerald-700 text-xs uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-emerald-650" /> Most Improved Candidates
                  </h3>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                    {dataEngine.insights.improved.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center bg-slate-50/20 hover:bg-slate-50 p-2 rounded-xl mt-1.5 transition-all1">
                        <div className="flex items-center gap-2.5">
                          {item.student.photoUrl ? (
                            <img src={item.student.photoUrl} alt={item.student.name} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-750 flex items-center justify-center font-bold text-xs select-none">
                              {item.student.name ? item.student.name[0].toUpperCase() : 'S'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-800 block truncate max-w-[150px]">{item.student.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{item.student.batchId || 'General'} • {item.firstScore} M → {item.lastScore} M</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-0.5 tabular-nums">
                          <TrendingUp className="w-3 h-3" /> +{item.improvement} M
                        </span>
                      </div>
                    ))}
                    {dataEngine.insights.improved.length === 0 && (
                      <p className="text-center py-6 text-xs font-bold text-slate-450 select-none">Multiple finished attempts required to isolate improvement</p>
                    )}
                  </div>
                </div>

                {/* CONSISTENT PERFORMANCE */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-indigo-700 text-xs uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-indigo-650" /> Highly Consistent Candidates
                  </h3>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                    {dataEngine.insights.consistent.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center bg-slate-50/20 hover:bg-slate-50 p-2 rounded-xl mt-1.5 transition-all">
                        <div className="flex items-center gap-2.5">
                          {item.student.photoUrl ? (
                            <img src={item.student.photoUrl} alt={item.student.name} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs select-none">
                              {item.student.name ? item.student.name[0].toUpperCase() : 'S'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-800 block truncate max-w-[150px]">{item.student.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{item.student.batchId || 'General'} • {item.attemptsCount} Attempts</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-indigo-600 block tabular-nums">{item.avgScore.toFixed(1)} M Avg</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">SD Dev: {item.stdDev.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                    {dataEngine.insights.consistent.length === 0 && (
                      <p className="text-center py-6 text-xs font-bold text-slate-450 select-none">Requires candidates with {'>'}= 2 consistent score attempts</p>
                    )}
                  </div>
                </div>
             </div>

             {/* Bento Row 3: Requiring Attention */}
             <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
               <h3 className="font-extrabold text-rose-550 text-xs uppercase tracking-wider flex items-center gap-1.5 text-rose-700">
                 <AlertTriangle className="w-4 h-4 text-rose-500" /> Candidates Requiring Attention (Below Cutoff)
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-80 overflow-y-auto pr-1">
                 {dataEngine.insights.attention.map((item, idx) => (
                   <div key={idx} className="flex items-center justify-between p-3 bg-red-50/40 border border-red-100 rounded-xl hover:bg-slate-50 transition-all text-xs">
                     <div className="flex items-center gap-2.5">
                       {item.student.photoUrl ? (
                         <img src={item.student.photoUrl} alt={item.student.name} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                       ) : (
                         <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs select-none">
                           {item.student.name ? item.student.name[0].toUpperCase() : 'S'}
                         </div>
                       )}
                       <div>
                         <span className="font-extrabold text-slate-800 block">{item.student.name}</span>
                         <span className="text-[8.5px] font-bold text-slate-400 block uppercase">{item.student.batchId || 'General'} • {item.attemptsCount} attempts</span>
                       </div>
                     </div>
                     <span className="text-[10px] text-red-700 bg-red-100/60 font-black px-2.5 py-1 rounded">{item.bestScore} Marks score</span>
                   </div>
                 ))}
                 {dataEngine.insights.attention.length === 0 && (
                   <p className="text-center py-6 text-xs font-bold text-slate-450 col-span-2 select-none">All attempted candidates are scoring green above cutoffs (passing marks)!</p>
                 )}
               </div>
             </div>
           </div>
         )}

         {/* TAB 4: ADVANCED COMPETITIVE LEADERBOARD & FILTERS */}
         {activeTab === 'leaderboard' && (
           <div className="space-y-6 max-w-6xl mx-auto">
             
             {/* ADVANCED FILTER SHELF */}
             <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                   <div className="flex items-center space-x-1.5 text-slate-900 font-extrabold text-xs uppercase tracking-wider">
                     <Filter className="w-4 h-4 text-indigo-500" /> Advanced Leaderboard Control Room
                   </div>
                   
                   {/* Toggle "Not Attempted" */}
                   <button 
                     onClick={() => setShowNotAttemptedOnly(!showNotAttemptedOnly)}
                     className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                       showNotAttemptedOnly 
                         ? 'bg-rose-50 border-rose-250/20 text-rose-700 font-extrabold' 
                         : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                     }`}
                   >
                     <UserMinus className="w-3.5 h-3.5" /> 
                     {showNotAttemptedOnly ? "Viewing Absentee List" : "Show Absentee / Not Attempted"}
                   </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                   {/* Batch Filter dropdown */}
                   <div>
                     <label className="block text-[9px] font-black uppercase text-slate-400 mb-1 leading-none">Batch Category</label>
                     <div className="relative">
                        <select 
                          value={selectedBatch} 
                          onChange={(e) => setSelectedBatch(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs font-bold rounded-xl pr-6 text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all appearance-none cursor-pointer"
                        >
                          <option value="all">All Batches</option>
                          {dataEngine.allBatches.map(bId => (
                            <option key={bId} value={bId}>{bId}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-450 absolute right-2.5 top-[35%] pointer-events-none" />
                     </div>
                   </div>

                   {/* Premium toggle */}
                   <div>
                     <label className="block text-[9px] font-black uppercase text-slate-400 mb-1 leading-none">Premium Filter</label>
                     <div className="relative">
                        <select 
                          value={selectedPremium} 
                          onChange={(e) => setSelectedPremium(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs font-bold rounded-xl pr-6 text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all appearance-none cursor-pointer"
                        >
                          <option value="all">All Membership levels</option>
                          <option value="premium">Premium (Elite / Premium) Only</option>
                          <option value="regular">Regular Students Only</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-450 absolute right-2.5 top-[35%] pointer-events-none" />
                     </div>
                   </div>

                   {/* Performance Marks selector (disabled when showNotAttemptedOnly) */}
                   <div>
                     <label className="block text-[9px] font-black uppercase text-slate-400 mb-1 leading-none">Score Segment</label>
                     <div className="relative">
                        <select 
                          disabled={showNotAttemptedOnly}
                          value={selectedPerf} 
                          onChange={(e) => setSelectedPerf(e.target.value as any)}
                          className={`w-full bg-slate-50 border border-slate-200 p-2 text-xs font-bold rounded-xl pr-6 text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all appearance-none cursor-pointer ${showNotAttemptedOnly && 'opacity-50 cursor-not-allowed'}`}
                        >
                          <option value="all">All Score Ratios</option>
                          <option value="top">Top Scorers ({'>'}= 80%)</option>
                          <option value="low">Low Scorers ({'<'} 50%)</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-450 absolute right-2.5 top-[35%] pointer-events-none" />
                     </div>
                   </div>

                   {/* Range filter dates (disabled when showNotAttemptedOnly) */}
                   <div>
                     <label className="block text-[9px] font-black uppercase text-slate-400 mb-1 leading-none">Date Submitted Range</label>
                     <div className="relative">
                        <select 
                          disabled={showNotAttemptedOnly}
                          value={selectedDateRange} 
                          onChange={(e) => setSelectedDateRange(e.target.value as any)}
                          className={`w-full bg-slate-50 border border-slate-200 p-2 text-xs font-bold rounded-xl pr-6 text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all appearance-none cursor-pointer ${showNotAttemptedOnly && 'opacity-50 cursor-not-allowed'}`}
                        >
                          <option value="all">All Time</option>
                          <option value="today">Today only</option>
                          <option value="7days">Within Last 7 Days</option>
                          <option value="30days">Within Last 30 Days</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-450 absolute right-2.5 top-[35%] pointer-events-none" />
                     </div>
                   </div>
                </div>
             </div>

             {/* INTERACTIVE TABLE PORTLET */}
             <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-xs">
                      <thead>
                         <tr className="bg-slate-50 border-b border-slate-150 font-black text-slate-400 uppercase tracking-wider text-[10px] select-none">
                            <th className="p-4 text-center">Rank</th>
                            <th className="p-4">Student Profile</th>
                            <th className="p-4">Batch ID</th>
                            <th className="p-4 text-center">Score Marks</th>
                            <th className="p-4 text-center">Accuracy (%)</th>
                            <th className="p-4">Submission Time</th>
                            <th className="p-4 text-center">Percentile</th>
                            <th className="p-4 text-center">Progression Flag</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                         {processedLeaderboardAndNotAttempted.leaderboardData.map((item, idx) => {
                            const isAb = processedLeaderboardAndNotAttempted.isNotAttemptedGroup;
                            const isElite = item.isPremium || item.category === 'Elite';
                            return (
                               <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                                  {/* Rank Column */}
                                  <td className="p-4 text-center select-none font-black text-slate-700">
                                     {isAb ? (
                                       <span className="text-slate-350 italic">Abs</span>
                                     ) : (
                                       <span className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center mx-auto ${
                                         item.rank === 1 ? 'bg-amber-100 text-amber-700' :
                                         item.rank === 2 ? 'bg-slate-200 text-slate-800' :
                                         item.rank === 3 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                                       }`}>
                                          #{item.rank}
                                       </span>
                                     )}
                                  </td>

                                  {/* Profile Column */}
                                  <td className="p-4">
                                     <div className="flex items-center gap-3">
                                        <div className="relative">
                                          {item.userPhotoURL ? (
                                            <img src={item.userPhotoURL} alt={item.userName} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                                          ) : (
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs select-none">
                                               {item.userName[0].toUpperCase()}
                                            </div>
                                          )}
                                          {isElite && (
                                            <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border border-white" title="Premium Elite Student">
                                              <ShieldCheck className="w-2.5 h-2.5" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0 max-w-[150px] sm:max-w-xs">
                                           <span className="font-extrabold text-slate-800 block truncate">{item.userName}</span>
                                           <span className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-1 select-none">
                                              {isElite ? '★ Elite Tier' : 'Standard Tier'}
                                           </span>
                                        </div>
                                     </div>
                                  </td>

                                  {/* Batch Column */}
                                  <td className="p-4">
                                     <span className="text-[10px] font-extrabold text-slate-500 border border-slate-150 px-2 py-0.5 rounded-md uppercase select-none">
                                        {item.batchId || 'Aspirants'}
                                     </span>
                                  </td>

                                  {/* Score Column */}
                                  <td className="p-4 text-center font-black">
                                     {isAb ? (
                                       <span className="text-slate-400 font-bold select-none">-</span>
                                     ) : (
                                       <div className="inline-block text-right">
                                          <span className={`text-sm ${item.marks >= test.passingMarks ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {item.marks}
                                          </span>
                                          <span className="text-[10px] text-slate-400 select-none">/{test.maximumMarks}</span>
                                       </div>
                                     )}
                                  </td>

                                  {/* Accuracy Column */}
                                  <td className="p-4 text-center">
                                     {isAb ? (
                                       <span className="text-slate-400 font-bold select-none">-</span>
                                     ) : (
                                       <div className="inline-flex flex-col items-center select-none w-16">
                                          <span className="font-black text-slate-700 mb-0.5">{(item.percentage ?? 0).toFixed(0)}%</span>
                                          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                             <div className="h-full bg-emerald-500" style={{ width: `${item.percentage ?? 0}%` }} />
                                          </div>
                                       </div>
                                     )}
                                  </td>

                                  {/* Time Column */}
                                  <td className="p-4 whitespace-nowrap text-slate-500">
                                     {isAb ? (
                                       <span className="text-rose-500 font-black uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded-md text-[9px] select-none">Unattempted</span>
                                     ) : (
                                       <div className="leading-tight text-slate-600">
                                          <span className="block font-bold">{formatTime(item.timeTaken)}</span>
                                          <span className="text-[9px] text-slate-400 tabular-nums">
                                            {item.submittedAt ? formatIST(item.submittedAt) : 'N/A'}
                                          </span>
                                       </div>
                                     )}
                                  </td>

                                  {/* Percentile Rank */}
                                  <td className="p-4 text-center font-extrabold text-slate-705">
                                     {isAb ? (
                                       <span className="text-slate-400 font-bold select-none">-</span>
                                     ) : (
                                       <span className="tabular-nums font-black text-slate-700">{(item.percentile || 0).toFixed(1)}%</span>
                                     )}
                                  </td>

                                  {/* Progression Flag */}
                                  <td className="p-4 text-center select-none">
                                     {isAb ? (
                                       <button 
                                         onClick={() => window.alert(`Absent reminder feature configured. Contact ${item.userName} via student updates.`)}
                                         className="p-1 bg-rose-50 border border-rose-100 rounded text-rose-600 hover:bg-rose-100 transition-colors"
                                         title="Flag Student Absence"
                                       >
                                         <Mail className="w-3.5 h-3.5" />
                                       </button>
                                     ) : item.improvementFromPrevious && item.improvementFromPrevious > 0 ? (
                                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded flex items-center justify-center gap-0.5 w-max mx-auto border border-emerald-100">
                                          <TrendingUp className="w-3 h-3" /> +{item.improvementFromPrevious}
                                        </span>
                                     ) : item.improvementFromPrevious && item.improvementFromPrevious < 0 ? (
                                        <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded flex items-center justify-center gap-0.5 w-max mx-auto border border-rose-100">
                                          <TrendingDown className="w-3 h-3" /> {item.improvementFromPrevious}
                                        </span>
                                     ) : (
                                        <span className="text-slate-400 text-[9px] font-bold">First Attempt</span>
                                     )}
                                  </td>
                               </tr>
                            );
                         })}
                         {processedLeaderboardAndNotAttempted.leaderboardData.length === 0 && (
                            <tr>
                               <td colSpan={8} className="p-8 text-center text-xs font-bold text-slate-450 select-none">
                                  No candidates matched the current filter configurations.
                               </td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
