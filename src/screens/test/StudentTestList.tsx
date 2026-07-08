import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useAppConfig } from "../../providers/AppProvider";
import { TestService } from "../../services/test";
import { TestFolderService } from "../../services/testFolder";
import { Test, TestAttempt } from "../../models/mission";
import { TestFolder } from "../../models/testFolder";
import {
  Play,
  CheckCircle2,
  Search,
  Clock,
  FileText,
  ChevronRight,
  BarChart2,
  Folder,
  ArrowLeft,
  Target,
  Trophy,
  Flame,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AttemptHistoryView from "./AttemptHistoryView";
import { formatIST, formatTimeIST } from "../../utils/date";
import PrintableTest from "../../components/PrintableTest";
import { useCachedQuery } from "../../hooks/useCachedQuery";

export default function StudentTestList() {
  const navigate = useNavigate();
  const { userProfile, currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [historyTestId, setHistoryTestId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { setIsPremiumModalOpen } = useAppConfig();
  const [exportPdfTest, setExportPdfTest] = useState<Test | null>(null);

  const foldersQuery = useCachedQuery<TestFolder[]>({
    queryKey: ['testFolders'],
    queryFn: async () => {
      return TestFolderService.getFolders();
    },
    enabled: !!userProfile?.id && !!currentUser?.uid,
    persistKey: 'test_folders_cache',
  });

  const testsQuery = useCachedQuery<Test[]>({
    queryKey: ['studentTests', userProfile?.id || ''],
    queryFn: async () => {
      return TestService.getTestsForStudent(userProfile!.id);
    },
    enabled: !!userProfile?.id && !!currentUser?.uid,
    persistKey: userProfile?.id ? `student_tests_cache_${userProfile.id}` : undefined,
  });

  const attemptsQuery = useCachedQuery<TestAttempt[]>({
    queryKey: ['studentAttempts', userProfile?.id || ''],
    queryFn: async () => {
      return TestService.getAttemptsForStudent(userProfile!.id);
    },
    enabled: !!userProfile?.id && !!currentUser?.uid,
    persistKey: userProfile?.id ? `student_attempts_cache_${userProfile.id}` : undefined,
  });

  const folders = foldersQuery.data || [];
  const tests = testsQuery.data || [];
  const attempts = attemptsQuery.data || [];

  const loading = foldersQuery.isLoading || testsQuery.isLoading || attemptsQuery.isLoading;

  // Derived Stats - MUST be before any early returns
  const testsAttempted = useMemo(() => new Set(attempts.map((a) => a.testId)).size, [attempts]);
  const bestScore = useMemo(() =>
    attempts.length > 0
      ? Math.max(...attempts.map((a) => a.percentage || 0))
      : 0, [attempts]);
  const avgScore = useMemo(() =>
    attempts.length > 0
      ? attempts.reduce((acc, a) => acc + (a.percentage || 0), 0) /
        attempts.length
      : 0, [attempts]);
  const pendingTests = useMemo(() => tests.filter(
    (t) => !attempts.find((a) => a.testId === t.id),
  ).length, [tests, attempts]);

  // Compatibility function for any trigger calling loadData
  const loadData = async () => {
    try {
      await Promise.all([
        foldersQuery.refetch(),
        testsQuery.refetch(),
        attemptsQuery.refetch()
      ]);
    } catch (e) {
      console.error("%c[Error during data load]:", "color: red; font-weight: bold;", e);
    }
  };

  useEffect(() => {
    // Logging removed for performance
  }, [tests, activeFolderId, searchQuery]);

  const getLatestAttempt = useCallback((testId: string) => {
    const testAtts = attempts
      .filter((a) => a.testId === testId)
      .sort((a, b) => b.attemptNumber - a.attemptNumber);
    return testAtts[0];
  }, [attempts]);

  const testsByFolder = useMemo(() => {
    const map: Record<string, Test[]> = {};
    tests.forEach(test => {
      const folderId = test.folderId || 'uncategorized';
      if (!map[folderId]) map[folderId] = [];
      map[folderId].push(test);
    });
    return map;
  }, [tests]);

  const filteredTests = useMemo(() => {
    let list = activeFolderId ? tests.filter(t => t.folderId === activeFolderId) : tests;
    if (searchQuery) {
      list = list.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [tests, activeFolderId, searchQuery]);

  const sortedAttempts = useMemo(() => {
    return [...attempts]
      .filter(a => a.status === 'evaluated' || a.status === 'submitted')
      .sort((a, b) => new Date(b.submittedAt || b.updatedAt || 0).getTime() - new Date(a.submittedAt || a.updatedAt || 0).getTime());
  }, [attempts]);

  const checkPremiumAccess = (testId: string) => {
    const test = tests.find(t => t.id === testId);
    const isPremiumUser = !!userProfile?.isPremium || userProfile?.role !== 'student';
    const isTestPremium = test?.testType === 'premium';
    
    if (isTestPremium && !isPremiumUser) {
      setIsPremiumModalOpen(true);
      return false;
    }
    return true;
  };

  const handleStartOrResume = async (testId: string) => {
    if (!checkPremiumAccess(testId)) return;
    navigate(`/app/tests/attempt/${testId}`);
  };

  const handleReattempt = async (testId: string) => {
    if (!checkPremiumAccess(testId)) return;
    navigate(`/app/tests/attempt/${testId}?forceNew=true`);
  };

  const handleViewResult = (attemptId: string) => {
    navigate(`/app/tests/result/${attemptId}`);
  };

  if (showAllHistory) {
    const allRecentAttempts = [...attempts]
      .filter(a => a.status === 'evaluated' || a.status === 'submitted')
      .sort((a, b) => new Date(b.submittedAt || b.updatedAt || 0).getTime() - new Date(a.submittedAt || a.updatedAt || 0).getTime());

    console.log("View All: attempts count", attempts.length, "filtered count", allRecentAttempts.length);

    return (
      <div className="flex flex-col h-full bg-slate-50 p-4 pb-24 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => setShowAllHistory(false)}
            className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-black text-slate-900">Attempt History</h1>
        </div>

        <div className="space-y-3">
          {allRecentAttempts.map((attempt) => {
            const test = tests.find(t => t.id === attempt.testId);
            return (
              <div 
                key={attempt.id}
                onClick={() => handleViewResult(attempt.id)}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center cursor-pointer hover:border-indigo-300 transition-colors"
              >
                <div className="flex gap-4 items-center">
                  <div className={`p-3 rounded-xl ${attempt.status === 'evaluated' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{attempt.testTitle || test?.title || 'Unknown Test'}</p>
                    <p className="text-[10px] text-slate-500 uppercase">
                      Attempt #{attempt.attemptNumber} • {attempt.submittedAt ? formatIST(attempt.submittedAt) : 'Recently'} • {attempt.correct} Correct
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-900">{Math.round(attempt.percentage || 0)}%</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{attempt.marks}/{test?.maximumMarks || '?'}</p>
                </div>
              </div>
            );
          })}
          {allRecentAttempts.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-400 font-medium">No attempts found yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (historyTestId) {
    return (
      <AttemptHistoryView
        testId={historyTestId}
        studentId={userProfile!.id || ''}
        onBack={() => setHistoryTestId(null)}
        onViewResult={handleViewResult}
      />
    );
  }

  // Derived Stats
  const renderDashboardStats = () => (
    <div className="grid grid-cols-4 gap-2 mb-4">
      <div className="bg-white p-2.5 rounded-xl shadow-xs border border-slate-200/60 flex flex-col items-center justify-center text-center">
        <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center mb-1">
          <Target className="text-indigo-600" size={12} />
        </div>
        <p className="text-lg font-black text-slate-800 leading-none mb-0.5">{testsAttempted}</p>
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider leading-tight">
          Attempted
        </p>
      </div>
      <div className="bg-white p-2.5 rounded-xl shadow-xs border border-slate-200/60 flex flex-col items-center justify-center text-center">
        <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center mb-1">
          <Trophy className="text-emerald-600" size={12} />
        </div>
        <p className="text-lg font-black text-slate-800 leading-none mb-0.5">
          {Math.round(bestScore)}%
        </p>
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider leading-tight">
          Best
        </p>
      </div>
      <div className="bg-white p-2.5 rounded-xl shadow-xs border border-slate-200/60 flex flex-col items-center justify-center text-center">
        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center mb-1">
          <BarChart2 className="text-blue-600" size={12} />
        </div>
        <p className="text-lg font-black text-slate-800 leading-none mb-0.5">
          {Math.round(avgScore)}%
        </p>
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider leading-tight">
          Average
        </p>
      </div>
      <div className="bg-white p-2.5 rounded-xl shadow-xs border border-slate-200/60 flex flex-col items-center justify-center text-center">
        <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center mb-1">
          <Flame className="text-amber-600" size={12} />
        </div>
        <p className="text-lg font-black text-slate-800 leading-none mb-0.5">{pendingTests}</p>
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider leading-tight">
          Pending
        </p>
      </div>
    </div>
  );

  const renderRecentlyAttempted = () => {
    const topRecent = sortedAttempts.slice(0, 5);
    if (topRecent.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Clock size={14} className="text-indigo-500" />
            Recently Attempted
          </h3>
          <button 
            onClick={() => setShowAllHistory(true)}
            className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg uppercase tracking-tight"
          >
            View All
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {topRecent.map((attempt) => {
            const test = tests.find(t => t.id === attempt.testId);
            return (
              <div 
                key={attempt.id}
                onClick={() => handleViewResult(attempt.id)}
                className="shrink-0 w-44 bg-white p-3 rounded-2xl border border-slate-200/60 shadow-xs cursor-pointer hover:shadow-md transition-all active:scale-95 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-1.5">
                    <div className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${attempt.status === 'evaluated' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {attempt.status}
                    </div>
                    <div className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wider">
                      #{attempt.attemptNumber}
                    </div>
                  </div>
                  <p className="text-[8px] font-bold text-slate-400">
                    {attempt.submittedAt ? formatIST(attempt.submittedAt) : 'Recent'}
                  </p>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mb-2 line-clamp-2 min-h-[2rem] group-hover:text-indigo-600 transition-colors">
                  {attempt.testTitle || test?.title || 'Unknown Test'}
                </h4>
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-0.5 tracking-tighter">Marks</span>
                    <span className="text-xs font-black text-slate-800">{attempt.marks ?? 0}<span className="text-[10px] text-slate-300 font-bold">/{test?.maximumMarks || '?'}</span></span>
                  </div>
                  <div className="w-9 h-9 rounded-xl border border-slate-100 flex flex-col items-center justify-center bg-slate-50/50">
                    <span className="text-[10px] font-black text-indigo-600 leading-none">{Math.round(attempt.percentage || 0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFolderGrid = () => {
    const filteredFolders = folders.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    // Virtual folder for uncategorized tests
    const uncategorizedTests = tests.filter((t) => !t.folderId);
    const showUncategorized =
      uncategorizedTests.length > 0 &&
      "uncategorized".includes(searchQuery.toLowerCase());

    // Fallback if no folders are created yet
    if (folders.length === 0 && !showUncategorized && !loading) {
      return (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Folder className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-slate-900 font-bold mb-1">No Categories Found</h3>
          <p className="text-slate-500 text-sm">
            Tests are not categorized yet. Contact your mentor.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-2">
        {filteredFolders.map((folder) => {
          const folderTests = testsByFolder[folder.id] || [];

          return (
            <div
              key={folder.id}
              onClick={() => setActiveFolderId(folder.id)}
              className="p-3 rounded-xl border-2 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition-all duration-150 active:scale-95 bg-white relative overflow-hidden group hover:border-opacity-50"
              style={{
                background: `linear-gradient(145deg, ${folder.color}05, ${folder.color}15)`,
                borderColor: `${folder.color}30`,
              }}
            >
              <div
                className="absolute top-0 right-0 w-24 h-24 opacity-20 rounded-full blur-2xl group-hover:opacity-40 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(to bottom right, ${folder.color}, transparent)`,
                }}
              />

              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative z-10 transition-transform duration-200 group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${folder.color}20, ${folder.color}40)`,
                  color: folder.color,
                  boxShadow: `0 4px 12px ${folder.color}20`,
                }}
              >
                <span className="text-lg drop-shadow-sm">
                  {folder.icon || "📁"}
                </span>
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <h3 className="font-bold text-slate-900 text-xs mb-0.5 truncate">
                  {folder.name}
                </h3>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                  {folderTests.length} Tests
                </p>
              </div>
            </div>
          );
        })}
        {showUncategorized && (
          <div
            onClick={() => setActiveFolderId("uncategorized")}
            className="p-3 rounded-xl border-2 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition-all duration-150 active:scale-95 relative overflow-hidden group hover:border-slate-300"
            style={{
              background: `linear-gradient(145deg, #f8fafc, #f1f5f9)`,
              borderColor: `#e2e8f0`,
            }}
          >
            <div
              className="absolute top-0 right-0 w-24 h-24 opacity-20 rounded-full blur-2xl group-hover:opacity-40 transition-opacity duration-300"
              style={{
                background: `linear-gradient(to bottom right, #94a3b8, transparent)`,
              }}
            />

            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative z-10 transition-transform duration-200 group-hover:scale-110 bg-slate-100 text-slate-500 shadow-sm border border-slate-200"
            >
              <span className="text-lg drop-shadow-sm">📦</span>
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <h3 className="font-bold text-slate-900 text-xs mb-0.5 truncate">
                Uncategorized
              </h3>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                {uncategorizedTests.length} Tests
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFolderView = () => {
    const isUncategorized = activeFolderId === "uncategorized";
    const folder = isUncategorized
      ? {
          id: "uncategorized",
          name: "Uncategorized",
          icon: "📦",
          color: "#94a3b8",
        }
      : folders.find((f) => f.id === activeFolderId);
    if (!folder) return null;

    const folderTests = (isUncategorized 
      ? (testsByFolder['uncategorized'] || [])
      : (testsByFolder[folder.id] || [])
    ).filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

    // Folder Progress
    const folderAttempts = attempts.filter((a) =>
      folderTests.find((t) => t.id === a.testId),
    );
    const completedTests = new Set(folderAttempts.map((a) => a.testId)).size;
    const remainingTests = folderTests.length - completedTests;
    const folderAvgAccuracy =
      folderAttempts.length > 0
        ? folderAttempts.reduce((acc, a) => acc + (a.percentage || 0), 0) /
          folderAttempts.length
        : 0;
    const progressPerc =
      folderTests.length > 0 ? (completedTests / folderTests.length) * 100 : 0;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={() => setActiveFolderId(null)}
          className="flex items-center space-x-2 text-slate-500 mb-4 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} />{" "}
          <span className="font-bold text-sm">Back to Library</span>
        </button>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-6 flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ backgroundColor: `${folder.color}15` }}
          >
            {folder.icon || "📁"}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-900">{folder.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs font-bold text-slate-500 uppercase">
              <span>{completedTests} Completed</span>
              <span>•</span>
              <span>{remainingTests} Remaining</span>
              <span>•</span>
              <span className="text-emerald-600">
                {Math.round(folderAvgAccuracy)}% Accuracy
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
              <div
                className="bg-indigo-600 h-1.5 rounded-full"
                style={{ width: `${progressPerc}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {folderTests.map((test, idx) => {
            const latestAtt = getLatestAttempt(test.id);
            const status = latestAtt ? latestAtt.status : "not_started";
            const attemptCount = attempts.filter(
              (a) => a.testId === test.id,
            ).length;
            const isExpired = test.expiryDate
              ? new Date(test.expiryDate) < new Date()
              : false;
            const isUpcoming =
              (test.status === "scheduled" || test.status === "published") &&
              test.scheduledFor &&
              new Date(test.scheduledFor) > new Date();

            return (
              <div
                key={test.id}
                className={`bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col hover:shadow-md transition-shadow ${isExpired ? "opacity-75 grayscale-[0.5]" : ""}`}
              >
                {isUpcoming && (
                  <div className="mb-2 flex items-center space-x-1.5 text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-lg inline-flex self-start uppercase tracking-wider border border-amber-100">
                    <Clock className="w-3 h-3" />
                    <span>
                      Upcoming: {formatIST(test.scheduledFor)}
                    </span>
                  </div>
                )}
                
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {test.testType === 'premium' && (
                        <div className="flex items-center space-x-1 text-[9px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider border border-amber-200">
                          <span>🔒 Premium</span>
                        </div>
                      )}
                      <h3 className="font-bold text-slate-900 text-sm truncate">
                        {test.title}
                      </h3>
                      {status === "not_started" && test.status === "live" && (
                        <span className="flex h-2 w-2 relative shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-bold text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span>{test.duration}m</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-3 h-3 text-emerald-400" />
                        <span>{test.questions.length} Qs</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                      <div className="flex items-center space-x-1">
                        <BarChart2 className="w-3 h-3 text-purple-400" />
                        <span>{test.maximumMarks} Pts</span>
                      </div>
                      {attemptCount > 0 && (
                        <>
                          <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                          <div className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {attemptCount} {attemptCount > 1 ? "Attempts" : "Attempt"}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="shrink-0 flex flex-col gap-2 items-end">
                    {test.pdfSharingEnabled && (
                      <button
                        onClick={() => setExportPdfTest(test)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 uppercase tracking-wider shadow-sm border border-rose-200"
                        title="Download PDF"
                      >
                        📥 PDF
                      </button>
                    )}

                    {status === "not_started" &&
                      (test.status === "live" ||
                        test.status === "published" ||
                        test.status === "scheduled") && (
                        <button
                          onClick={() => handleStartOrResume(test.id)}
                          disabled={isUpcoming || isExpired}
                          className="bg-indigo-600 text-white font-black text-[10px] px-3 py-1.5 rounded-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 uppercase tracking-wider shadow-sm"
                        >
                          {isUpcoming
                            ? "Wait"
                            : isExpired
                              ? "Expired"
                              : "Start"}
                          {!isUpcoming && !isExpired && <Play className="w-3 h-3 ml-1 fill-current" />}
                        </button>
                      )}

                    {status === "in_progress" && (
                      <button
                        onClick={() => handleStartOrResume(test.id)}
                        disabled={isExpired}
                        className="bg-amber-500 text-white font-black text-[10px] px-3 py-1.5 rounded-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 uppercase tracking-wider shadow-sm"
                      >
                        Resume
                      </button>
                    )}

                    {status === "submitted" && (
                      <div className="text-[10px] font-black text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg flex items-center justify-center uppercase tracking-wider border border-amber-200/60">
                        <Clock className="w-3 h-3 mr-1" /> Evaluating
                      </div>
                    )}
                  </div>
                </div>

                {status === "evaluated" && latestAtt && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 -mx-3.5 -mb-3.5 px-3.5 py-2.5 rounded-b-2xl">
                    <div className="flex items-center gap-3">
                      <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-xs">
                        <span className="text-sm font-black text-slate-900">
                          {latestAtt.marks}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 ml-0.5">
                          /{test.maximumMarks}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleViewResult(latestAtt.id)}
                        className="flex items-center text-[10px] text-indigo-600 font-black uppercase tracking-wider hover:text-indigo-700"
                      >
                        Result <ChevronRight className="w-3 h-3 ml-0.5" />
                      </button>
                    </div>
                    
                    <div className="flex gap-1.5">
                      {test.status !== "live" ? (
                        <button
                          onClick={() => handleReattempt(test.id)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-black px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                        >
                          Reattempt
                        </button>
                      ) : (
                        <div className="bg-slate-200/70 text-slate-500 font-black px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider">
                          Done
                        </div>
                      )}
                      {attemptCount > 1 && (
                        <button
                          onClick={() => setHistoryTestId(test.id)}
                          className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-black px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-colors shadow-xs"
                        >
                          Hist.
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {folderTests.length === 0 && (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
              <p className="text-slate-500 text-sm">
                No tests found in this category.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative p-3 pb-32 overflow-y-auto">
      <div className="mb-4 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 mb-0.5">
              Test Library
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Attempt live tests & practice
            </p>
          </div>
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder={
              activeFolderId ? "Search tests..." : "Search categories..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-xs"
          />
        </div>
      </div>

      {!activeFolderId && renderDashboardStats()}
      {!activeFolderId && renderRecentlyAttempted()}

      <div className="flex-1 pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : activeFolderId ? (
          renderFolderView()
        ) : (
          renderFolderGrid()
        )}
      </div>

      {/* End of content */}
      {exportPdfTest && (
        <PrintableTest
          test={exportPdfTest}
          isOpen={!!exportPdfTest}
          onClose={() => setExportPdfTest(null)}
          isMentor={false}
        />
      )}
    </div>
  );
}
