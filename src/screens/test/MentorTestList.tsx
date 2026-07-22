import React, { useState, useEffect } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { TestService } from "../../services/test";
import { TestFolderService } from "../../services/testFolder";
import { BatchService } from "../../services/batch";
import { Test, Batch } from "../../models/mission";
import { TestFolder } from "../../models/testFolder";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  FileText,
  Clock,
  Users,
  Edit2,
  Copy,
  Trash2,
  CheckCircle2,
  ChevronRight,
  BarChart2,
  Play,
  Sparkles,
  RefreshCw,
  Folder,
  ArrowLeft,
  X,
  Share2, Globe,
  BookOpen,
} from "lucide-react";
import { TestStatusModal } from "../../components/TestStatusModal";
import { motion, AnimatePresence } from "motion/react";
import PrintableTest from "../../components/PrintableTest";
import { toast } from "react-hot-toast";
import { addDoc, collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../../services/firebase";
import TestCreateEdit from "./TestCreateEdit";
import EvaluatorDashboard from "./EvaluatorDashboard";
import TestAnalyticsView from "./TestAnalyticsView";
import QuestionBankScreen from "./QuestionBankScreen";

export default function MentorTestList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userProfile, currentUser } = useAuth();
  const [folders, setFolders] = useState<TestFolder[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editTestId, setEditTestId] = useState<string | null>(null);
  
  useEffect(() => {
    if (showCreate || editTestId) {
      setSearchParams(prev => { prev.set('mode', 'edit'); return prev; }, { replace: true });
    } else {
      setSearchParams(prev => { prev.delete('mode'); return prev; }, { replace: true });
    }
  }, [showCreate, editTestId, setSearchParams]);
  const [analyticsTestId, setAnalyticsTestId] = useState<string | null>(null);
  const [statusModalTestId, setStatusModalTestId] = useState<string | null>(null);
  const [exportPdfTest, setExportPdfTest] = useState<Test | null>(null);
  const [showEvaluator, setShowEvaluator] = useState(false);
  const [showQuestionBank, setShowQuestionBank] = useState(false);

  const handleDuplicate = async (test: Test) => {
    if (!currentUser) return;
    try {
      setLoading(true);
      await TestService.duplicateTest(test.id, currentUser.uid);
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<
    "all" | "draft" | "published" | "live" | "completed"
  >("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [customBatchId, setCustomBatchId] = useState<string>("");

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] =
    useState<Partial<TestFolder> | null>(null);

  useEffect(() => {
    if (userProfile && currentUser) {
      loadData();
    }
  }, [userProfile, currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const flds = await TestFolderService.getFolders();
      const data = await TestService.getTestsForMentor(userProfile!.uid);
      const batchList = await BatchService.getBatches();
      setFolders(flds);
      setTests(data);
      setBatches(batchList.filter(b => b.status === "active"));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (testId: string, status: Test["status"]) => {
    try {
      setLoading(true);
      await TestService.updateTest(testId, { status });
      toast.success("Status updated successfully");
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update test status");
    } finally {
      setLoading(false);
      setStatusModalTestId(null);
    }
  };

  const handleSchedule = async (testId: string) => {
    const date = prompt("Enter scheduled date (YYYY-MM-DD):");
    if (date) {
      try {
        setLoading(true);
        await TestService.updateTest(testId, { status: "scheduled", scheduledFor: date });
        toast.success("Test scheduled successfully");
        loadData();
      } catch (e) {
        console.error(e);
        toast.error("Failed to schedule test");
      } finally {
        setLoading(false);
        setStatusModalTestId(null);
      }
    }
  };

  const handleAddToFolder = async (testId: string) => {
    const folderId = prompt("Enter folder ID (or leave empty to remove):");
    try {
        setLoading(true);
        await TestService.updateTest(testId, { folderId: folderId || "" });
        toast.success("Folder updated successfully");
        loadData();
    } catch (e) {
        console.error(e);
        toast.error("Failed to update folder");
    } finally {
        setLoading(false);
        setStatusModalTestId(null);
    }
  };

  const handleAssignBatch = async (testId: string) => {
    const batchId = prompt("Enter batch ID:");
    if (batchId) {
        try {
            setLoading(true);
            await TestService.updateTest(testId, { batchId });
            toast.success("Batch assigned successfully");
            loadData();
        } catch (e) {
            console.error(e);
            toast.error("Failed to assign batch");
        } finally {
            setLoading(false);
            setStatusModalTestId(null);
        }
    }
  };

  const handleDelete = async (testId: string) => {
    if (confirm("Are you sure you want to delete this test?")) {
      try {
        setLoading(true);
        await TestService.deleteTest(testId);
        toast.success("Test deleted successfully");
        loadData();
      } catch (e) {
        console.error(e);
        toast.error("Failed to delete test");
      } finally {
        setLoading(false);
        setStatusModalTestId(null);
      }
    }
  };



  const handleMigrateScoring = async () => {
    if (
      !window.confirm(
        "CRITICAL: This will update ALL existing tests and student results to the new standard (+2 for correct, -0.5 for wrong). This action is irreversible. Proceed?",
      )
    )
      return;
    try {
      setLoading(true);
      const res = await TestService.migrateScoringData();
      toast.success(
        `Successfully updated ${res.testsUpdated} tests and ${res.attemptsUpdated} student attempts.`,
      );
      loadData();
    } catch (err: any) {
      console.error("Migration error:", err);
      toast.error(err.message || "Scoring migration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFolder = async () => {
    if (!editingFolder?.name) return toast.error("Folder name required");
    try {
      setLoading(true);
      const payload = {
        name: editingFolder.name,
        icon: editingFolder.icon || "📁",
        color: editingFolder.color || "#4f46e5",
        sortOrder: editingFolder.sortOrder || folders.length,
      };
      if (editingFolder.id) {
        await TestFolderService.updateFolder(editingFolder.id, payload);
        toast.success("Folder updated");
      } else {
        await TestFolderService.createFolder(payload);
        toast.success("Folder created");
      }
      setShowFolderModal(false);
      setEditingFolder(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save folder");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folderTests = tests.filter((t) => t.folderId === folderId);
    if (folderTests.length > 0) {
      return alert(
        "Cannot delete folder: It contains tests. Please remove them first.",
      );
    }
    if (confirm("Are you sure you want to delete this folder?")) {
      await TestFolderService.deleteFolder(folderId);
      if (activeFolderId === folderId) setActiveFolderId(null);
      loadData();
    }
  };

  const moveFolder = async (folderId: string, direction: "up" | "down") => {
    const idx = folders.findIndex((f) => f.id === folderId);
    if (direction === "up" && idx > 0) {
      const newFolders = [...folders];
      [newFolders[idx - 1], newFolders[idx]] = [
        newFolders[idx],
        newFolders[idx - 1],
      ];
      await TestFolderService.reorderFolders(newFolders.map((f) => f.id));
      loadData();
    } else if (direction === "down" && idx < folders.length - 1) {
      const newFolders = [...folders];
      [newFolders[idx + 1], newFolders[idx]] = [
        newFolders[idx],
        newFolders[idx + 1],
      ];
      await TestFolderService.reorderFolders(newFolders.map((f) => f.id));
      loadData();
    }
  };

  const filteredTests = tests.filter(
    (t) => {
      // 1. Text Search Filter
      const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.subject && t.subject.toLowerCase().includes(search.toLowerCase()));
      if (!matchesSearch) return false;

      // 2. Status Filter
      if (filterState !== "all" && t.status !== filterState) return false;

      // 3. Folder Filter
      if (activeFolderId) {
        if (activeFolderId === "uncategorized") {
          if (t.folderId) return false;
        } else {
          if (t.folderId !== activeFolderId) return false;
        }
      }

      // 4. Batch Filter
      if (batchFilter !== "all") {
        if (batchFilter === "custom") {
          if (!customBatchId) return true; // Show all if no custom selected
          const testBatchIds = t.batchIds || (t.batchId ? [t.batchId] : []);
          return testBatchIds.includes(customBatchId);
        } else {
          // Pre-defined category filters: SSC CGL, SSC CHSL, Railway, Banking, WBPSC, Police
          const testBatchNames = (t.batchIds || []).map(id => batches.find(b => b.id === id)?.batchName || "").concat(t.batchName || "");
          const keyword = batchFilter.toLowerCase();
          return testBatchNames.some(name => name.toLowerCase().includes(keyword));
        }
      }

      return true;
    }
  );

  if (showEvaluator) {
    return <EvaluatorDashboard onBack={() => setShowEvaluator(false)} />;
  }

  if (showQuestionBank) {
    return <QuestionBankScreen onBack={() => setShowQuestionBank(false)} />;
  }

  if (analyticsTestId) {
    return (
      <TestAnalyticsView
        testId={analyticsTestId}
        onBack={() => setAnalyticsTestId(null)}
      />
    );
  }

  if (showCreate || editTestId) {
    return (
      <TestCreateEdit
        testId={editTestId}
        onClose={() => {
          setShowCreate(false);
          setEditTestId(null);
        }}
        onSaved={loadData}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative p-3 overflow-y-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900 leading-tight">
          {activeFolderId
            ? folders.find((f) => f.id === activeFolderId)?.name
            : "Manage Tests"}
        </h2>
        <div className="flex space-x-1.5">
          {!activeFolderId && (
            <button
              onClick={() => {
                setEditingFolder({});
                setShowFolderModal(true);
              }}
              className="bg-white text-indigo-600 px-2 py-1.5 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors shadow-xs flex flex-col items-center justify-center text-[9px] font-bold"
            >
              <Folder className="w-3 h-3 mb-0.5" />
              <span>Folder</span>
            </button>
          )}
          <button
            onClick={() => setShowEvaluator(true)}
            className="bg-white text-slate-600 px-2 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs flex flex-col items-center justify-center text-[9px] font-bold"
          >
            <CheckCircle2 className="w-3 h-3 mb-0.5" />
            <span>Evaluate</span>
          </button>
          <button
            onClick={() => setShowQuestionBank(true)}
            className="bg-white text-indigo-600 px-2 py-1.5 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors shadow-xs flex flex-col items-center justify-center text-[9px] font-bold"
          >
            <BookOpen className="w-3 h-3 mb-0.5" />
            <span>Library</span>
          </button>
          <button
            onClick={handleMigrateScoring}
            className="bg-white text-orange-600 px-2 py-1.5 rounded-xl border border-orange-200 hover:bg-orange-50 transition-colors shadow-xs flex flex-col items-center justify-center text-[9px] font-bold hidden sm:flex"
          >
            <RefreshCw className="w-3 h-3 mb-0.5" />
            <span>Sync</span>
          </button>
          {(userProfile?.role === "mentor" ||
            userProfile?.role === "primary-mentor") && (
            <>
              <button
                onClick={() => navigate('ai-gen')}
                className="bg-gradient-to-r from-indigo-600 to-rose-600 text-white px-2 py-1.5 rounded-xl hover:from-indigo-500 hover:to-rose-500 transition-all shadow-xs flex flex-col items-center justify-center text-[9px] font-bold"
              >
                <Sparkles className="w-3 h-3 mb-0.5 text-white" />
                <span>AI Gen</span>
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="bg-indigo-600 text-white p-1.5 rounded-xl hover:bg-indigo-500 transition-colors shadow-xs flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {!activeFolderId && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          {folders.map((folder, idx) => {
            const count = tests.filter((t) => t.folderId === folder.id).length;
            return (
              <div
                key={folder.id}
                className="p-2.5 rounded-xl border-2 shadow-sm flex flex-col relative group overflow-hidden transition-all duration-150 hover:shadow-md active:scale-95 hover:border-opacity-50 content-visibility-auto gpu-accelerated"
                style={{
                  background: `linear-gradient(145deg, ${folder.color}05, ${folder.color}15)`,
                  borderColor: `${folder.color}30`,
                }}
              >
                <div
                  className="absolute top-0 right-0 w-20 h-20 opacity-20 rounded-full blur-2xl group-hover:opacity-40 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(to bottom right, ${folder.color}, transparent)`,
                  }}
                />
                <div
                  onClick={() => setActiveFolderId(folder.id)}
                  className="flex items-center gap-2 cursor-pointer flex-1 relative z-10"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{
                      background: `linear-gradient(135deg, ${folder.color}20, ${folder.color}40)`,
                      color: folder.color,
                      boxShadow: `0 4px 12px ${folder.color}20`,
                    }}
                  >
                    <span className="drop-shadow-sm">
                      {folder.icon || "📁"}
                    </span>
                  </div>
                  <div className="min-w-0 pr-6">
                    <h3 className="font-bold text-slate-900 text-xs leading-tight truncate">
                      {folder.name}
                    </h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      {count} Tests
                    </p>
                  </div>
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-20">
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingFolder(folder);
                        setShowFolderModal(true);
                      }}
                      className="p-1 bg-slate-100 rounded text-slate-600 hover:text-indigo-600"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="p-1 bg-slate-100 rounded text-slate-600 hover:text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      disabled={idx === 0}
                      onClick={() => moveFolder(folder.id, "up")}
                      className="p-1 bg-slate-100 rounded text-slate-600 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      disabled={idx === folders.length - 1}
                      onClick={() => moveFolder(folder.id, "down")}
                      className="p-1 bg-slate-100 rounded text-slate-600 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {tests.filter((t) => !t.folderId).length > 0 && (
            <div
              className="p-2.5 rounded-xl border-2 shadow-sm flex flex-col relative group overflow-hidden transition-all duration-150 hover:shadow-md active:scale-95 hover:border-slate-300"
              style={{
                background: `linear-gradient(145deg, #f8fafc, #f1f5f9)`,
                borderColor: `#e2e8f0`,
              }}
            >
              <div
                className="absolute top-0 right-0 w-20 h-20 opacity-20 rounded-full blur-2xl group-hover:opacity-40 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(to bottom right, #94a3b8, transparent)`,
                }}
              />
              <div
                onClick={() => setActiveFolderId("uncategorized")}
                className="flex items-center gap-2 cursor-pointer flex-1 relative z-10"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0 bg-slate-100 text-slate-500 shadow-sm border border-slate-200 transition-transform duration-200 group-hover:scale-110">
                  📦
                </div>
                <div className="min-w-0 pr-6">
                  <h3 className="font-bold text-slate-900 text-xs leading-tight truncate">
                    Uncategorized
                  </h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    {tests.filter((t) => !t.folderId).length} Tests
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeFolderId && (
        <div className="mb-4 flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <button
            onClick={() => setActiveFolderId(null)}
            className="flex items-center text-slate-600 hover:text-slate-900 font-bold text-sm"
          >
            <ArrowLeft size={16} className="mr-1" /> Back to Folders
          </button>
          <div className="text-xs font-bold text-slate-500 uppercase">
            {
              tests.filter((t) =>
                activeFolderId === "uncategorized"
                  ? !t.folderId
                  : t.folderId === activeFolderId,
              ).length
            }{" "}
            Tests
          </div>
        </div>
      )}

      <div className="mb-4 flex space-x-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilterState("all")}
          className={`shrink-0 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${filterState === "all" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
        >
          All
        </button>
        <button
          onClick={() => setFilterState("live")}
          className={`shrink-0 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${filterState === "live" ? "bg-green-500 text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
        >
          Live
        </button>
        <button
          onClick={() => setFilterState("published")}
          className={`shrink-0 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${filterState === "published" ? "bg-primary-600 text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
        >
          Published
        </button>
        <button
          onClick={() => setFilterState("draft")}
          className={`shrink-0 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${filterState === "draft" ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
        >
          Drafts
        </button>
        <button
          onClick={() => setFilterState("completed")}
          className={`shrink-0 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${filterState === "completed" ? "bg-slate-500 text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
        >
          Completed
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search tests..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
        />
      </div>

      {/* Batch Filters */}
      <div className="mb-6 bg-slate-50/50 border border-slate-100 p-3 rounded-2xl">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          Filter by Batch
        </label>
        <div className="flex space-x-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: "all", label: "All Tests" },
            { id: "ssc cgl", label: "SSC CGL" },
            { id: "ssc chsl", label: "SSC CHSL" },
            { id: "railway", label: "Railway" },
            { id: "banking", label: "Banking" },
            { id: "wbpsc", label: "WBPSC" },
            { id: "police", label: "Police" },
            { id: "custom", label: "Custom Batch" },
          ].map((item) => {
            const isActive = batchFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setBatchFilter(item.id);
                  if (item.id !== "custom") setCustomBatchId("");
                }}
                className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                  isActive
                    ? "bg-primary-600 border-primary-600 text-white shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {batchFilter === "custom" && (
          <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <select
              value={customBatchId}
              onChange={(e) => setCustomBatchId(e.target.value)}
              className="w-full max-w-xs border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white font-medium text-slate-800 shadow-xs"
            >
              <option value="">-- Choose Custom Batch --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchName} ({b.batchCode})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredTests.map((test, idx) => (
          <div
            key={`${test.id || "m-test"}-${idx}`}
            className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all relative group flex flex-col content-visibility-auto gpu-accelerated"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">
                    {test.title}
                  </h3>
                  {test.status === "live" && (
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
                    {test.subject}
                  </span>
                  <span
                    className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded tracking-wider shrink-0 ${
                      test.status === "live"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : test.status === "published"
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                          : test.status === "completed"
                            ? "bg-slate-100 text-slate-500 border border-slate-200"
                            : "bg-amber-50 text-amber-600 border border-amber-200"
                    }`}
                  >
                    {test.status}
                  </span>
                  {test.isPublic && (
                    <span className="text-[8px] uppercase font-black px-1.5 py-0.5 rounded tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-300 shrink-0">
                      Public
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-bold text-slate-500">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-indigo-400" /> <span>{test.duration}m</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                  <div className="flex items-center space-x-1">
                    <FileText className="w-3 h-3 text-emerald-400" />{" "}
                    <span>{test.questions?.length || 0} Qs</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                  <div className="flex items-center space-x-1">
                    <BarChart2 className="w-3 h-3 text-purple-400" />{" "}
                    <span>{test.maximumMarks} Pts</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDuplicate(test)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Duplicate Test"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(test.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete Test"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {test.tags && test.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {test.tags.slice(0, 3).map((tag, tIdx) => (
                  <span
                    key={tIdx}
                    className="text-[8px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider"
                  >
                    {tag}
                  </span>
                ))}
                {test.tags.length > 3 && (
                  <span className="text-[8px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    +{test.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Display Assigned Batches */}
            {((test.batchIds && test.batchIds.length > 0) || test.batchId) && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5 px-1 text-[10px] font-medium text-slate-500">
                <span className="font-bold text-slate-400">Assigned Batches:</span>
                {test.batchIds && test.batchIds.length > 0 ? (
                  test.batchIds.map((bId) => {
                    const batchObj = batches.find((b) => b.id === bId);
                    return (
                      <span key={bId} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md border border-indigo-100 font-medium">
                        {batchObj ? batchObj.batchName : bId}
                      </span>
                    );
                  })
                ) : (
                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md border border-indigo-100 font-medium">
                    {test.batchName || test.batchId}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100/80">
              <button
                onClick={() => setEditTestId(test.id)}
                className="flex flex-1 justify-center items-center gap-1.5 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50/50 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
              >
                <Edit2 className="w-3 h-3" /> <span>Edit</span>
              </button>
              <button
                onClick={() => setAnalyticsTestId(test.id)}
                className="flex flex-1 justify-center items-center gap-1.5 text-slate-600 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50/50 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
              >
                <BarChart2 className="w-3 h-3" /> <span>Analytics</span>
              </button>
              <div className="relative group/status flex-1">
                <button 
                  onClick={() => setStatusModalTestId(test.id)}
                  className="flex w-full justify-center items-center gap-1.5 text-slate-600 hover:text-amber-600 bg-slate-50 hover:bg-amber-50/50 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                >
                  <CheckCircle2 className="w-3 h-3" /> <span>Status</span>
                </button>
              </div>
              <button
                onClick={() => setExportPdfTest(test)}
                className="flex flex-1 justify-center items-center gap-1.5 text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50/50 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
              >
                <FileText className="w-3 h-3" /> <span>PDF</span>
              </button>
            </div>
          </div>
        ))}
        {filteredTests.length === 0 && !loading && (
          <div className="text-center py-12 px-4">
            <h3 className="text-slate-900 font-bold mb-1">No Tests Found</h3>
            <p className="text-slate-500 text-sm">
              Create a new test to get started.
            </p>
          </div>
        )}
        {statusModalTestId && (
          <TestStatusModal
            testId={statusModalTestId}
            onClose={() => setStatusModalTestId(null)}
            onUpdateStatus={handleUpdateStatus}
            onSchedule={handleSchedule}
            onAddToFolder={handleAddToFolder}
            onAssignBatch={handleAssignBatch}
            onDelete={handleDelete}
          />
        )}
      </div>

      {showFolderModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 flex justify-between items-center">
              {editingFolder?.id ? "Edit Folder" : "Create Folder"}
              <button onClick={() => setShowFolderModal(false)}>
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editingFolder?.name || ""}
                  onChange={(e) =>
                    setEditingFolder({ ...editingFolder, name: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Maths"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Emoji Icon
                  </label>
                  <input
                    type="text"
                    value={editingFolder?.icon || "📁"}
                    onChange={(e) =>
                      setEditingFolder({
                        ...editingFolder,
                        icon: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Color HEX
                  </label>
                  <input
                    type="color"
                    value={editingFolder?.color || "#4f46e5"}
                    onChange={(e) =>
                      setEditingFolder({
                        ...editingFolder,
                        color: e.target.value,
                      })
                    }
                    className="w-full h-10 rounded-xl cursor-pointer p-1"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFolder}
                disabled={loading || !editingFolder?.name}
                className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {exportPdfTest && (
        <PrintableTest
          test={exportPdfTest}
          isOpen={!!exportPdfTest}
          onClose={() => setExportPdfTest(null)}
          isMentor={true}
        />
      )}
    </div>
  );
}
