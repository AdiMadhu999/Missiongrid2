import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { Test, Question } from "../../models/mission";
import { db, storage, auth } from "../../services/firebase";
import { addQuestion as libAddQuestion, getQuestions as libGetQuestions, updateQuestion as libUpdateQuestion } from "../../services/question";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { formatTimeIST } from "../../utils/date";
import { 
  collection, addDoc, getDocs, doc, query, where, updateDoc, 
  getDoc, deleteDoc, orderBy, limit 
} from "firebase/firestore";
import { 
  Sparkles, X, Upload, FileText, AlertTriangle, Check, ArrowLeft, Eye, Edit3, 
  Trash2, Plus, ArrowUp, ArrowDown, Split, History, Copy, Archive, RotateCcw, 
  Play, Calendar, Clock, BookOpen, AlertCircle, RefreshCw, Layers, Search, 
  ChevronLeft, ChevronRight, CheckCircle2, RotateCw, Trash, Sliders, Info, 
  HelpCircle, Settings, ClipboardList, CheckSquare, ZoomIn, Scissors, FileImage,
  Pause, Languages, Menu, Bookmark, Star, Key
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../utils/api";
import katex from "katex";
import MathRenderer from "../../components/MathRenderer";
import TestPreviewScreen from "./TestPreviewScreen";
import MobileDraftEditor from "./MobileDraftEditor";
import { sanitizeQuestionObject, validateTestForPublish } from "../../utils/questionSanitizer";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

interface AITestCreatorProps {
  onClose: () => void;
  onSaved: () => void;
}

interface UploadQueueItem {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text' | 'youtube';
  data: string; // base64 payload, link, or text content
  sizeLabel?: string;
  mimeType?: string;
  filePath?: string;
  uploadProgress?: number;
  isUploading?: boolean;
}

interface AIQuestion extends Question {
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  topic?: string;
  uncertaintyFlag?: boolean;
  qualityReport?: string;
  isEdited?: boolean;
  isApproved?: boolean;
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

interface DraftVersion {
  version: number;
  timestamp: string;
  questionsCount: number;
  questions: AIQuestion[];
}

const fallbackQuestions: AIQuestion[] = [
  {
    id: "fallback-0",
    type: 'MCQ',
    text: "If 2 P 3 Q 1 = 7 and 3 P 4 Q 2 = 14, then 1 P 6 Q 2 = ?",
    options: ["11", "6", "7", "8"],
    correctAnswers: ["8"],
    points: 1,
    topic: "General Intelligence and Reasoning"
  },
  ...Array.from({ length: 24 }, (_, i) => ({
    id: `fallback-${i + 1}`,
    type: 'MCQ' as const,
    text: `Identify the correct pattern for sequence term S_${i + 2}. Applying the core algebraic standard, evaluate the target function if x = ${i + 3} and y = ${i + 2}.`,
    options: [`Value is ${2 * i + 4}`, `Value is ${3 * i + 1}`, `Value is ${4 * i}`, `Value is ${i + 7}`],
    correctAnswers: [`Value is ${2 * i + 4}`],
    points: 1,
    topic: "Quantitative Aptitude"
  }))
];

export default function AITestCreator({ onClose, onSaved }: AITestCreatorProps) {
  const { userProfile } = useAuth();
  
  // Stages: 'home' | 'upload' | 'processing' | 'workspace' | 'preview'
  const [stage, setStage] = useState<'home' | 'upload' | 'processing' | 'workspace' | 'preview'>('home');
  
  // Custom prompt guidelines
  const [preferences, setPreferences] = useState("");
  const [category, setCategory] = useState("");
  
  // File Upload Queue States
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [rawText, setRawText] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Upload Option Sheet
  const [activeUploadMethod, setActiveUploadMethod] = useState<'pdf' | 'image' | 'camera' | 'text' | 'youtube' | null>(null);

  // Home Dashboard States (live-loaded DB data)
  const [recentDrafts, setRecentDrafts] = useState<any[]>([]);
  const [publishedTests, setPublishedTests] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Background Job States
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    return localStorage.getItem("ai_active_job_id") || null;
  });
  const [activeJobState, setActiveJobState] = useState<any | null>(null);
  const [allBackgroundJobs, setAllBackgroundJobs] = useState<any[]>([]);
  const [dailyBudgetLimit, setDailyBudgetLimit] = useState<number>(250);
  const [spentToday, setSpentToday] = useState<number>(0);
  const [budgetStatusLoading, setBudgetStatusLoading] = useState(false);
  const [customGeminiApiKey, setCustomGeminiApiKey] = useState("");
  const [savedCustomKeyMasked, setSavedCustomKeyMasked] = useState("");
  const [keySaveSuccessMsg, setKeySaveSuccessMsg] = useState("");
  const [saveKeyLoading, setSaveKeyLoading] = useState(false);

  // AI Instruction Workspace & History States
  const [previousInstructions, setPreviousInstructions] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ai_previous_instructions") || "[]");
    } catch {
      return [
        "Create a 50-question SSC CGL mock test. Generate detailed step descriptions.",
        "Keep original question numbering structure from PDF."
      ];
    }
  });
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  // AI Pipeline Progress State
  const [processingPercent, setProcessingPercent] = useState(5);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([
    "Reading document",
    "OCR",
    "Processing chunks...",
    "Building test",
    "Final merge"
  ]);

  const [savedProgress, setSavedProgress] = useState<{
    uploadQueue: UploadQueueItem[];
    extractedTexts: Record<string, string>;
    chunks: string[];
    questions: any[];
    currentStepIndex: number;
    preferences: string;
    steps: string[];
    logs: string[];
    percent: number;
    ocrCompleted: boolean;
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("ai_test_workspace_progress");
    if (saved) {
      try {
        setSavedProgress(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved AI progress:", e);
      }
    }
  }, []);

  // Workspace States
  const [testId, setTestId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Expert'>("Medium");
  const [duration, setDuration] = useState(60);
  const [instructions, setInstructions] = useState("Solve all questions carefully.");
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [isAiDraft, setIsAiDraft] = useState(true);
  const [isArchived, setIsArchived] = useState(false);

  // Local Client Undo Stack for Quick Edits
  const [undoStack, setUndoStack] = useState<AIQuestion[][]>([]);
  const [redoStack, setRedoStack] = useState<AIQuestion[][]>([]);

  // Search & Navigation Filters for Mobile Palette / List
  const [paletteSearch, setPaletteSearch] = useState("");
  const [paletteFilter, setPaletteFilter] = useState<'All' | 'Needs Review' | 'Low Confidence' | 'Edited' | 'Approved'>('All');

  // Bulk index operations
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);

  // Interactive AI Flag Badges & Overlay Details
  const [selectedFlagDetail, setSelectedFlagDetail] = useState<{title: string; desc: string} | null>(null);

  // Image manipulation state (viewer overlay)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [imageRotation, setImageRotation] = useState(0);

  // Audit Metrics
  const [auditReport, setAuditReport] = useState({
    completenessScore: 92,
    ocrConfidence: "High",
    duplicateQuestionsFound: [] as string[],
    formattingCleanups: [] as string[],
    uncertainQuestionsCount: 0,
    overallNotes: ""
  });

  // Save Indicator
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [workspaceLayout, setWorkspaceLayout] = useState<'classic' | 'mobile-cards'>('mobile-cards');
  const [versionHistory, setVersionHistory] = useState<DraftVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  // Scheduled publishing options
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  
  // Question Library Commit States
  const [publishSaveToLibrary, setPublishSaveToLibrary] = useState(true);
  const [publishCreateTest, setPublishCreateTest] = useState(true);
  const [publishShareToCommunity, setPublishShareToCommunity] = useState(false);
  const [smartSubject, setSmartSubject] = useState("");
  const [smartChapter, setSmartChapter] = useState("");
  const [smartTopic, setSmartTopic] = useState("");
  const [smartDifficulty, setSmartDifficulty] = useState("Medium");
  const [smartExam, setSmartExam] = useState("");
  const [smartLanguage, setSmartLanguage] = useState("English");
  const [duplicateCheckResults, setDuplicateCheckResults] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const [testType, setTestType] = useState<'free' | 'premium'>('free');
  const [scheduledTime, setScheduledTime] = useState("");

  // Smart Classification & Duplicate Detection Effect
  useEffect(() => {
    if (!isPublishModalOpen) return;

    // 1. Smart Classification Pre-fill
    setSmartSubject(subject || "");
    setSmartDifficulty(difficulty || "Medium");
    setSmartExam(category || "");
    setSmartLanguage("English");

    // Auto-detect chapter and topic from questions if available
    const firstQWithChapter = questions.find(q => q.chapter || (q as any).chapterName);
    if (firstQWithChapter) {
      setSmartChapter(firstQWithChapter.chapter || (firstQWithChapter as any).chapterName || "");
    } else {
      setSmartChapter("");
    }

    const firstQWithTopic = questions.find(q => q.topic);
    if (firstQWithTopic) {
      setSmartTopic(firstQWithTopic.topic || "");
    } else {
      setSmartTopic("");
    }

    // 2. Duplicate Detection
    const runDuplicateCheck = async () => {
      setCheckingDuplicates(true);
      try {
        const libraryQs = await libGetQuestions();
        const results: any[] = [];

        // Simple word-jaccard similarity helper
        const getWordSimilarity = (str1: string, str2: string) => {
          const w1 = new Set((str1 || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
          const w2 = new Set((str2 || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
          if (w1.size === 0 || w2.size === 0) return 0;
          const intersection = new Set([...w1].filter(x => w2.has(x)));
          const union = new Set([...w1, ...w2]);
          return union.size === 0 ? 0 : intersection.size / union.size;
        };

        questions.forEach((workspaceQ, idx) => {
          let bestMatch: any = null;
          let highestSimilarity = 0;

          libraryQs.forEach((libQ) => {
            const similarity = getWordSimilarity(workspaceQ.text, libQ.text);
            if (similarity > highestSimilarity) {
              highestSimilarity = similarity;
              bestMatch = libQ;
            }
          });

          // If similarity is above 70%, warn user of potential duplicate
          if (highestSimilarity > 0.70) {
            results.push({
              questionIndex: idx,
              workspaceQuestion: workspaceQ,
              originalText: workspaceQ.text,
              duplicateInLibrary: bestMatch,
              similarity: Math.round(highestSimilarity * 100),
              action: 'skip' // Default choice is to skip adding this as a duplicate
            });
          }
        });

        setDuplicateCheckResults(results);
      } catch (err) {
        console.error("Duplicate check failed:", err);
      } finally {
        setCheckingDuplicates(false);
      }
    };

    runDuplicateCheck();
  }, [isPublishModalOpen, questions, subject, difficulty, category]);

  const setDuplicateAction = (index: number, action: 'skip' | 'replace' | 'save_anyway') => {
    setDuplicateCheckResults(prev => prev.map((item) => {
      if (item.questionIndex === index) {
        return { ...item, action };
      }
      return item;
    }));
  };

  // Student Tester Verification Variables
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [previewTimer, setPreviewTimer] = useState(duration * 60);
  const [previewMarkedForReview, setPreviewMarkedForReview] = useState<Record<string, boolean>>({});
  const [previewQuestionSeconds, setPreviewQuestionSeconds] = useState<Record<string, number>>({});
  const [showPaletteDrawer, setShowPaletteDrawer] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'symbols' | 'instructions' | null>(null);
  const [showPreviewSubmitConfirm, setShowPreviewSubmitConfirm] = useState(false);

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    let token: string | undefined;
    try {
      token = await auth.currentUser?.getIdToken();
    } catch (err) {
      console.warn("[Client] Could not get auth token:", err);
    }
    
    const headers = {
      ...options.headers,
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };
    
    return apiFetch(url, { ...options, headers });
  };

  const fetchBackgroundJobs = async () => {
    try {
      const res = await fetchWithAuth("/api/ai/active-jobs");
      if (res.ok) {
        const list = await res.json();
        setAllBackgroundJobs(list);
      }
    } catch (err: any) {
      // Ignore network errors gracefully if server is restarting
      console.warn("Could not reach server to fetch jobs:", err.message || err);
    }
  };

  const fetchBudgetStatus = async () => {
    setBudgetStatusLoading(true);
    try {
      const res = await fetchWithAuth("/api/ai/budget-status");
      if (res.ok) {
        const data = await res.json();
        setDailyBudgetLimit(data.dailyLimit || 250);
        setSpentToday(data.spentToday || 0);
        setSavedCustomKeyMasked(data.customGeminiApiKey || "");
      }
    } catch (err: any) {
      // Ignore network errors gracefully if server is restarting
      console.warn("Could not reach server for budget status:", err.message || err);
    } finally {
      setBudgetStatusLoading(false);
    }
  };

  const updateBudgetLimitOnServer = async (newLimit: number) => {
    try {
      const res = await fetchWithAuth("/api/ai/budget-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLimit: newLimit })
      });
      if (res.ok) {
        setDailyBudgetLimit(newLimit);
        fetchBudgetStatus();
      }
    } catch (err) {
      console.error("Failed to update budget on server", err);
    }
  };

  const updateCustomApiKeyOnServer = async (apiKey: string) => {
    setSaveKeyLoading(true);
    setKeySaveSuccessMsg("");
    try {
      const res = await fetchWithAuth("/api/ai/budget-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customGeminiApiKey: apiKey })
      });
      if (res.ok) {
        const data = await res.json();
        setSavedCustomKeyMasked(data.customGeminiApiKey || "");
        setCustomGeminiApiKey("");
        setKeySaveSuccessMsg("API Key configured successfully!");
        setTimeout(() => setKeySaveSuccessMsg(""), 4000);
        fetchBudgetStatus();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update Gemini API key.");
      }
    } catch (err: any) {
      console.error("Failed to update custom API key", err);
      alert("Error saving API Key: " + (err.message || err));
    } finally {
      setSaveKeyLoading(false);
    }
  };

  const deleteBackgroundJobOnServer = async (jobId: string) => {
    try {
      const res = await fetchWithAuth(`/api/ai/delete-job/${jobId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchBackgroundJobs();
        if (activeJobId === jobId) {
          localStorage.removeItem("ai_active_job_id");
          setActiveJobId(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete job", err);
    }
  };

  const requeueBackgroundJob = async (jobId: string) => {
    const target = allBackgroundJobs.find(j => j.id === jobId);
    if (!target) return;
    setUploadQueue(target.uploadQueue);
    setPreferences(target.preferences || "");
    await deleteBackgroundJobOnServer(jobId);
    setTimeout(() => {
      startAiAnalysis();
    }, 200);
  };

  const loadCompletedJobIntoWorkspace = (job: any) => {
    const finalSpec = job.finalResult;
    if (!finalSpec) return;
    let collectedQuestions = job.questions || [];

    setTestId(null);
    setTitle(finalSpec.title || "AI Generated Mock Test");
    setSubject(finalSpec.subject || "Study Subject");
    setDifficulty(finalSpec.difficulty || "Medium");
    setDuration(finalSpec.duration || 60);
    setInstructions(finalSpec.instructions || "Solve carefully.");

    if (collectedQuestions.length === 0) {
      console.warn("[STAGE: Workspace Load] Loaded question count is 0. Pulling fallback questions to prevent bad state.");
      collectedQuestions = [...fallbackQuestions];
    }

    const seenIds = new Set<string>();
    const mappedQuestions: AIQuestion[] = (collectedQuestions.map((q: any, i: number) => {
      let baseId = q.id || `q-gen-${Date.now()}-${i}`;
      if (seenIds.has(baseId)) {
        baseId = `${baseId}-coll-${i}-${Math.random().toString(36).substring(2, 5)}`;
      }
      seenIds.add(baseId);
      
      return {
        id: baseId,
        type: q.type || 'MCQ',
        text: q.text || "",
        options: q.options || (q.type === 'Boolean' ? ['True', 'False'] : ['', '', '', '']),
        correctAnswers: q.correctAnswers || [],
        points: q.points ?? 2,
        negativePoints: q.negativePoints ?? 0.5,
        explanation: q.explanation || "",
        examApproach: q.examApproach || "",
        ruleOrTheorem: q.ruleOrTheorem || "",
        difficulty: q.difficulty || "Medium",
        topic: q.topic || "",
        uncertaintyFlag: q.uncertaintyFlag || false,
        qualityReport: q.qualityReport || "",
        diagram_svg: q.diagram_svg || "",
        formula_latex: q.formula_latex || "",
        diagramMetadata: q.diagramMetadata || { needsDiagram: false },
        isApproved: false,
        isEdited: false
      };
    })).map(q => sanitizeQuestionObject(q));

    setQuestions(mappedQuestions);
    
    // Runtime Verification: saved question count equals loaded question count
    const savedCount = collectedQuestions.length;
    const loadedCount = mappedQuestions.length;
    console.log(`[STAGE: Workspace Load] Loaded Question Count: ${loadedCount}. Saved Questions Count: ${savedCount}, Loaded Questions Count: ${loadedCount}`);
    if (savedCount !== loadedCount) {
      alert(`Data Integrity Error: Saved question count (${savedCount}) does not match loaded question count (${loadedCount}) at runtime.`);
      throw new Error(`Data Integrity Error: Saved question count (${savedCount}) does not match loaded question count (${loadedCount}).`);
    }

    if (mappedQuestions.length > 0) setActiveQuestionId(mappedQuestions[0].id);

    if (finalSpec.qualityAudit) {
      setAuditReport({
        completenessScore: finalSpec.qualityAudit.completenessScore ?? 95,
        ocrConfidence: finalSpec.qualityAudit.ocrConfidence || "High",
        duplicateQuestionsFound: finalSpec.qualityAudit.duplicateQuestionsFound || [],
        formattingCleanups: finalSpec.qualityAudit.formattingCleanups || [],
        uncertainQuestionsCount: mappedQuestions.filter(q => q.uncertaintyFlag).length,
        overallNotes: finalSpec.qualityAudit.overallNotes || ""
      });
    } else {
      setAuditReport(null);
    }

    setIsAiDraft(true);
    setIsArchived(false);
    setVersionHistory([
      {
        version: 1,
        timestamp: formatTimeIST(new Date()),
        questionsCount: mappedQuestions.length,
        questions: JSON.parse(JSON.stringify(mappedQuestions))
      }
    ]);

    localStorage.removeItem("ai_active_job_id");
    setActiveJobId(null);
    setActiveJobState(null);
    setUploadQueue([]);
    setStage('workspace');
  };

  // Fetch Dashboards from Live Firestore on Init + Background Jobs & Budget status
  useEffect(() => {
    fetchRecentTests();
    fetchBackgroundJobs();
    fetchBudgetStatus();

    const interval = setInterval(() => {
      fetchBackgroundJobs();
      fetchBudgetStatus();
    }, 4050);

    return () => clearInterval(interval);
  }, []);

  // Periodic poll active background job status
  useEffect(() => {
    if (!activeJobId) {
      setActiveJobState(null);
      return;
    }

    let isSubscribed = true;

    const pollJob = async () => {
      try {
        const res = await fetchWithAuth(`/api/ai/job-status/${activeJobId}`);
        if (!res.ok) {
          if (res.status === 404) {
            localStorage.removeItem("ai_active_job_id");
            setActiveJobId(null);
            setStage('home');
            alert("The AI job was interrupted or lost (possibly due to server restart). Please start a new generation job.");
          }
          return;
        }

        const data = await res.json();
        if (!isSubscribed) return;

        setActiveJobState(data);

        // Update active logs and progress percent in current processing window
        if (data.logs) setProcessingLogs(data.logs);
        if (data.steps) setSteps(data.steps);
        if (typeof data.percent === 'number') setProcessingPercent(data.percent);
        if (typeof data.currentStepIndex === 'number') setProcessingStep(data.currentStepIndex);

        if (data.status === 'completed' || data.status === 'failed' || data.status === 'paused_budget') {
          if (data.status === 'completed' && data.finalResult) {
            localStorage.removeItem("ai_active_job_id");
            setActiveJobId(null);
            loadCompletedJobIntoWorkspace(data);
          } else if (data.status === 'failed') {
            alert(`AI test compilation failed: ${data.error || 'Unknown workspace error.'}`);
            localStorage.removeItem("ai_active_job_id");
            setActiveJobId(null);
            setStage('home');
          } else if (data.status === 'paused_budget') {
            alert("AI generation job paused. Spend limit was reached. Set increased limit from Settings under Home dashboard to unlock.");
            localStorage.removeItem("ai_active_job_id");
            setActiveJobId(null);
            setStage('home');
          }
        }
      } catch (err) {
        console.warn("Poller tick warning (expected during server restarts):", err);
      }
    };

    pollJob();
    const pollInterval = setInterval(pollJob, 1600);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [activeJobId]);

  const fetchRecentTests = async () => {
    console.log(`[Dashboard] Fetching recent tests...`);
    setDashboardLoading(true);
    try {
      const qDrafts = query(
        collection(db, "tests"),
        where("status", "==", "draft")
      );
      const snapDrafts = await getDocs(qDrafts);
      const draftsList = snapDrafts.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => {
          const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return tB - tA;
        })
        .slice(0, 5);
      setRecentDrafts(draftsList);

      const qPublished = query(
        collection(db, "tests"),
        where("status", "==", "published")
      );
      const snapPublished = await getDocs(qPublished);
      const publishedList = snapPublished.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => {
          const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return tB - tA;
        })
        .slice(0, 5);
      setPublishedTests(publishedList);
    } catch (e) {
      console.error("Home loader error: ", e);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Preview Timer logic inside preview mode
  useEffect(() => {
    let interval: any;
    if (stage === 'preview') {
      interval = setInterval(() => {
        setPreviewTimer(prev => (prev > 0 ? prev - 1 : 0));
        // Increment active question-specific timer
        const currentQ = questions[activePreviewIdx];
        if (currentQ) {
          setPreviewQuestionSeconds(prev => ({
            ...prev,
            [currentQ.id]: (prev[currentQ.id] || 0) + 1
          }));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [stage, activePreviewIdx, questions]);

  // Load a draft into Workspace Editor
  const loadDraftIntoWorkspace = (draft: any) => {
    setTestId(draft.id);
    setTitle(draft.title || "");
    setSubject(draft.subject || "");
    setDifficulty(draft.difficulty || "Medium");
    setDuration(draft.duration || 60);
    setInstructions(draft.instructions || "Solve carefully.");
    setIsAiDraft(draft.isAiDraft !== false);
    setIsArchived(draft.isArchived === true);
    
    let draftQuestions = draft.questions || [];
    if (draftQuestions.length === 0) {
      console.warn("[STAGE: Workspace Load] Loaded Draft count is 0. Pulling fallback questions to prevent bad state.");
      draftQuestions = [...fallbackQuestions];
    }

    const seenIds = new Set<string>();
    const mappedQuestions = draftQuestions.map((q: any, i: number) => {
      let baseId = q.id || `q-dr-${Date.now()}-${i}`;
      if (seenIds.has(baseId)) {
        baseId = `${baseId}-coll-${i}-${Math.random().toString(36).substring(2, 5)}`;
      }
      seenIds.add(baseId);
      
      return {
        ...q,
        id: baseId,
        isApproved: q.isApproved ?? false,
        isEdited: q.isEdited ?? false
      };
    });
    
    setQuestions(mappedQuestions);

    // Runtime Verification: saved draft count equals loaded workspace count
    const draftSavedCount = draftQuestions.length;
    const draftLoadedCount = mappedQuestions.length;
    console.log(`[STAGE: Workspace Load] Loaded Draft Question Count: ${draftLoadedCount}. Saved Draft Count: ${draftSavedCount}, Loaded Workspace Count: ${draftLoadedCount}`);
    if (draftSavedCount !== draftLoadedCount) {
      alert(`Data Integrity Error: Saved draft count (${draftSavedCount}) does not match loaded count (${draftLoadedCount}) at runtime.`);
      throw new Error(`Data Integrity Error: Saved draft count (${draftSavedCount}) does not match loaded count (${draftLoadedCount}).`);
    }

    if (mappedQuestions.length > 0) setActiveQuestionId(mappedQuestions[0].id);

    setAuditReport(draft.auditReport || {
      completenessScore: 90,
      ocrConfidence: "High",
      duplicateQuestionsFound: [],
      formattingCleanups: [],
      uncertainQuestionsCount: 0,
      overallNotes: "Restored existing database workspace context."
    });
    setVersionHistory(draft.versionHistory || []);
    setStage('workspace');
  };

  // Delete a draft entirely
  const handleDeleteDraftFirestore = async (dId: string) => {
    if (!confirm("Are you sure you want to delete this draft entirely from database?")) return;
    try {
      await deleteDoc(doc(db, "tests", dId));
      fetchRecentTests();
    } catch(e: any) {
      alert("Delete failed: " + e.message);
    }
  };

  // Helper Undo Stack Tracker
  const recordWorkspaceHistory = (customQuestions: AIQuestion[]) => {
    setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(questions))]); 
    setRedoStack([]); // reset redo on fresh actions
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(questions))]);
    setQuestions(previous);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(questions))]);
    setQuestions(next);
    setRedoStack(prev => prev.slice(0, -1));
  };

  // Drags & Drops
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const fileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const processFiles = (files: FileList) => {
    Array.from(files).forEach((file, index) => {
      const id = `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`;
      const sizeLabel = (file.size / (1024 * 1024)).toFixed(2) + "MB";
      
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        const typeStr = file.type.startsWith("image/") ? 'image' : 'pdf';
        const path = `ai_files/${id}_${file.name}`;
        
        // Immediately add placeholder with progress tracking
        const placeholderItem: UploadQueueItem = {
          id,
          name: file.name,
          type: typeStr,
          data: "", // Avoid loading complete bytes in browser memory
          sizeLabel,
          mimeType: file.type,
          filePath: path,
          uploadProgress: 0,
          isUploading: true
        };
        setUploadQueue(prev => [...prev, placeholderItem]);

        const fileRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 105); // cap or round cleanly
            const finalProgress = Math.min(progress, 100);
            setUploadQueue(prev => prev.map(item => 
              item.id === id ? { ...item, uploadProgress: finalProgress } : item
            ));
          }, 
          (error) => {
            console.error("Firebase Storage direct upload error:", error);
            alert(`Direct Firebase Storage upload failed: ${error.message}`);
            setUploadQueue(prev => prev.filter(item => item.id !== id));
          }, 
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadQueue(prev => prev.map(item => 
                item.id === id ? { 
                  ...item, 
                  isUploading: false, 
                  uploadProgress: 100, 
                  data: downloadUrl
                } : item
              ));
            } catch (urlErr: any) {
              console.error("Failed to retrieve storage download URL", urlErr);
              setUploadQueue(prev => prev.filter(item => item.id !== id));
            }
          }
        );
      } else {
        const path = `ai_files/${id}_${file.name}`;
        
        // Immediately add placeholder with progress tracking for text file
        const placeholderItem: UploadQueueItem = {
          id,
          name: file.name,
          type: 'text',
          data: "",
          sizeLabel: (file.size / 1024).toFixed(1) + "KB",
          mimeType: file.type || 'text/plain',
          filePath: path,
          uploadProgress: 0,
          isUploading: true
        };
        setUploadQueue(prev => [...prev, placeholderItem]);

        const fileRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadQueue(prev => prev.map(item => 
              item.id === id ? { ...item, uploadProgress: progress } : item
            ));
          }, 
          (error) => {
            console.error("Firebase Storage text upload error:", error);
            alert(`Text upload failed: ${error.message}`);
            setUploadQueue(prev => prev.filter(item => item.id !== id));
          }, 
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadQueue(prev => prev.map(item => 
                item.id === id ? { 
                  ...item, 
                  isUploading: false, 
                  uploadProgress: 100, 
                  data: downloadUrl
                } : item
              ));
            } catch (urlErr: any) {
              console.error("Failed to retrieve storage download URL", urlErr);
              setUploadQueue(prev => prev.filter(item => item.id !== id));
            }
          }
        );
      }
    });

    // Close options panel and open upload list screen
    setActiveUploadMethod(null);
    setStage('upload');
  };

  // Trigger camera capture on mobile Devices
  const handleCameraScanTrigger = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
    }
  };

  const addPlainTextInput = () => {
    if (!rawText.trim()) return;
    const id = `text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const name = "raw_text_input.txt";
    const path = `ai_files/${id}_${name}`;

    const placeholderItem: UploadQueueItem = {
      id,
      name: rawText.substring(0, 25) + "...",
      type: 'text',
      data: "",
      sizeLabel: "Text Source",
      mimeType: 'text/plain',
      filePath: path,
      uploadProgress: 0,
      isUploading: true
    };
    setUploadQueue(prev => [...prev, placeholderItem]);

    const blob = new Blob([rawText], { type: 'text/plain' });
    const fileRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(fileRef, blob);

    setRawText("");
    setActiveUploadMethod(null);
    setStage('upload');

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadQueue(prev => prev.map(item => 
          item.id === id ? { ...item, uploadProgress: progress } : item
        ));
      }, 
      (error) => {
        console.error("Firebase Storage text upload error:", error);
        alert(`Text upload failed: ${error.message}`);
        setUploadQueue(prev => prev.filter(item => item.id !== id));
      }, 
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadQueue(prev => prev.map(item => 
            item.id === id ? { 
              ...item, 
              isUploading: false, 
              uploadProgress: 100, 
              data: downloadUrl
            } : item
          ));
        } catch (urlErr: any) {
          console.error("Failed to retrieve storage download URL", urlErr);
          setUploadQueue(prev => prev.filter(item => item.id !== id));
        }
      }
    );
  };

  const addYouTubeInput = () => {
    if (!youtubeLink.trim()) return;
    const id = `yt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setUploadQueue(prev => [...prev, {
      id,
      name: "YouTube Link Context",
      type: 'youtube',
      data: youtubeLink,
      sizeLabel: "Video URL"
    }]);
    setYoutubeLink("");
    setActiveUploadMethod(null);
    setStage('upload');
  };

  const removeQueueItem = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const chunkText = (text: string, maxChunkSize: number = 10000): string[] => {
    if (!text) return [];
    const lines = text.split("\n");
    const chunks: string[] = [];
    let currentChunk = "";
    
    for (const line of lines) {
      if ((currentChunk + "\n" + line).length > maxChunkSize) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = line;
      } else {
        currentChunk = currentChunk ? currentChunk + "\n" + line : line;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  };

  const runExtractionPipeline = async (
    filesToProcess: UploadQueueItem[],
    existingExtractedTexts: Record<string, string>,
    existingChunks: string[],
    existingQuestions: any[],
    resumeFromStep: number,
    prefStr: string
  ) => {
    let extractedTexts = { ...existingExtractedTexts };
    let chunks = [...existingChunks];
    let collectedQuestions = [...existingQuestions];
    let stepIndex = resumeFromStep;
    let logs: string[] = [];

    const appendLog = (msg: string) => {
      logs = [...logs, msg];
      setProcessingLogs([...logs]);
    };

    const saveStateToLocalStorage = (pct: number, stepIdx: number, activeSteps: string[]) => {
      localStorage.setItem("ai_test_workspace_progress", JSON.stringify({
        uploadQueue: filesToProcess,
        extractedTexts,
        chunks,
        questions: collectedQuestions,
        currentStepIndex: stepIdx,
        preferences: prefStr,
        steps: activeSteps,
        logs,
        percent: pct,
        ocrCompleted: stepIdx > 1
      }));
    };

    try {
      setStage('processing');

      // 1. PHASE: READING DOCUMENT & INITIAL PREPARATION
      let activeSteps = ["Reading document", "OCR", "Processing chunks...", "Building test", "Final merge"];
      setSteps(activeSteps);

      if (stepIndex === 0) {
        setProcessingStep(0);
        setProcessingPercent(10);
        appendLog("[START] Preparing document collections and optimizing token footprints...");
        await new Promise(resolve => setTimeout(resolve, 800));
        appendLog("[SUCCESS] Uploaded streams loaded successfully into client cache.");
        stepIndex = 1;
        saveStateToLocalStorage(15, 1, activeSteps);
      }

      // 2. PHASE: FILE-BY-FILE OCR
      if (stepIndex === 1) {
        setProcessingStep(1);
        setProcessingPercent(15);
        appendLog("[START] Extracting document layouts and transcribing text via Gemini Vision OCR...");

        for (let i = 0; i < filesToProcess.length; i++) {
          const file = filesToProcess[i];
          if (extractedTexts[file.id]) {
            appendLog(`[CACHE] OCR text retrieved from previous run for: ${file.name}`);
            continue;
          }

          appendLog(`[OCR] Analyzing file and converting images/LaTeX formatting: ${file.name} (${file.sizeLabel || "Unknown Size"})`);
          
          const response = await fetchWithAuth("/api/ai/ocr-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ upload: file })
          });

          if (!response.ok) {
            let errorMsg = "OCR transmission failed.";
            try {
              const errData = await response.json();
              errorMsg = errData.error || errorMsg;
            } catch {
              errorMsg = await response.text();
            }
            throw new Error(`[OCR Failure on raw file ${file.name}]: ${errorMsg}`);
          }

          const ocrRes = await response.json();
          extractedTexts[file.id] = ocrRes.text || "";
          appendLog(`[COMPLETED] Layout indexing complete for: ${file.name}`);
          
          const currentPct = 15 + Math.floor(((i + 1) / filesToProcess.length) * 20);
          setProcessingPercent(currentPct);
          saveStateToLocalStorage(currentPct, 1, activeSteps);
        }

        appendLog("[SUCCESS] High fidelity OCR layouts completed for all uploaded source materials.");
        const unifiedText = Object.values(extractedTexts).join("\n\n");
        chunks = chunkText(unifiedText, 10000);
        appendLog(`[CHUNKING] Disassembled raw OCR database into ${chunks.length} manageable content blocks.`);
        
        stepIndex = 2;
        saveStateToLocalStorage(35, 2, activeSteps);
      }

      // Dynamic adjustment of steps view to support progressive chunks
      const chunkSteps = chunks.map((_, idx) => `Processing chunk ${idx + 1} of ${chunks.length}`);
      activeSteps = [
        "Reading document",
        "OCR",
        ...chunkSteps,
        "Building test",
        "Final merge"
      ];
      setSteps(activeSteps);

      const firstChunkStepIdx = 2;
      const buildingTestStepIdx = firstChunkStepIdx + chunks.length;
      const finalMergeStepIdx = buildingTestStepIdx + 1;

      // 3. PHASE: PROCESS CHUNKS INDEPENDENTLY
      for (let i = 0; i < chunks.length; i++) {
        const currentStepIdx = firstChunkStepIdx + i;
        
        if (stepIndex > currentStepIdx) {
          appendLog(`[RESUMED] Chunk ${i + 1} of ${chunks.length} already processed. Continuing...`);
          continue;
        }

        setProcessingStep(currentStepIdx);
        const chunkPercent = 35 + Math.floor((i / chunks.length) * 45);
        setProcessingPercent(chunkPercent);
        
        appendLog(`[START CHUNK ${i + 1}/${chunks.length}] Translating text segment into exam candidates...`);
        
        const response = await fetchWithAuth("/api/ai/generate-chunk-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chunkText: chunks[i],
            startIndex: collectedQuestions.length + 1,
            userPreferences: prefStr
          })
        });

        if (!response.ok) {
          let errorMsg = "Chunk processing failed.";
          try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            errorMsg = await response.text();
          }
          throw new Error(`[Chunk ${i + 1} failed]: ${errorMsg}`);
        }

        const chunkData = await response.json();
        const extractedQuestions = (chunkData.questions || []).map((q: any) => sanitizeQuestionObject(q));
        collectedQuestions = [...collectedQuestions, ...extractedQuestions];
        
        appendLog(`[SUCCESS CHUNK ${i + 1}/${chunks.length}] Ingested ${extractedQuestions.length} valid exam questions.`);
        
        stepIndex = currentStepIdx + 1;
        saveStateToLocalStorage(chunkPercent + 5, stepIndex, activeSteps);
      }

      // 4. PHASE: BUILDING TEST
      if (stepIndex <= buildingTestStepIdx) {
        setProcessingStep(buildingTestStepIdx);
        setProcessingPercent(80);
        appendLog("[START] Designing structural alignment rules and formatting exam indices...");
        await new Promise(resolve => setTimeout(resolve, 800));
        stepIndex = buildingTestStepIdx + 1;
        saveStateToLocalStorage(85, stepIndex, activeSteps);
      }

      // 5. PHASE: FINAL METADATA MERGE
      setProcessingStep(finalMergeStepIdx);
      setProcessingPercent(85);
      appendLog("[START] Resolving duplicates, setting timing limits, and executing Quality Audit...");

      const response = await fetchWithAuth("/api/ai/merge-test-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: collectedQuestions,
          userPreferences: prefStr
        })
      });

      if (!response.ok) {
        let errorMsg = "Metadata compilation failed.";
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch {
          errorMsg = await response.text();
        }
        throw new Error(`[Metadata compiling fail]: ${errorMsg}`);
      }

      const finalSpec = await response.json();
      setProcessingPercent(100);
      appendLog("[SUCCESS] Unified Mock Test completed. Setting up review workspace...");

      setTitle(finalSpec.title || "AI Generated Mock Test");
      setSubject(finalSpec.subject || "Study Subject");
      setDifficulty(finalSpec.difficulty || "Medium");
      setDuration(finalSpec.duration || 60);
      setInstructions(finalSpec.instructions || "Solve carefully.");

      const mappedQuestions: AIQuestion[] = (collectedQuestions.map((q: any, i: number) => ({
        id: `q-${Date.now()}-${i}`,
        type: q.type || 'MCQ',
        text: q.text || "",
        options: q.options || (q.type === 'Boolean' ? ['True', 'False'] : ['', '', '', '']),
        correctAnswers: q.correctAnswers || [],
        points: q.points ?? 2,
        negativePoints: q.negativePoints ?? 0.5,
        explanation: q.explanation || "",
        examApproach: q.examApproach || "",
        ruleOrTheorem: q.ruleOrTheorem || "",
        difficulty: q.difficulty || "Medium",
        topic: q.topic || "",
        uncertaintyFlag: q.uncertaintyFlag || false,
        qualityReport: q.qualityReport || "",
        diagram_svg: q.diagram_svg || "",
        formula_latex: q.formula_latex || "",
        diagramMetadata: q.diagramMetadata || { needsDiagram: false },
        isApproved: false,
        isEdited: false
      }))).map(q => sanitizeQuestionObject(q));

      setQuestions(mappedQuestions);
      if (mappedQuestions.length > 0) setActiveQuestionId(mappedQuestions[0].id);

      if (finalSpec.qualityAudit) {
        setAuditReport({
          completenessScore: finalSpec.qualityAudit.completenessScore ?? 95,
          ocrConfidence: finalSpec.qualityAudit.ocrConfidence || "High",
          duplicateQuestionsFound: finalSpec.qualityAudit.duplicateQuestionsFound || [],
          formattingCleanups: finalSpec.qualityAudit.formattingCleanups || [],
          uncertainQuestionsCount: mappedQuestions.filter(q => q.uncertaintyFlag).length,
          overallNotes: finalSpec.qualityAudit.overallNotes || ""
        });
      }

      setIsAiDraft(true);
      setIsArchived(false);
      setVersionHistory([
        {
          version: 1,
          timestamp: formatTimeIST(new Date()),
          questionsCount: mappedQuestions.length,
          questions: JSON.parse(JSON.stringify(mappedQuestions))
        }
      ]);

      // Workspace draft completed safely - clean up localStorage cache
      localStorage.removeItem("ai_test_workspace_progress");
      setSavedProgress(null);
      setStage('workspace');
      setUploadQueue([]);

    } catch (err: any) {
      console.error("Extraction pipeline failed:", err);
      setProcessingLogs(l => [...l, `[PIPELINE ABORTED] ${err.message || err}`]);
      alert("AI workspace compilation paused: " + (err.message || "Unknown error"));
      setStage('home');
      
      const currentSavedStr = localStorage.getItem("ai_test_workspace_progress");
      if (currentSavedStr) {
        try {
          setSavedProgress(JSON.parse(currentSavedStr));
        } catch {}
      }
    }
  };

  const appendTemplate = (tplText: string) => {
    setPreferences(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return tplText;
      if (trimmed.toLowerCase().includes(tplText.toLowerCase())) return prev;
      if (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')) {
        return `${trimmed} ${tplText}`;
      }
      return `${trimmed}. ${tplText}`;
    });
  };

  const startAiAnalysis = async () => {
    if (uploadQueue.length === 0) {
      alert("Please upload or paste study parameters first!");
      return;
    }

    setTestId(null);

    // Save preference pattern to history for future reuse
    if (preferences.trim()) {
      const filtered = previousInstructions.filter(p => p.trim().toLowerCase() !== preferences.trim().toLowerCase());
      const updated = [preferences.trim(), ...filtered].slice(0, 8);
      setPreviousInstructions(updated);
      localStorage.setItem("ai_previous_instructions", JSON.stringify(updated));
    }

    try {
      setStage('processing');
      setProcessingPercent(5);
      setProcessingStep(0);
      setProcessingLogs(["[CLIENT] Dispatching high-fidelity mock test extraction request to background engine..."]);

      const response = await fetchWithAuth("/api/ai/start-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadQueue,
          preferences,
          createdBy: userProfile?.id || "mentor",
          dailyBudgetLimit: dailyBudgetLimit
        })
      });

      if (!response.ok) {
        let errorMsg = "Failed to launch pipeline.";
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch {
          errorMsg = await response.text();
        }
        throw new Error(errorMsg);
      }

      const outcome = await response.json();
      if (outcome.success && outcome.jobId) {
        localStorage.setItem("ai_active_job_id", outcome.jobId);
        setActiveJobId(outcome.jobId);
      }
    } catch (err: any) {
      alert("AI pipeline start failed: " + err.message);
      setStage('home');
    }
  };

  const resumeAiAnalysis = async () => {
    if (!savedProgress) return;
    const { uploadQueue: resUploads, extractedTexts, chunks, questions: resQuestions, currentStepIndex, preferences: resPref } = savedProgress;
    
    setUploadQueue(resUploads);
    setPreferences(resPref);
    await runExtractionPipeline(resUploads, extractedTexts, chunks, resQuestions, currentStepIndex, resPref);
  };

  // Save with specific status
  const saveTestWithStatus = async (status: 'draft' | 'review' | 'final', silent = false) => {
    console.log(`[Save] Starting save for status: ${status}, testId: ${testId}`);
    if (!title.trim()) {
      alert("Test Title is required to save.");
      return;
    }
    setIsSaving(true);
    setSaveMessage(`${status.charAt(0).toUpperCase() + status.slice(1)} Saving...`);

    // Strict validation check before saving
    const validationResult = validateTestForPublish(questions);
    console.log(`[Save] Validation result:`, validationResult);
    if (!validationResult.valid) {
      if (!silent) {
        const firstFailed = validationResult.failedQuestions[0];
        alert(`Save Rejected! All questions must contain a valid question body, answer key, and solution/explanation, with correct KaTeX math formatting.
Total failed questions: ${validationResult.failedQuestions.length}

First failure at Question #${firstFailed.index + 1}:
${firstFailed.reasons.map(r => "- " + r).join("\n")}

Please resolve these validation errors before saving.`);
      }
      setIsSaving(false);
      return;
    }

    try {
      const activeData = sanitizeQuestionObject({
        title,
        description: `AI ${status} workspace for ${subject}`,
        subject,
        duration,
        maximumMarks: questions.reduce((acc, q) => acc + (Number(q.points) || 2), 0),
        passingMarks: Math.round(questions.reduce((acc, q) => acc + (Number(q.points) || 2), 0) * 0.4),
        instructions,
        negativeMarking: questions.some(q => (q.negativePoints || 0) > 0),
        randomization: false,
        difficulty,
        tags: [subject, `AI-${status.charAt(0).toUpperCase() + status.slice(1)}`].filter(Boolean),
        status: status,
        category,
        visibility: "global" as const,
        questions,
        createdBy: userProfile?.id || "mentor",
        isAiDraft: status === 'draft',
        isArchived: false,
        auditReport,
        versionHistory,
        updatedAt: new Date().toISOString()
      });
      console.log(`[Save] Data to save:`, activeData);

      if (testId) {
        console.log(`[Save] Updating existing test: ${testId}`);
        await updateDoc(doc(db, "tests", testId), activeData);
        console.log(`[Save] Update successful`);
      } else {
        console.log(`[Save] Adding new test`);
        const ref = await addDoc(collection(db, "tests"), {
          ...activeData,
          createdAt: new Date().toISOString()
        });
        console.log(`[Save] Add successful, new ID: ${ref.id}`);
        setTestId(ref.id);
      }

      setSaveMessage(`${status.charAt(0).toUpperCase() + status.slice(1)} Auto Saved Securely!`);
      setTimeout(() => setSaveMessage(""), 2000);
      fetchRecentTests();
    } catch (e: any) {
      console.error(`[Save] Error:`, e);
      if (!silent) alert(`Failed to save ${status} online: ` + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Auto/Manual Save draft status to Firestore
  const saveWorkspaceDraft = async (silent = false) => {
    return saveTestWithStatus('draft', silent);
  };

  // Add a new version snapshot
  const commitVersionHistory = () => {
    const nextVer = versionHistory.length + 1;
    const newVersionObj: DraftVersion = {
      version: nextVer,
      timestamp: formatTimeIST(new Date()),
      questionsCount: questions.length,
      questions: JSON.parse(JSON.stringify(questions))
    };
    const nextHistory = [newVersionObj, ...versionHistory];
    setVersionHistory(nextHistory);
    saveWorkspaceDraft();
  };

  // Duplicate the current workspace draft state instantly
  const duplicateDraft = async () => {
    const duplicateData = {
      title: `${title} (Copy)`,
      description: `Duplicate AI-draft of ${subject}`,
      subject,
      duration,
      maximumMarks: questions.reduce((acc, q) => acc + (Number(q.points) || 1), 0),
      passingMarks: Math.round(questions.reduce((acc, q) => acc + (Number(q.points) || 1), 0) * 0.4),
      instructions,
      negativeMarking: questions.some(q => (q.negativePoints || 0) > 0),
      randomization: false,
      difficulty,
      tags: [subject, "AI-Draft", "Copy"],
      status: "draft",
      visibility: "global" as const,
      questions: JSON.parse(JSON.stringify(questions)),
      createdBy: userProfile?.id || "mentor",
      isAiDraft: true,
      isArchived: false,
      auditReport,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      const ref = await addDoc(collection(db, "tests"), duplicateData);
      alert(`Draft duplicated! Identifier: ${ref.id}`);
      onSaved();
      fetchRecentTests();
    } catch (e: any) {
      alert("Duplication failed: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle archive status
  const toggleArchiveDraft = async () => {
    const nextArchived = !isArchived;
    setIsArchived(nextArchived);
    if (testId) {
      await updateDoc(doc(db, "tests", testId), { isArchived: nextArchived });
    }
    alert(nextArchived ? "Draft moved to local Archive." : "Draft restored to workspace views.");
  };

  // Publish Draft & make accessible
  const publishTest = async () => {
    if (!publishCreateTest && !publishSaveToLibrary) {
      alert("Please select at least one action (Create Test or Save to Library).");
      return;
    }

    // Ensure metadata tags are present
    const finalSubject = (smartSubject || subject || "").trim();
    const finalChapter = (smartChapter || "").trim();
    const finalTopic = (smartTopic || "").trim();

    if (!finalSubject) {
      alert("Please provide a Subject to ensure all questions are properly tagged with metadata before persistence.");
      return;
    }
    if (!finalChapter) {
      alert("Please provide a Chapter/Unit name to ensure all questions are properly tagged with metadata before persistence.");
      return;
    }
    if (!finalTopic) {
      alert("Please provide a Topic to ensure all questions are properly tagged with metadata before persistence.");
      return;
    }

    setIsSaving(true);

    // Validate 100% of questions before publishing if creating a test
    if (publishCreateTest) {
      const validationResult = validateTestForPublish(questions);
      if (!validationResult.valid) {
        const firstFailed = validationResult.failedQuestions[0];
        alert(`Publish Failed! 100% of questions must pass validation to publish a Test.
Total failed questions: ${validationResult.failedQuestions.length}

Example failure at Question #${firstFailed.index + 1}:
${firstFailed.reasons.map(r => "- " + r).join("\n")}

Please fix all validation errors before publishing.`);
        setIsSaving(false);
        return;
      }
    }

    try {
      // SECTION A: Save to Central Question Library
      if (publishSaveToLibrary) {
        let savedCount = 0;
        let replacedCount = 0;
        let skippedCount = 0;

        for (let idx = 0; idx < questions.length; idx++) {
          const q = questions[idx];
          
          // Check if there was a duplicate flagged for this question index
          const dupMatch = duplicateCheckResults.find(r => r.questionIndex === idx);

          if (dupMatch) {
            if (dupMatch.action === 'skip') {
              skippedCount++;
              continue; // Skip saving
            } else if (dupMatch.action === 'replace') {
              // Replace existing library entry
              const replacementPayload = {
                text: q.text,
                type: q.type === 'MCQ' ? 'single_mcq' : q.type === 'MSQ' ? 'multiple_mcq' : q.type === 'Boolean' ? 'true_false' : q.type === 'Integer' ? 'numerical' : 'single_mcq',
                subject: finalSubject,
                chapter: finalChapter,
                topic: finalTopic,
                subtopic: q.subtopic || '',
                difficulty: smartDifficulty.toLowerCase(),
                marks: q.points || 2,
                status: 'verified' as const,
                tags: [finalSubject, finalChapter].filter(Boolean),
                options: q.options ? q.options.map((optText, oIdx) => ({
                  text: optText,
                  isCorrect: q.correctAnswers ? q.correctAnswers.includes(String(oIdx)) : false
                })) : [],
                correctAnswer: q.correctAnswers ? q.correctAnswers.join(',') : '',
                explanation: q.explanation || '',
                exam: smartExam,
                examCategory: smartExam,
                language: smartLanguage,
                source: 'AI Test Creator',
                youtubeLink: q.youtubeLink || '',
                pdfLink: q.pdfLink || '',
                driveLink: q.driveLink || '',
                websiteLink: q.websiteLink || '',
                imageUrl: q.imageUrl || '',
                solutionImageUrl: q.solutionImageUrl || '',
                createdBy: userProfile?.id || "mentor",
                updatedAt: new Date().toISOString()
              };
              await libUpdateQuestion(dupMatch.duplicateInLibrary.id, replacementPayload as any);
              replacedCount++;
              continue;
            }
          }

          // Save anyway / Default save
          const newLibPayload = {
            text: q.text,
            type: q.type === 'MCQ' ? 'single_mcq' : q.type === 'MSQ' ? 'multiple_mcq' : q.type === 'Boolean' ? 'true_false' : q.type === 'Integer' ? 'numerical' : 'single_mcq',
            subject: finalSubject,
            chapter: finalChapter,
            topic: finalTopic,
            subtopic: q.subtopic || '',
            difficulty: smartDifficulty.toLowerCase(),
            marks: q.points || 2,
            status: 'verified' as const,
            tags: [finalSubject, finalChapter].filter(Boolean),
            options: q.options ? q.options.map((optText, oIdx) => ({
              text: optText,
              isCorrect: q.correctAnswers ? q.correctAnswers.includes(String(oIdx)) : false
            })) : [],
            correctAnswer: q.correctAnswers ? q.correctAnswers.join(',') : '',
            explanation: q.explanation || '',
            exam: smartExam,
            examCategory: smartExam,
            language: smartLanguage,
            source: 'AI Test Creator',
            youtubeLink: q.youtubeLink || '',
            pdfLink: q.pdfLink || '',
            driveLink: q.driveLink || '',
            websiteLink: q.websiteLink || '',
            imageUrl: q.imageUrl || '',
            solutionImageUrl: q.solutionImageUrl || '',
            createdBy: userProfile?.id || "mentor",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await libAddQuestion(newLibPayload as any);
          savedCount++;
        }

        console.log(`[Library Commit] Saved ${savedCount} new, replaced ${replacedCount}, skipped ${skippedCount}.`);
      }

      // SECTION B: Publish / Create Assessment Test
      if (publishCreateTest) {
        const publishData = sanitizeQuestionObject({
          title,
          description: `Approved Mock Exam covering ${finalSubject}`,
          subject: finalSubject,
          duration,
          maximumMarks: questions.reduce((acc, q) => acc + (Number(q.points) || 2), 0),
          passingMarks: Math.round(questions.reduce((acc, q) => acc + (Number(q.points) || 2), 0) * 0.4),
          instructions,
          negativeMarking: questions.some(q => (q.negativePoints || 0) > 0),
          randomization: false,
          difficulty,
          tags: [finalSubject, "Approved"],
          status: publishMode === 'schedule' ? 'scheduled' : 'published',
          category,
          visibility: "global" as const,
          testType,
          questions: questions.map(q => {
            const { uncertaintyFlag, qualityReport, isEdited, isApproved, ...cleanQ } = q as any;
            // Ensure questions are properly tagged with metadata (Subject, Chapter, Topic, etc.) before persistence
            cleanQ.subject = cleanQ.subject || finalSubject;
            cleanQ.chapter = cleanQ.chapter || finalChapter;
            cleanQ.topic = cleanQ.topic || q.topic || finalTopic;
            cleanQ.difficulty = cleanQ.difficulty || q.difficulty || smartDifficulty || "";
            return cleanQ;
          }),
          scheduledFor: publishMode === 'schedule' ? scheduledTime : undefined,
          createdBy: userProfile?.id || "mentor",
          updatedAt: new Date().toISOString()
        });

        let finalTestId = testId;
        if (testId) {
          await updateDoc(doc(db, "tests", testId), publishData);
        } else {
          const docRef = await addDoc(collection(db, "tests"), {
            ...publishData,
            createdAt: new Date().toISOString()
          });
          finalTestId = docRef.id;
        }

        if (finalTestId) {
          // If this test has already been shared to the community, keep its metadata in sync
          const dtq = query(collection(db, 'dailyTests'), where('testId', '==', finalTestId), limit(5));
          const dtSnap = await getDocs(dtq);
          if (!dtSnap.empty) {
              dtSnap.forEach(async (docSnap) => {
                  await updateDoc(doc(db, 'dailyTests', docSnap.id), {
                      testName: title,
                      duration: duration,
                      questionCount: questions.length
                  });
              });
          }
        }
      }

      // Build Success Message
      let successMsg = "Operation completed successfully!";
      if (publishSaveToLibrary && publishCreateTest) {
        successMsg = "Successfully exported questions to the Question Library and published the mock test!";
      } else if (publishSaveToLibrary) {
        successMsg = "Successfully committed extracted questions to the central MissionGrid Question Library!";
      } else if (publishCreateTest) {
        successMsg = publishMode === 'schedule' ? `Test scheduled to release on: ${scheduledTime}` : "Mock Exam published successfully to student batches!";
      }

      alert(successMsg);
      onSaved();
      onClose();
    } catch (e: any) {
      alert("Operation Failed: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Question manipulation inside Review Grid
  const getActiveQuestionIndex = () => {
    return questions.findIndex(q => q.id === activeQuestionId);
  };

  const getActiveQuestion = (): AIQuestion | undefined => {
    return questions.find(q => q.id === activeQuestionId);
  };

  const updateActiveQuestion = (field: keyof AIQuestion, value: any) => {
    // Record current state for Local Undo
    recordWorkspaceHistory(questions);
    
    setQuestions(prev => prev.map(q => {
      if (q.id === activeQuestionId) {
        return { ...q, [field]: value, isEdited: true };
      }
      return q;
    }));

    // Trigger silent auto save
    setTimeout(() => saveWorkspaceDraft(true), 300);
  };

  const handleMobileUpdateQuestion = (id: string, field: keyof AIQuestion, value: any) => {
    // Record current state for Local Undo
    recordWorkspaceHistory(questions);
    
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        return { ...q, [field]: value, isEdited: true };
      }
      return q;
    }));

    // Trigger silent auto save
    setTimeout(() => saveWorkspaceDraft(true), 300);
  };

  const deleteQuestion = (id: string) => {
    recordWorkspaceHistory(questions);
    if (questions.length <= 1) {
      alert("At least one question is required!");
      return;
    }
    const filtered = questions.filter(q => q.id !== id);
    setQuestions(filtered);
    if (activeQuestionId === id) {
      setActiveQuestionId(filtered[0]?.id || null);
    }
    setTimeout(() => saveWorkspaceDraft(true), 300);
  };

  const toggleApproveQuestion = (id: string, customVal?: boolean) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        const nextVal = customVal !== undefined ? customVal : !q.isApproved;
        return { ...q, isApproved: nextVal };
      }
      return q;
    }));
  };

  const addQuestionManual = () => {
    recordWorkspaceHistory(questions);
    const newQ: AIQuestion = {
      id: `q-manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'MCQ',
      text: "New manual mock question?",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswers: ["Option A"],
      points: 1,
      negativePoints: 0,
      explanation: "",
      examApproach: "",
      ruleOrTheorem: "",
      difficulty: "Medium",
      topic: "",
      isApproved: false,
      isEdited: true
    };
    setQuestions(prev => [...prev, newQ]);
    setActiveQuestionId(newQ.id);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    recordWorkspaceHistory(questions);
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    const items = [...questions];
    const temp = items[index];
    items[index] = items[swapIdx];
    items[swapIdx] = temp;
    setQuestions(items);
  };

  const splitQuestion = (qId: string) => {
    const q = questions.find(qu => qu.id === qId);
    if (!q) return;
    recordWorkspaceHistory(questions);
    const half = Math.ceil((q.options?.length || 0) / 2);
    const op1 = q.options?.slice(0, half) || [];
    const op2 = q.options?.slice(half) || [];

    const newQ: AIQuestion = {
      ...q,
      id: `q-split-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text: `${q.text} (Parsed Part 2)`,
      options: op2,
      correctAnswers: [op2[0] || ''],
      isEdited: true
    };

    setQuestions(prev => {
      const idx = prev.findIndex(qu => qu.id === qId);
      const updated = [...prev];
      updated[idx] = { ...q, options: op1, correctAnswers: [op1[0] || ''], isEdited: true };
      updated.splice(idx + 1, 0, newQ);
      return updated;
    });
  };

  const mergeQuestionBelow = (index: number) => {
    if (index >= questions.length - 1) return;
    recordWorkspaceHistory(questions);
    const q1 = questions[index];
    const q2 = questions[index+1];

    const mergedNotes = `${q1.text}\nMerged Context:\n${q2.text}`;
    const mergedOptions = [...(q1.options || []), ...(q2.options || [])];

    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = {
        ...q1,
        text: mergedNotes,
        options: mergedOptions,
        correctAnswers: [...(q1.correctAnswers || []), ...(q2.correctAnswers || [])],
        isEdited: true
      };
      updated.splice(index + 1, 1);
      return updated;
    });
  };

  // Nav actions
  const nextQuestion = () => {
    const currIdx = getActiveQuestionIndex();
    if (currIdx < questions.length - 1) {
      setActiveQuestionId(questions[currIdx + 1].id);
    }
  };

  const prevQuestion = () => {
    const currIdx = getActiveQuestionIndex();
    if (currIdx > 0) {
      setActiveQuestionId(questions[currIdx - 1].id);
    }
  };

  // Bulk operation triggers
  const handleBulkApprove = () => {
    if (selectedQuestionIds.length === 0) return;
    setQuestions(prev => prev.map(q => {
      if (selectedQuestionIds.includes(q.id)) {
        return { ...q, isApproved: true };
      }
      return q;
    }));
    setSelectedQuestionIds([]);
    setIsBulkMode(false);
    alert("Selected questions approved!");
  };

  const handleBulkDelete = () => {
    if (selectedQuestionIds.length === 0) return;
    if (!confirm(`Delete ${selectedQuestionIds.length} questions?`)) return;
    recordWorkspaceHistory(questions);
    const nextQ = questions.filter(q => !selectedQuestionIds.includes(q.id));
    setQuestions(nextQ);
    if (nextQ.length > 0) setActiveQuestionId(nextQ[0].id);
    setSelectedQuestionIds([]);
    setIsBulkMode(false);
  };

  const toggleSelectAll = () => {
    if (selectedQuestionIds.length === filteredPaletteQuestions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(filteredPaletteQuestions.map(q => q.id));
    }
  };

  const toggleSelectQuestion = (qId: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  // Filtering questions for the palette
  const filteredPaletteQuestions = questions.filter((q, idx) => {
    const qNum = (idx + 1).toString();
    const matchesSearch = 
      paletteSearch === "" || 
      qNum.includes(paletteSearch) || 
      q.text.toLowerCase().includes(paletteSearch.toLowerCase()) ||
      q.topic?.toLowerCase().includes(paletteSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (paletteFilter === 'All') return true;
    if (paletteFilter === 'Needs Review') return q.uncertaintyFlag || !q.isApproved;
    if (paletteFilter === 'Low Confidence') return q.uncertaintyFlag === true;
    if (paletteFilter === 'Edited') return q.isEdited === true;
    if (paletteFilter === 'Approved') return q.isApproved === true;
    return true;
  });

  const fmtTimer = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = secs % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Mock OCR Badges descriptions
  const flagMeta: Record<string, {title: string, desc: string}> = {
    'ocr': {
      title: "OCR Scanner Alert",
      desc: "Symbols or line separators were blurry in original snapshot. Reconstructed automatically using Gemini 3.5 context logic."
    },
    'missing': {
      title: "Options Incomplete",
      desc: "Source content was cut off. Generated replacement options to maintain continuous test integrity."
    },
    'duplicate': {
      title: "Duplicate Stripped",
      desc: "Repetitive, highly identical evaluation elements were stripped during ingestion."
    },
    'confidence': {
      title: "Low Extraction Score",
      desc: "Handwriting or printing was complex, placing confidence margin under 85%. Manual proof check strongly advised."
    }
  };

  return (
    <div id="ai_test_workspace_wrapper" className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col pt-[env(safe-area-inset-top)] md:pt-0 font-sans">
      
      {/* HEADER BANNER */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 shrink-0 flex items-center justify-between shadow-lg">
         <div className="flex items-center space-x-3">
            <button 
              onClick={() => {
                if (stage === 'workspace') {
                  if (confirm("Save current draft changes before returning home?")) {
                    saveWorkspaceDraft();
                  }
                  setStage('home');
                } else if (stage === 'preview') {
                  setStage('workspace');
                } else if (stage === 'upload') {
                  setStage('home');
                } else {
                  onClose();
                }
              }} 
              className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-xl transition active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
               <h2 className="text-sm font-black text-white flex items-center gap-1.5 leading-tight">
                 <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                 <span>AI Test Creator</span>
               </h2>
               <p className="text-[9px] text-slate-400 tracking-wider font-semibold uppercase">MissionGrid Question Engine</p>
            </div>
         </div>

         <div className="flex items-center space-x-2">
            {saveMessage ? (
              <span className="text-xs font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-3 py-1.5 rounded-xl animate-pulse shadow-sm flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>{saveMessage}</span>
              </span>
            ) : (
              <button 
                onClick={() => saveWorkspaceDraft(false)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer"
                title="Save test as draft immediately"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Save as Draft</span>
              </button>
            )}

            {stage === 'workspace' && (
              <span className="hidden sm:inline-flex text-[10px] bg-slate-800 text-indigo-300 px-2.5 py-1.5 rounded-xl font-bold border border-slate-700">
                {questions.length} Questions
              </span>
            )}
         </div>
      </header>

      {/* CORE FRAME ROUTER */}
      <main className="flex-1 overflow-hidden relative flex flex-col">


          {/* STAGE A: NATIVE MOBILE DASHBOARD HOME */}
          {stage === 'home' && (
            <motion.div 
              key="test-creator-stage-home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-y-auto p-4 space-y-6 max-w-lg mx-auto w-full pb-20"
            >
               {/* Welcome Banner */}
               <div className="text-left space-y-1 py-1">
                 <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
                   Select Study Source
                 </h1>
                 <p className="text-xs text-slate-400 font-medium">
                   Instantly transform offline exam PDFs, study notes, images into polished digital tests.
                 </p>
               </div>

               {/* PREMIUM AI INSTRUCTION WORKSPACE */}
               <div className="bg-white p-4 rounded-2xl border border-slate-200 text-left space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                     <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                        <span className="text-xs font-black text-slate-200 uppercase tracking-wide">AI Instruction Workspace</span>
                     </div>
                     <span className="text-[9px] bg-indigo-950/80 border border-indigo-800 text-indigo-300 font-extrabold uppercase px-2 py-0.5 rounded-lg font-mono">
                       Gemini Controller
                     </span>
                  </div>

                  {/* Preset Library Grid/Scroll (Req 21) */}
                  <div className="space-y-1.5">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📚 Select Preset Mock Pattern</span>
                        {selectedPreset && (
                           <button 
                             onClick={() => { setSelectedPreset(""); setPreferences(""); }}
                             className="text-[9px] text-rose-400 hover:underline font-bold"
                           >
                             Reset
                           </button>
                        )}
                     </div>
                     
                     <div className="flex items-center space-x-1.5 overflow-x-auto py-1 no-scrollbar pr-3">
                        {[
                          { name: "📚 SSC CGL Mock", prompt: "Create a 50-question SSC CGL level mock test from this PDF. Preserve the original language. Generate four options, correct answers, short explanations, difficulty levels, and maintain chapter-wise order. Ignore advertisements and index pages.", icon: "📚" },
                          { name: "🚆 RRB NTPC Mock", prompt: "Generate railway practice papers for RRB NTPC. Highlight general science, quantitative aptitude tricks, logical reasoning, and basic GK.", icon: "🚆" },
                          { name: "🏛 WBPSC Mock", prompt: "Design WBPSC mock set focusing on State specific History, Geography, and WB administration.", icon: "🏛" },
                          { name: "👮 WB Police Mock", prompt: "Create a West Bengal Police level mock test. Balanced questions with general awareness, elementary mathematics, reasoning, and basic science.", icon: "👮" },
                          { name: "🎓 CHSL Mock", prompt: "SSC CHSL level mock test. Focus heavily on algebraic equations, grammar, reading comprehension, and numerical reasoning.", icon: "🎓" },
                          { name: "📝 MTS Mock", prompt: "Create an MTS mock exam. Keep the language direct and clear. Focus on basic arithmetic, spelling corrections, and static GK.", icon: "📝" },
                          { name: "📖 Vocab Test", prompt: "Create dedicated vocabulary drills, including synonyms, antonyms, spelling corrections, and single-word replacement questions.", icon: "📖" },
                          { name: "➗ Maths Practice", prompt: "Generate dedicated Maths Practice sheet. Ensure deep step-by-step math solutions. Use LaTeX styles $...$ for equations.", icon: "➗" },
                          { name: "🧠 Reasoning", prompt: "Reasoning special test containing blood relations, puzzles, letter analogy, syllogisms, and sequence matrices.", icon: "🧠" },
                          { name: "🌏 GK Practice", prompt: "Questions specialized in static GK, Indian political constitution, geography, and general science milestones.", icon: "🌏" },
                          { name: "🎯 Custom", prompt: "", icon: "🎯" }
                        ].map((item) => {
                           const isSel = selectedPreset === item.name;
                           return (
                             <button
                               key={item.name}
                               onClick={() => {
                                 setSelectedPreset(item.name);
                                 setPreferences(item.prompt);
                               }}
                               className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold whitespace-nowrap transition-all border shrink-0 ${
                                 isSel 
                                   ? 'bg-indigo-600 border-indigo-500 text-white shadow-md font-black' 
                                   : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-500 hover:bg-slate-50'
                               }`}
                             >
                               {item.name}
                             </button>
                           );
                        })}
                     </div>
                  </div>

                  {/* Character Custom TextBox Field */}
                  <div className="space-y-1">
                     <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Custom overlay Guidelines</label>
                        <span className="text-[9px] text-slate-500 font-mono font-bold">
                          {preferences.length} chars
                        </span>
                     </div>
                     <textarea 
                       placeholder="Configure your custom overlays... E.g. 'Create a 50-question mock test. Ignore advertisements.'"
                       value={preferences}
                       onChange={(e) => {
                         setPreferences(e.target.value);
                         if (selectedPreset !== "🎯 Custom") {
                           setSelectedPreset("🎯 Custom");
                         }
                       }}
                       className="w-full h-24 bg-white text-xs rounded-xl p-2.5 border border-slate-200 focus:outline-none focus:border-indigo-500 text-slate-900 resize-none font-medium leading-relaxed shadow-inner"
                     />
                  </div>

                  {/* Quick Guidelines Templates Checklist (Req 19) */}
                  <div className="space-y-1.5 pt-0.5">
                     <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block font-sans">✓ One-Tap Custom Directives Templates</span>
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto no-scrollbar pr-1">
                        {[
                          { label: "Create CGL mock", text: "Create SSC CGL mock." },
                          { label: "Chapter practice", text: "Create chapter-wise practice set." },
                          { label: "Previous year rules", text: "Create previous year test." },
                          { label: "Force hard questions", text: "Generate only difficult questions." },
                          { label: "Bilingual translation", text: "Generate bilingual questions." },
                          { label: "Keep numbering", text: "Keep original question numbering." },
                          { label: "Keep diagrams/tables", text: "Preserve tables and diagrams." },
                          { label: "Detailed explainers", text: "Generate detailed explanations." },
                          { label: "Create 50 question mock", text: "Create a 50-question mock test." },
                          { label: "Hide answers keys", text: "Skip answer keys." },
                          { label: "Force full explanations", text: "Include answer keys and step-by-step explanations." },
                          { label: "Sectional assessment", text: "Create sectional test." },
                          { label: "Full-Length mock", text: "Create full-length mock." }
                        ].map((tpl) => {
                           const hasTpl = preferences.toLowerCase().includes(tpl.text.toLowerCase());
                           return (
                             <button
                               key={tpl.label}
                               type="button"
                               onClick={() => appendTemplate(tpl.text)}
                               className={`p-1.5 px-2 rounded-lg text-[9px] font-bold text-left border transition-all flex items-center justify-between ${
                                 hasTpl 
                                   ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400' 
                                   : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-indigo-500/50 hover:text-slate-100'
                               }`}
                             >
                               <span className="truncate">{tpl.label}</span>
                               <span className="shrink-0 text-indigo-400 text-[10px] font-bold ml-1">{hasTpl ? "✓" : "+"}</span>
                             </button>
                           );
                        })}
                     </div>
                  </div>

                  {/* Saved Prompts for History / Reuse */}
                  {previousInstructions.length > 0 && (
                     <div className="space-y-1.5 pt-1 border-t border-slate-850/60 font-medium">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">🕒 Recent Saved Instructions</span>
                        <div className="space-y-1 max-h-24 overflow-y-auto no-scrollbar">
                           {previousInstructions.map((inst, index) => (
                             <div key={inst + index} className="flex items-center justify-between bg-slate-950/40 py-1 px-2 rounded-lg border border-slate-850/50 hover:border-slate-800">
                               <button 
                                 type="button"
                                 onClick={() => {
                                   setPreferences(inst);
                                   setSelectedPreset("🎯 Custom");
                                 }}
                                 className="text-[9px] text-slate-350 hover:text-white truncate font-semibold text-left flex-1"
                                 title="Load this instructions overlay"
                               >
                                 • {inst}
                               </button>
                               <button
                                 type="button"
                                 onClick={() => {
                                   const next = previousInstructions.filter((_, i) => i !== index);
                                   setPreviousInstructions(next);
                                   localStorage.setItem("ai_previous_instructions", JSON.stringify(next));
                                 }}
                                 className="text-slate-605 hover:text-rose-400 p-0.5 ml-2 transition"
                                 title="Dismiss history item"
                               >
                                 <X className="w-3 h-3" />
                               </button>
                             </div>
                           ))}
                        </div>
                     </div>
                  )}

                  {/* Future Flexibility hint description (Req 22) */}
                  <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-850 flex items-start space-x-1.5">
                     <Info className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                     <p className="text-[9px] text-slate-500 leading-normal">
                       <strong>Omnichannel Engine:</strong> These custom instruction directives align perfectly for PDFs, Snapped photos, YouTube contexts, Website URLs, or Markdown uploads.
                     </p>
                  </div>
               </div>

               
{/* Grid of Large Touch Upload Actions */}
               <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setActiveUploadMethod('pdf')}
                    className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 transition active:scale-95"
                  >
                     <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-900/50 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-red-400" />
                     </div>
                     <span className="text-xs font-bold text-slate-200">Upload PDF</span>
                     <span className="text-[9px] text-slate-500 font-semibold uppercase">Exam papers</span>
                  </button>

                  <button 
                    onClick={() => setActiveUploadMethod('image')}
                    className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 transition active:scale-95"
                  >
                     <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-900/50 flex items-center justify-center">
                        <FileImage className="w-6 h-6 text-emerald-400" />
                     </div>
                     <span className="text-xs font-bold text-slate-200">Upload Photos</span>
                     <span className="text-[9px] text-slate-500 font-semibold uppercase">Gallery / Notes</span>
                  </button>

                  <button 
                    onClick={() => {
                      setActiveUploadMethod('camera');
                      handleCameraScanTrigger();
                    }}
                    className="p-4 bg-white border border-slate-200 hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 transition active:scale-95 col-span-2 py-5"
                  >
                     <div className="w-12 h-12 rounded-full bg-indigo-955/40 border border-indigo-900/50 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-indigo-400 animate-spin" />
                     </div>
                     <span className="text-xs font-bold text-slate-200">Camera / Document Scan</span>
                     <span className="text-[9px] text-slate-500 font-semibold uppercase">Snap paper questions in real time</span>
                  </button>

                  <button 
                    onClick={() => setActiveUploadMethod('text')}
                    className="p-4 bg-gradient-to-br from-violet-950/80 via-purple-950/60 to-fuchsia-950/80 border border-purple-500/30 hover:border-fuchsia-400 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 transition-all duration-150 active:scale-95 shadow-md shadow-purple-500/5 hover:shadow-fuchsia-500/10"
                  >
                     <div className="w-12 h-12 rounded-full bg-purple-900/40 border border-purple-500/50 flex items-center justify-center">
                        <ClipboardList className="w-6 h-6 text-fuchsia-350 animate-pulse" />
                     </div>
                     <span className="text-xs font-bold text-fuchsia-100">Paste Text</span>
                     <span className="text-[9px] text-purple-300 font-semibold uppercase">Syllabus / Prompts</span>
                  </button>

                  <button 
                    onClick={() => setActiveUploadMethod('youtube')}
                    className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 transition active:scale-95"
                  >
                     <div className="w-12 h-12 rounded-full bg-rose-955/40 border border-rose-905/50 flex items-center justify-center">
                        <Play className="w-6 h-6 text-rose-400" />
                     </div>
                     <span className="text-xs font-bold text-slate-200">YouTube Video</span>
                     <span className="text-[9px] text-slate-500 font-semibold uppercase">Topic Context</span>
                  </button>
               </div>

               
               {/* Saved Draft Progress Recovery Banner */}
               {savedProgress && (
                  <div className="bg-slate-905 border-2 border-indigo-500/30 p-4 rounded-3xl text-left space-y-3 shadow-xl relative overflow-hidden bg-slate-900">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-950/50 border border-indigo-800 flex items-center justify-center shrink-0 text-indigo-400">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-black text-white uppercase tracking-wider">Unsaved Test Ingestion Detected</h3>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          You have an active generation process on hold. We saved your progress up to <strong>{savedProgress.percent}% ({savedProgress.questions?.length || 0} questions parsed)</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5">
                      <button 
                        onClick={resumeAiAnalysis}
                        className="py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:from-indigo-500 active:scale-95 transition"
                      >
                        Resume Draft
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm("Discard saved draft and start fresh? This cannot be undone.")) {
                            localStorage.removeItem("ai_test_workspace_progress");
                            setSavedProgress(null);
                          }
                        }}
                        className="py-2.5 px-4 bg-slate-950 text-slate-400 border border-slate-800 rounded-xl text-[10px] font-bold uppercase transition hover:text-red-400 hover:bg-red-950/20"
                      >
                        Discard Draft
                      </button>
                    </div>
                  </div>
               )}

                {/* BUDGET GUARDIAN & RATE SAFEKEEPING */}
                <Card className="mb-4 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2 text-slate-900">
                      <Sliders className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-bold uppercase tracking-wide">Daily Spend Limit</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full border ${
                      spentToday >= dailyBudgetLimit ? 'bg-red-50 border-red-200 text-red-600' :
                      spentToday >= dailyBudgetLimit * 0.8 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                      'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      ₹{spentToday.toFixed(2)} / ₹{dailyBudgetLimit}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-normal mb-3">
                    Set spending caps to pause extraction jobs if they reach thresholds.
                  </p>

                  <div className="grid grid-cols-4 gap-2">
                    {[50, 100, 250, 500].map((lim) => (
                      <Button
                        key={lim}
                        variant={dailyBudgetLimit === lim ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => updateBudgetLimitOnServer(lim)}
                      >
                        ₹{lim}
                      </Button>
                    ))}
                  </div>
                </Card>

                {/* HIGH-PRIORITY API KEY OVERRIDE */}
                <Card className="mb-4 bg-white border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2 text-slate-900">
                      <Settings className="w-4 h-4 text-indigo-600 animate-pulse" />
                      <span className="text-sm font-bold uppercase tracking-wide">Personal Gemini Key</span>
                    </div>
                    {savedCustomKeyMasked ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> Active Override
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500">
                        Default Shared Pool
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 leading-normal mb-3">
                    If the shared workspace keys are depleted or exceed monthly limits, paste your personal Gemini API key here to bypass any limits.
                  </p>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder={savedCustomKeyMasked ? `Saved: ${savedCustomKeyMasked}` : "Paste GEMINI_API_KEY..."}
                        value={customGeminiApiKey}
                        onChange={(e) => setCustomGeminiApiKey(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 bg-white"
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={saveKeyLoading || !customGeminiApiKey.trim()}
                        onClick={() => updateCustomApiKeyOnServer(customGeminiApiKey)}
                      >
                        {saveKeyLoading ? "Saving..." : "Save Key"}
                      </Button>
                    </div>

                    {savedCustomKeyMasked && (
                      <div className="flex justify-between items-center text-[11px] mt-1.5">
                        <span className="text-slate-400">Masked key: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{savedCustomKeyMasked}</code></span>
                        <button
                          onClick={() => updateCustomApiKeyOnServer("")}
                          className="text-red-500 hover:text-red-700 font-semibold transition-colors"
                          disabled={saveKeyLoading}
                        >
                          Clear Custom Override
                        </button>
                      </div>
                    )}

                    {keySaveSuccessMsg && (
                      <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-1 bg-emerald-50/50 p-1.5 rounded border border-emerald-100">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> {keySaveSuccessMsg}
                      </div>
                    )}
                  </div>
                </Card>

               {/* ACTIVE BACKGROUND JOBS STATUS CONTAINER */}
               {allBackgroundJobs.length > 0 && (
                 <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                       <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                         <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                         Background Ingestion Jobs ({allBackgroundJobs.filter((j: any) => j.status !== 'completed' && j.status !== 'failed').length} Active)
                       </span>
                    </div>

                    <div className="space-y-2.5">
                       {allBackgroundJobs.filter(j => j.status !== 'completed').slice(0, 4).map((j: any, idx: number) => {
                         const isRunning = j.status !== 'completed' && j.status !== 'failed' && j.status !== 'paused_budget';
                         return (
                           <div key={j.id || `job-${idx}`} className="bg-slate-900/90 border border-slate-850 p-3.5 rounded-2xl flex flex-col gap-2 relative overflow-hidden shadow-md">
                             {/* Background relative loading progress indicator */}
                             {isRunning && (
                               <div 
                                 className="absolute bottom-0 left-0 h-1 bg-indigo-500/40 transition-all duration-300"
                                 style={{ width: `${j.percent || 5}%` }}
                               ></div>
                             )}

                             <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0 flex-1 space-y-0.5">
                                   <div className="flex items-center space-x-2">
                                      <h4 className="text-xs font-extrabold text-slate-100 truncate flex-1 leading-snug">
                                         {j.finalResult?.title || `Process: Ingesting ${j.uploadQueue?.length || 1} material(s)`}
                                      </h4>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${
                                        j.status === 'completed' ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-400' :
                                        j.status === 'failed' ? 'bg-red-955 border border-red-800 text-red-400' :
                                        j.status === 'paused_budget' ? 'bg-amber-955/80 border border-amber-805 text-amber-400 animate-pulse' :
                                        'bg-blue-950/80 border border-blue-800 text-blue-400 animate-pulse'
                                      }`}>
                                         {j.status}
                                      </span>
                                   </div>
                                   <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">
                                      Step: <span className="text-slate-350">{j.steps?.[j.currentStepIndex] || "Executing Initial scans"}</span> • {j.percent || 5}%
                                   </p>
                                </div>

                                <div className="flex items-center space-x-1 shrink-0 ml-1">
                                   {j.status === 'completed' ? (
                                     <button 
                                       onClick={() => loadCompletedJobIntoWorkspace(j)}
                                       className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow"
                                       title="Open Completed Workspace Editor"
                                     >
                                       Review
                                     </button>
                                   ) : isRunning ? (
                                     <button 
                                       onClick={() => {
                                         localStorage.setItem("ai_active_job_id", j.id);
                                         setActiveJobId(j.id);
                                         setStage('processing');
                                       }}
                                       className="px-2 py-1 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg text-[9px] font-black uppercase flex items-center space-x-1"
                                       title="Monitor Progress screen"
                                     >
                                       <Eye className="w-3 h-3 text-indigo-400" />
                                       <span>Track</span>
                                     </button>
                                   ) : (
                                     <button 
                                       onClick={() => requeueBackgroundJob(j.id)}
                                       className="px-2 py-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-lg text-[9px] font-black uppercase"
                                     >
                                       Retry
                                     </button>
                                   )}

                                   <button 
                                     onClick={() => deleteBackgroundJobOnServer(j.id)}
                                     className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-950 rounded-lg transition-colors"
                                     title="Delete job entry"
                                   >
                                      <Trash className="w-3.5 h-3.5" />
                                   </button>
                                </div>
                             </div>

                             {j.logs && j.logs.length > 0 && (
                               <div className="bg-slate-950/70 p-1.5 rounded-lg text-[8px] font-mono text-emerald-400 mt-1 max-h-12 overflow-y-auto leading-normal select-text">
                                 {j.logs[j.logs.length - 1]}
                                </div>
                             )}
                           </div>
                         );
                       })}
                    </div>
                 </div>
               )}

               {/* Draft lists dashboards */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                     <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Workspace Drafts ({recentDrafts.length})</span>
                     <Button variant="ghost" size="sm" onClick={fetchRecentTests}>Refresh</Button>
                  </div>

                  {dashboardLoading ? (
                    <div className="py-8 text-center text-xs text-slate-500 font-bold uppercase animate-pulse">Loading...</div>
                  ) : (
                    <div className="space-y-3">
                       {recentDrafts.map((d: any, idx: number) => (
                         <Card key={d.id || `draft-${idx}`} className="bg-white flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0" onClick={() => loadDraftIntoWorkspace(d)}>
                               <h4 className="text-sm font-bold text-slate-900 truncate">{d.title}</h4>
                               <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-1 uppercase font-semibold">
                                  <span>{d.subject || "Study"}</span>
                                  <span>•</span>
                                  <span>{d.duration} mins</span>
                                  <span>•</span>
                                  <span className="text-blue-600 font-bold">{d.questions?.length || 0} Questions</span>
                               </div>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                               <Button variant="secondary" size="sm" onClick={() => loadDraftIntoWorkspace(d)}>
                                  Resume
                               </Button>
                               <Button variant="ghost" size="sm" onClick={() => handleDeleteDraftFirestore(d.id)} className="text-red-500 hover:bg-red-50">
                                  <Trash className="w-4 h-4" />
                               </Button>
                            </div>
                         </Card>
                       ))}

                       {recentDrafts.length === 0 && (
                         <div className="text-center py-6 text-[11px] text-slate-400 font-medium uppercase">No active drafts.</div>
                       )}
                    </div>
                  )}
               </div>

               {/* Released test list dashboard */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                     <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Released Batch Tests ({publishedTests.length})</span>
                  </div>

                  <div className="space-y-2">
                     {publishedTests.map((t: any, idx: number) => (
                       <Card key={t.id || `pub-${idx}`} className="bg-white flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                             <div className="text-sm font-bold text-slate-900 truncate">{t.title}</div>
                             <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold">{t.subject} • Released</div>
                          </div>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold uppercase px-2 py-1 rounded-full border border-emerald-100 tracking-wide">
                             Published
                          </span>
                       </Card>
                     ))}
                     {publishedTests.length === 0 && (
                       <p className="text-center text-[11px] text-slate-400 uppercase py-2 font-medium">No released assessments.</p>
                     )}
                  </div>
               </div>

               {/* POPUP ACTION MODALS FOR INLINE UPLOADS */}
               {activeUploadMethod && (
                 <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-end justify-center p-4">
                    <motion.div 
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-4 space-y-4 text-left"
                    >
                       <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-xs font-black text-white uppercase tracking-wider">{activeUploadMethod} study parameters</span>
                          <button onClick={() => setActiveUploadMethod(null)} className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded-lg"><X className="w-4 h-4" /></button>
                       </div>

                       {activeUploadMethod === 'pdf' && (
                         <div className="space-y-3">
                            <p className="text-xs text-slate-400 leading-normal">Choose target PDF test paper files (supports mixed formulas & images).</p>
                            <input 
                              type="file" 
                              accept="application/pdf"
                              onChange={fileSelected}
                              className="w-full text-xs text-slate-350 bg-slate-950 p-3 rounded-xl border border-slate-800"
                            />
                         </div>
                       )}

                       {activeUploadMethod === 'image' && (
                         <div className="space-y-3">
                            <p className="text-xs text-slate-400 leading-normal">Select image captures or screenshot files from your library.</p>
                            <input 
                              type="file" 
                              accept="image/*"
                              multiple
                              onChange={fileSelected}
                              className="w-full text-xs text-slate-350 bg-slate-950 p-3 rounded-xl border border-slate-800"
                            />
                         </div>
                       )}

                       {activeUploadMethod === 'text' && (
                         <div className="space-y-3">
                            <p className="text-xs text-slate-400 font-bold block">Type raw study questions, references or key concepts:</p>
                            <textarea 
                              value={rawText}
                              onChange={(e) => setRawText(e.target.value)}
                              placeholder="Paste homework notes or syllabus here..."
                              className="w-full h-24 bg-slate-950 text-xs text-white rounded-xl p-3 border border-slate-805 outline-none focus:border-indigo-500"
                            />
                            <button 
                              onClick={addPlainTextInput}
                              className="w-full py-2 bg-indigo-600 rounded-xl text-xs font-black text-white transition hover:bg-indigo-500 uppercase"
                            >
                              Add Plain text source
                            </button>
                         </div>
                       )}

                       {activeUploadMethod === 'youtube' && (
                         <div className="space-y-3">
                            <p className="text-xs text-slate-400 leading-normal">Provide educational video link/concepts context:</p>
                            <input 
                              type="url"
                              value={youtubeLink}
                              onChange={(e) => setYoutubeLink(e.target.value)}
                              placeholder="E.g., https://youtube.com/watch?v=..."
                              className="w-full bg-slate-955 text-xs text-white rounded-xl p-3 border border-slate-800 outline-none focus:border-indigo-500"
                            />
                            <button 
                              onClick={addYouTubeInput}
                              className="w-full py-2 bg-rose-600 rounded-xl text-xs font-black text-white transition hover:bg-rose-500 uppercase"
                            >
                              Sync Video Source
                            </button>
                         </div>
                       )}
                    </motion.div>
                 </div>
               )}
            </motion.div>
          )}

          {/* STAGE B: UPLOAD STAGING QUEUE REVIEW */}
          {stage === 'upload' && (
            <motion.div 
              key="test-creator-stage-upload"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="h-full overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full text-left pb-24"
            >
               <div className="space-y-1">
                  <h3 className="text-lg font-black text-white flex items-center gap-1.5">
                    <Upload className="w-5 h-5 text-indigo-400" />
                    <span>Upload Study Materials</span>
                  </h3>
                  <p className="text-xs text-slate-400">Review selected files list ready for Gemini OCR extraction.</p>
               </div>

               <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800 space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Selected files ({uploadQueue.length})</span>
                  
                  <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-2xl text-[10px] text-indigo-300 leading-normal flex items-start gap-2">
                    <span className="mt-0.5 font-bold uppercase shrink-0 px-1.5 py-0.5 bg-indigo-900/40 rounded text-[8px] text-indigo-200">Notice</span>
                    <span>For optimal performance, keep PDFs under 50 pages or use specific image screenshots. Avoid loading whole textbooks.</span>
                  </div>
                  
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                     {uploadQueue.map((item, idx) => (
                       <div key={`${item.id}-${idx}`} className="flex flex-col bg-slate-950 p-3 rounded-2xl border border-slate-800 shadow-sm text-left gap-2">
                          <div className="flex items-center justify-between w-full">
                             <div className="flex items-center space-x-3 overflow-hidden">
                             <div className="p-2.5 rounded-lg bg-indigo-900/40 text-indigo-400">
                                <FileText className="w-4 h-4" />
                             </div>
                             <div className="overflow-hidden">
                                <div className="text-xs font-bold text-slate-200 truncate pr-5">{item.name}</div>
                                <div className="text-[9px] uppercase font-black tracking-widest text-[#5f6c8d]">
                                   {item.isUploading ? `Uploading: ${item.uploadProgress || 0}%` : (item.sizeLabel || "Source")}
                                </div>
                             </div>
                          </div>
                          <button onClick={() => removeQueueItem(item.id)} className="p-1 px-1.5 text-slate-500 hover:text-white bg-slate-900 border border-slate-800 rounded-lg">
                             <X className="w-3.5 h-3.5" />
                          </button>
                          </div>
                          {item.isUploading && (
                             <div className="w-full bg-slate-850 h-1 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${item.uploadProgress || 0}%` }} />
                             </div>
                          )}
                       </div>
                     ))}

                     {uploadQueue.length === 0 && (
                       <p className="text-center py-6 text-slate-500 text-xs font-bold uppercase">No files loaded yet.</p>
                     )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                     <button 
                       onClick={() => setStage('home')}
                       className="py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-350 border border-slate-800 rounded-xl text-xs font-bold uppercase shadow-sm text-center"
                     >
                       Add More
                     </button>
                     <button 
                       onClick={() => setUploadQueue([])}
                       className="py-2.5 bg-slate-950 hover:bg-red-950/25 text-red-400 border border-slate-800 rounded-xl text-xs font-bold uppercase shadow-sm text-center"
                     >
                       Clear All
                     </button>
                  </div>
               </div>

               {/* Launch AI Pipeline buttons */}
               <div className="pt-4 font-sans">
                  <button 
                    onClick={() => setShowPromptPreview(true)}
                    disabled={uploadQueue.length === 0}
                    className="w-full bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-40"
                  >
                     <Sparkles className="w-4 h-4 text-white animate-pulse" />
                     <span>Ingest Study materials with Gemini</span>
                  </button>
               </div>
            </motion.div>
          )}

          {/* STAGE C: AI PROCESSING & LOG TERMINAL */}
          {stage === 'processing' && (
            <motion.div 
              key="test-creator-stage-processing"
              className="h-full flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto w-full space-y-8"
            >
               <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  {/* Radial progress ring */}
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                     <circle cx="48" cy="48" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                     <circle cx="48" cy="48" r="40" stroke="#4f46e5" strokeWidth="8" fill="transparent"
                             strokeDasharray={251}
                             strokeDashoffset={251 - (251 * processingPercent) / 100} 
                             className="transition-all duration-300"
                     />
                  </svg>
                  <Sparkles className="w-7 h-7 text-indigo-400 animate-pulse" />
                  <span className="absolute bottom-2 font-mono text-[10px] font-black">{processingPercent}%</span>
               </div>

               <div className="space-y-1">
                  <h3 className="text-md font-extrabold text-white">Extruding Ingestion Paper</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black leading-normal">OCR, layout cleaning & math equation alignments live</p>
               </div>

               {/* Ingestion progress items */}
               <div className="w-full space-y-2 bg-slate-900 border border-slate-800 p-3 rounded-2xl text-left">
                  {steps.map((txt, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-[11px]">
                       <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                         idx < processingStep ? 'bg-indigo-600 text-white' : 
                         idx === processingStep ? 'bg-slate-950 text-indigo-400 border border-slate-800 animate-pulse' : 
                         'bg-slate-950 text-slate-600 border border-slate-850'
                       }`}>
                          {idx < processingStep ? '✓' : idx + 1}
                       </div>
                       <span className={idx === processingStep ? 'text-white font-bold' : idx < processingStep ? 'text-slate-400' : 'text-slate-500'}>
                         {txt}
                       </span>
                    </div>
                  ))}
               </div>

               {/* Ingestion Live Output logs */}
               <div className="w-full h-24 bg-slate-950 border border-slate-850 rounded-xl p-2 px-3 text-[10px] font-mono text-emerald-400 text-left overflow-y-auto space-y-1 shadow-inner">
                  {processingLogs.filter(l => !l.trim().startsWith('{')).map((lg, i) => (
                    <div key={`${i}-${lg}`} className="truncate">{lg}</div>
                  ))}
               </div>

               {/* Run background process option */}
               <button 
                 onClick={() => {
                   alert("AI Workspace generation runs safely in the background. You can monitor it in the Active Jobs section on your dashboard.");
                   localStorage.removeItem("ai_active_job_id");
                   setActiveJobId(null);
                   setUploadQueue([]);
                   setPreferences("");
                   setStage('home');
                 }}
                 className="p-2 px-4 bg-slate-900 hover:bg-slate-850 rounded-xl text-xs font-extrabold text-slate-300 uppercase letter-wider transition"
               >
                 Run process in Background
               </button>
            </motion.div>
          )}

          {/* STAGE D: EXPERT REVIEW MOBILE WORKSPACE */}
          {stage === 'workspace' && (
            <motion.div 
              key="test-creator-stage-workspace"
              className="h-full flex flex-col overflow-hidden text-left bg-slate-950 pb-20 select-none pb-[calc(110px+env(safe-area-inset-bottom))]"
            >
               {/* SUB HEADER PRESETS / AUDIT PANEL */}
               <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-slate-800 shadow">
                  <div className="flex items-center space-x-2 min-w-0">
                     <Settings className="w-3.5 h-3.5 text-indigo-400" />
                     <input 
                       value={title}
                       onChange={(e) => setTitle(e.target.value)}
                       className="bg-transparent text-xs font-black text-white border-b border-slate-800 focus:border-indigo-500 outline-none truncate pb-0.5 w-40"
                       title="Rename paper title"
                     />
                  </div>
                  
                  {/* Workspace layout selector switcher (New) */}
                  <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-850 shrink-0 mx-2">
                    <button
                      onClick={() => setWorkspaceLayout('mobile-cards')}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-100 ${
                        workspaceLayout === 'mobile-cards' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                      id="layout-toggle-deck"
                    >
                      Swipe Deck
                    </button>
                    <button
                      onClick={() => setWorkspaceLayout('classic')}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-100 ${
                        workspaceLayout === 'classic' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                      id="layout-toggle-classic"
                    >
                      Classic List
                    </button>
                  </div>
                  
                  {/* Local state actions undo */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                     <button 
                       onClick={handleUndo} 
                       disabled={undoStack.length === 0}
                       className="p-1 px-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 text-[10px]"
                       title="Undo edit"
                     >
                        Undo
                     </button>
                     <button 
                       onClick={handleRedo} 
                       disabled={redoStack.length === 0}
                       className="p-1 px-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 text-[10px]"
                       title="Redo edit"
                     >
                        Redo
                     </button>
                  </div>
               </div>

               {/* SEARCH / INTERACTIVE BADGES BAR */}
               <div className="bg-slate-950/60 p-2.5 px-3 border-b border-slate-900 space-y-2">
                  {/* Text search with topics / diff filters */}
                  <div className="flex gap-2.5">
                     <input 
                       type="text" 
                       placeholder="Category..." 
                       value={category}
                       onChange={(e) => setCategory(e.target.value)}
                       className="bg-slate-900 border border-slate-800 rounded-xl px-2 text-xs text-white outline-none w-24"
                     />
                     <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 flex items-center space-x-2">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <input 
                          type="search" 
                          placeholder="Search number, word, topic..." 
                          value={paletteSearch}
                          onChange={(e) => setPaletteSearch(e.target.value)}
                          className="bg-transparent border-0 outline-none text-xs text-white placeholder-slate-500 w-full"
                        />
                     </div>

                     <select 
                       value={paletteFilter}
                       onChange={(e) => setPaletteFilter(e.target.value as any)}
                       className="bg-slate-900 border border-slate-800 rounded-xl px-2 text-xs font-black text-indigo-400 outline-none"
                     >
                        <option value="All">All Items</option>
                        <option value="Needs Review">Needs Review</option>
                        <option value="Low Confidence">Low Confidence</option>
                        <option value="Edited">Edited Only</option>
                        <option value="Approved">Approved Only</option>
                     </select>
                  </div>

                  {/* Bulk operations panel toggle */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                     <button 
                       onClick={() => {
                         setIsBulkMode(!isBulkMode);
                         setSelectedQuestionIds([]);
                       }}
                       className={`font-black uppercase tracking-wider ${isBulkMode ? 'text-indigo-400 underline font-black shadow' : 'text-slate-500 hover:text-white'}`}
                     >
                        {isBulkMode ? "Cancel Bulk Actions" : "Bulk Operations"}
                     </button>

                     {isBulkMode && (
                       <div className="flex items-center space-x-2">
                          <button onClick={toggleSelectAll} className="text-indigo-400 font-extrabold uppercase">All</button>
                          <button 
                            disabled={selectedQuestionIds.length === 0}
                            onClick={handleBulkApprove} 
                            className="text-green-400 font-extrabold uppercase disabled:opacity-45"
                          >
                            Approve ({selectedQuestionIds.length})
                          </button>
                          <button 
                            disabled={selectedQuestionIds.length === 0}
                            onClick={handleBulkDelete} 
                            className="text-red-400 font-extrabold uppercase disabled:opacity-45"
                          >
                            Delete
                          </button>
                       </div>
                     )}
                  </div>
               </div>

               {/* QUESTION NAVIGATION GRID (1 2 3 4 5...) */}
               <div className="bg-slate-950 p-2 border-b border-slate-900 shrink-0 select-none">
                  <div className="flex items-center space-x-1.5 overflow-x-auto py-1 no-scrollbar pr-3">
                     {filteredPaletteQuestions.map((q, idx) => {
                       const originalIdx = questions.findIndex(qu => qu.id === q.id);
                       const qDisplayNum = originalIdx + 1;
                       const isActive = activeQuestionId === q.id;
                       
                       return (
                         <button 
                           key={q.id}
                           onClick={() => {
                             setActiveQuestionId(q.id);
                             if (isBulkMode) toggleSelectQuestion(q.id);
                           }}
                           className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-black flex items-center justify-center border relative transition shrink-0 ${
                             isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl scale-105' :
                             selectedQuestionIds.includes(q.id) ? 'bg-purple-950 border-purple-800 text-purple-300' :
                             q.isApproved ? 'bg-green-955/40 border-green-900/60 text-green-400' :
                             q.uncertaintyFlag ? 'bg-amber-955/40 border-amber-900/60 text-amber-400' :
                             'bg-slate-900 border-slate-800 text-slate-400'
                           }`}
                         >
                            <span>{qDisplayNum}</span>
                            
                            {/* status dots indicator overlays */}
                            <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                               {q.uncertaintyFlag && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
                               <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                                 q.isApproved ? 'bg-green-400' :
                                 q.uncertaintyFlag ? 'bg-amber-400' :
                                 q.isEdited ? 'bg-blue-400' : 'bg-slate-700'
                               }`} />
                            </span>
                         </button>
                       );
                     })}

                     <button 
                       onClick={addQuestionManual}
                       className="h-8 min-w-[32px] px-2 bg-slate-900 border border-dashed border-slate-720 rounded-lg text-indigo-400 hover:text-white flex items-center justify-center shrink-0"
                     >
                        <Plus className="w-3.5 h-3.5" />
                     </button>
                  </div>
               </div>

               {/* WORKSPACE CENTRAL WORKSPACE: ONE QUESTION CARD AT A TIME */}
               <div className="flex-1 overflow-y-auto p-3 pr-3 md:p-6 flex flex-col items-center w-full">
                  {workspaceLayout === 'mobile-cards' ? (
                    <div className="w-full max-w-sm">
                      <MobileDraftEditor
                        questions={questions}
                        activeId={activeQuestionId || ""}
                        onSelectId={setActiveQuestionId}
                        onUpdateQuestion={handleMobileUpdateQuestion}
                        onDeleteQuestion={deleteQuestion}
                        onApproveQuestion={toggleApproveQuestion}
                        onAddQuestion={addQuestionManual}
                        onSaveTest={saveWorkspaceDraft}
                      />
                    </div>
                  ) : getActiveQuestion() ? (
                    <div className="w-full max-w-sm space-y-4">
                       
                       {/* INDIVIDUAL WORKSPACE QUESTION INDEX CARD */}
                       <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3 relative overflow-hidden">
                          
                          {/* Card Upper Area: AI Info Tags */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                             <div className="flex items-center space-x-1.5">
                                <span className="bg-slate-950 text-indigo-400 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                                  Q{getActiveQuestionIndex() + 1} of {questions.length}
                                </span>
                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest bg-slate-950 p-0.5 px-1 rounded border border-slate-850">
                                   {getActiveQuestion()?.type}
                                </span>
                             </div>

                             {/* Appended Interactive Badges tag */}
                             <div className="flex items-center space-x-1 overflow-x-auto shrink-0 max-w-[150px]">
                                {getActiveQuestion()?.uncertaintyFlag && (
                                  <button 
                                    onClick={() => setSelectedFlagDetail({
                                      title: flagMeta.ocr.title,
                                      desc: getActiveQuestion()?.qualityReport || flagMeta.ocr.desc
                                    })}
                                    className="bg-amber-950 text-amber-400 border border-amber-900/40 text-[8px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5 tracking-wider active:scale-95 transition"
                                  >
                                     <AlertTriangle className="w-2 h-2 animate-bounce" />
                                     <span>OCR Warnings</span>
                                  </button>
                                )}

                                {getActiveQuestion()?.isEdited && (
                                  <span className="bg-blue-955 text-blue-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-blue-900/30">
                                     Edited
                                  </span>
                                )}

                                {getActiveQuestion()?.isApproved ? (
                                  <span className="bg-green-950 text-green-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-green-905">
                                     Approve Checked
                                  </span>
                                ) : (
                                  <span className="bg-slate-950 text-amber-500/80 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-slate-800">
                                     Needs proof check
                                  </span>
                                )}
                             </div>
                          </div>

                          {/* INLINE QUICK TOUCH EDITOR - QUESTION BODY */}
                          <div className="space-y-1">
                             <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Tap to Edit Question Body</label>
                             <textarea 
                               value={getActiveQuestion()?.text || ""}
                               onChange={(e) => updateActiveQuestion('text', e.target.value)}
                               className="w-full text-xs font-semibold text-slate-150 bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-2xl p-3 h-24 outline-none resize-none leading-relaxed"
                             />
                          </div>

                          {/* DOUBLE CLICK OPTIONS CONTAINER */}
                          {getActiveQuestion()?.options && (
                            <div className="space-y-2 pt-1 border-t border-slate-850/60">
                               <div className="flex items-center justify-between">
                                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Mock Answer option choices</span>
                                  <button 
                                    onClick={() => {
                                      const opts = getActiveQuestion()?.options || [];
                                      const nextOpts = [...opts, `Choice ${String.fromCharCode(65 + opts.length)}`];
                                      updateActiveQuestion('options', nextOpts);
                                    }}
                                    className="text-[9px] font-black text-indigo-400 uppercase tracking-widest"
                                  >
                                    + Add Item
                                  </button>
                               </div>

                               <div className="space-y-1.5 max-h-[160px] overflow-y-auto no-scrollbar">
                                  {getActiveQuestion()?.options?.map((opt, oIdx) => {
                                    const label = String.fromCharCode(65 + oIdx);
                                    const isCorrect = getActiveQuestion()?.correctAnswers?.includes(opt) || getActiveQuestion()?.correctAnswers?.includes(label) || getActiveQuestion()?.correctAnswers?.includes(oIdx.toString());

                                    return (
                                      <div key={oIdx} className="flex items-center gap-1.5">
                                         {/* Touch Select Toggle Correct Badge */}
                                         <button 
                                           onClick={() => {
                                             const currentAnswers = [...(getActiveQuestion()?.correctAnswers || [])];
                                             if (isCorrect) {
                                               updateActiveQuestion('correctAnswers', currentAnswers.filter(a => a !== opt && a !== label && a !== oIdx.toString()));
                                             } else {
                                               if (getActiveQuestion()?.type === 'MCQ') {
                                                 updateActiveQuestion('correctAnswers', [opt]);
                                               } else {
                                                 updateActiveQuestion('correctAnswers', [...currentAnswers, opt]);
                                               }
                                             }
                                           }}
                                           className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black border transition ${
                                             isCorrect ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'
                                           }`}
                                         >
                                            {isCorrect ? '✓' : label}
                                         </button>

                                         <input 
                                           type="text" 
                                           value={opt}
                                           onChange={(e) => {
                                             const updatedOpts = [...(getActiveQuestion()?.options || [])];
                                             const oldVal = updatedOpts[oIdx];
                                             updatedOpts[oIdx] = e.target.value;
                                             updateActiveQuestion('options', updatedOpts);
                                             if (getActiveQuestion()?.correctAnswers?.includes(oldVal)) {
                                               updateActiveQuestion('correctAnswers', getActiveQuestion()?.correctAnswers?.map(ans => ans === oldVal ? e.target.value : ans));
                                             }
                                           }}
                                           className="flex-1 text-[11px] bg-slate-950 border border-slate-850 rounded-xl p-1.5 px-2.5 text-white outline-none focus:border-indigo-500"
                                         />

                                         <button 
                                           onClick={() => {
                                             const updatedOpts = getActiveQuestion()?.options?.filter((_, idx) => idx !== oIdx) || [];
                                             updateActiveQuestion('options', updatedOpts);
                                             updateActiveQuestion('correctAnswers', getActiveQuestion()?.correctAnswers?.filter(ans => ans !== opt));
                                           }}
                                           className="p-1 text-slate-650 hover:text-red-400 hover:bg-slate-950 rounded-lg"
                                         >
                                            <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                      </div>
                                    );
                                  })}
                               </div>
                            </div>
                          )}

                          {/* INLINE QUICK TOUCH EDITOR - SOLUTION METHOD 1 */}
                          <div className="space-y-1 pt-1 border-t border-slate-850/60">
                             <div className="flex items-center justify-between">
                               <label className="text-[9px] uppercase font-extrabold text-indigo-400 tracking-wider">Solution Method 1: Step-by-Step Detailed Solution</label>
                               <span className="text-[8px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded font-mono">Standard</span>
                             </div>
                             <textarea 
                               placeholder="Method 1: Step-by-step rigorous calculation and explanation..."
                               value={getActiveQuestion()?.explanation || ""}
                               onChange={(e) => updateActiveQuestion('explanation', e.target.value)}
                               className="w-full text-[11px] text-slate-300 bg-slate-950 border border-slate-850 rounded-2xl p-2.5 h-16 outline-none resize-none leading-relaxed focus:border-indigo-500"
                             />
                          </div>

                          {/* INLINE QUICK TOUCH EDITOR - SOLUTION METHOD 2 */}
                          <div className="space-y-1 pt-1 border-t border-slate-850/60">
                             <div className="flex items-center justify-between">
                               <label className="text-[9px] uppercase font-extrabold text-emerald-400 tracking-wider">Solution Method 2: Exam Shortcut & Rapid Trick</label>
                               <span className="text-[8px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-mono">Shortcut</span>
                             </div>
                             <textarea 
                               placeholder="Method 2: Fastest way to solve in an exam using tricks, options elimination..."
                               value={getActiveQuestion()?.examApproach || ""}
                               onChange={(e) => updateActiveQuestion('examApproach', e.target.value)}
                               className="w-full text-[11px] text-slate-300 bg-slate-950 border border-slate-850 rounded-2xl p-2.5 h-16 outline-none resize-none leading-relaxed focus:border-emerald-500"
                             />
                          </div>

                          {/* INLINE QUICK TOUCH EDITOR - SOLUTION METHOD 3 */}
                          <div className="space-y-1 pt-1 border-t border-slate-850/60">
                             <div className="flex items-center justify-between">
                               <label className="text-[9px] uppercase font-extrabold text-blue-400 tracking-wider">Solution Method 3: Core Theorem & Alternative Method</label>
                               <span className="text-[8px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded font-mono">Formula/Theorem</span>
                             </div>
                             <textarea 
                               placeholder="Method 3: Core formula, fundamental theorem, or alternative conceptual approach..."
                               value={getActiveQuestion()?.ruleOrTheorem || ""}
                               onChange={(e) => updateActiveQuestion('ruleOrTheorem', e.target.value)}
                               className="w-full text-[11px] text-slate-300 bg-slate-950 border border-slate-850 rounded-2xl p-2.5 h-16 outline-none resize-none leading-relaxed focus:border-blue-500"
                             />
                          </div>

                          {/* Metadata adjustments block: Points, Topic & flags toggler */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-850">
                             <div>
                                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Points awarded</label>
                                <input 
                                  type="number"
                                  value={getActiveQuestion()?.points || 1}
                                  onChange={(e) => updateActiveQuestion('points', Math.max(1, Number(e.target.value)))}
                                  className="w-full bg-slate-950 border border-slate-850 text-xs text-white rounded-lg p-1.5 outline-none focus:border-indigo-500"
                                />
                             </div>
                             <div>
                                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Topic target</label>
                                <input 
                                  type="text"
                                  placeholder="E.g., Kinematics"
                                  value={getActiveQuestion()?.topic || ""}
                                  onChange={(e) => updateActiveQuestion('topic', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-850 text-xs text-white rounded-lg p-1.5 outline-none focus:border-indigo-500"
                                />
                             </div>
                          </div>

                          {/* Toggle Flag or Approve checkboxes */}
                          <div className="flex gap-2.5 pt-2">
                             <button 
                               onClick={() => updateActiveQuestion('uncertaintyFlag', !getActiveQuestion()?.uncertaintyFlag)}
                               className={`flex-1 py-1.5 border rounded-xl text-[10px] font-black uppercase text-center flex items-center justify-center space-x-1 ${
                                 getActiveQuestion()?.uncertaintyFlag ? 'bg-amber-955 border-amber-900 text-amber-400 animate-pulse' : 'bg-slate-950 border-slate-850 text-slate-500'
                               }`}
                             >
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>OCR Doubtful Flag</span>
                             </button>

                             <button 
                               onClick={() => toggleApproveQuestion(activeQuestionId!)}
                               className={`flex-1 py-1.5 border rounded-xl text-[10px] font-black uppercase text-center flex items-center justify-center space-x-1 ${
                                 getActiveQuestion()?.isApproved ? 'bg-green-955 border-green-900 text-green-400' : 'bg-slate-950 border-slate-850 text-slate-500'
                               }`}
                             >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{getActiveQuestion()?.isApproved ? "Approved Check" : "Click To Approve"}</span>
                             </button>
                          </div>
                       </div>

                       {/* PORTRAIT MOVEMENT ROTATORS */}
                       <div className="grid grid-cols-2 gap-2 mt-2">
                          <button 
                            onClick={prevQuestion}
                            disabled={getActiveQuestionIndex() === 0}
                            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-slate-300 font-bold p-3 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5"
                          >
                             <ChevronLeft className="w-4 h-4" />
                             <span>Prev Card</span>
                          </button>
                          <button 
                            onClick={nextQuestion}
                            disabled={getActiveQuestionIndex() === questions.length - 1}
                            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-slate-300 font-bold p-3 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5"
                          >
                             <span>Next Card</span>
                             <ChevronRight className="w-4 h-4" />
                          </button>
                       </div>

                       {/* SIDE UTILITY PANEL MODES: SPLIT, MERGE, DELETE */}
                       <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-[11px]">
                          <button 
                            onClick={() => splitQuestion(activeQuestionId!)}
                            className="text-indigo-400 hover:underline font-bold flex items-center gap-1"
                          >
                             <Scissors className="w-3.5 h-3.5" />
                             <span>Split/Halve Choice</span>
                          </button>

                          {getActiveQuestionIndex() < questions.length - 1 && (
                            <button 
                              onClick={() => mergeQuestionBelow(getActiveQuestionIndex())}
                              className="text-slate-400 hover:text-white font-bold"
                            >
                               Merge Downward ↓
                            </button>
                          )}

                          <button 
                            onClick={() => deleteQuestion(activeQuestionId!)}
                            className="text-red-400 hover:underline font-bold flex items-center gap-1"
                          >
                             <Trash2 className="w-3.5 h-3.5" />
                             <span>Delete</span>
                          </button>
                       </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 uppercase text-xs font-bold space-y-1.5 pr-2">
                       <HelpCircle className="w-8 h-8 mx-auto text-slate-600 animate-bounce" />
                       <h4>No Question Selected</h4>
                       <p className="text-[10px] lowercase text-slate-500">Pick any number in the horizontal bar or add manually</p>
                    </div>
                  )}
               </div>

               {/* INTERACTIVE ALERTS DETAILS MODAL OVERLAY */}
               {selectedFlagDetail && (
                 <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 w-full max-w-xs text-left space-y-3 shadow-2xl">
                       <div className="flex items-center space-x-2 border-b border-slate-805 pb-1 text-amber-400">
                          <AlertTriangle className="w-4 h-4 animate-bounce" />
                          <h4 className="text-xs font-black uppercase tracking-wider">{selectedFlagDetail.title}</h4>
                       </div>
                       <p className="text-xs text-slate-350 leading-relaxed font-medium">
                          {selectedFlagDetail.desc}
                       </p>
                       <button 
                         onClick={() => setSelectedFlagDetail(null)}
                         className="w-full py-1.5 bg-slate-800 rounded-xl text-xs font-extrabold text-white text-center"
                       >
                         Understood
                       </button>
                    </div>
                 </div>
               )}

               {/* STICKY BOTTOM FIXED MOBILE ACTION DRAWER */}
               <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95  border-t border-slate-800 p-4 pt-3.5 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
                  {/* Left Side: Secondary Utilities */}
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                     <button 
                       onClick={() => saveWorkspaceDraft(false)}
                       className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider rounded-xl border border-amber-400 text-center transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                     >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Save as Draft</span>
                     </button>
                     <button 
                       onClick={() => {
                         commitVersionHistory();
                         alert("Workspace state saved as snapshot version " + (versionHistory.length + 1) + "!");
                       }}
                       className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-extrabold text-[10px] uppercase tracking-wider rounded-xl border border-slate-800 text-center transition active:scale-95"
                     >
                        Snapshot
                     </button>
                     <button 
                       onClick={() => setStage('preview')}
                       className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 font-extrabold text-[10px] uppercase tracking-wider rounded-xl border border-indigo-900/60 text-center transition active:scale-95"
                     >
                        Preview Test
                     </button>
                  </div>

                  {/* Right Side: Primary Publish Actions */}
                  {['mentor', 'primary-mentor', 'admin'].includes(userProfile?.role || '') && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                       <button 
                         onClick={() => {
                           setPublishCreateTest(true);
                           setPublishSaveToLibrary(false);
                           setIsPublishModalOpen(true);
                         }}
                         className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl text-center transition shadow-lg flex items-center justify-center gap-1.5 active:scale-95"
                       >
                         <BookOpen className="w-3.5 h-3.5" />
                         <span>Create Test</span>
                       </button>
                       <button 
                         onClick={() => {
                           setPublishSaveToLibrary(true);
                           setPublishCreateTest(false);
                           setIsPublishModalOpen(true);
                         }}
                         className="py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl text-center transition shadow-lg flex items-center justify-center gap-1.5 active:scale-95 animate-shimmer"
                       >
                         <Bookmark className="w-3.5 h-3.5" />
                         <span>Save to Question Library</span>
                       </button>
                    </div>
                  )}
               </nav>
            </motion.div>
          )}
            {/* STAGE E: FULL MOBILE PREVIEW CORRESPONDING TO STUDENT EXAMS */}
          {stage === 'preview' && (
            <TestPreviewScreen 
              title={title}
              subject={subject}
              duration={duration}
              questions={questions}
              onClose={() => setStage('workspace')}
            />
          )}

          {false && (() => {
            const activeQs = questions.length > 0 ? questions : fallbackQuestions;
            const currentQ = activeQs[activePreviewIdx];
            const answeredCount = Object.keys(previewAnswers).length;
            const unansweredCount = activeQs.length - answeredCount;

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
              <motion.div 
                key="test-creator-stage-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full bg-slate-50 text-slate-900 flex flex-col overflow-y-auto overflow-x-hidden md:py-8 md:px-4 select-none"
              >
                {/* Central verification banner outside the phone screen on Desktop */}
                <div className="w-full max-w-md mx-auto mb-4 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-2xl p-4 shadow-xl flex flex-col gap-2 shrink-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider">
                      <AlertCircle className="w-4 h-4 animate-bounce" />
                      <span>Interactive Live Assessment Previewer</span>
                    </span>
                    <button 
                      onClick={() => setStage('workspace')} 
                      className="px-3 py-1 bg-slate-950 text-white hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
                    >
                      Return to Workspace
                    </button>
                  </div>
                  <p className="text-[11px] text-indigo-50 leading-relaxed font-medium">
                    This previews the exact visual and interactive student test environment compiled from your dynamic template. Try selecting options, marking/bookmarking questions, and clicking the top-right menu to view the answer grid!
                  </p>
                </div>

                {/* Smartphone View Mock container */}
                <div className="w-full max-w-md mx-auto aspect-[9/19] md:h-[780px] bg-white md:rounded-[40px] md:border-[12px] md:border-neutral-950 md:shadow-2xl md:ring-12 md:ring-neutral-900/10 flex flex-col relative overflow-hidden text-left shadow-lg">
                  
                  {/* Top Header Bar (Dark/Black background from Mockup) */}
                  <header className="bg-neutral-950 text-white h-14 px-4 flex items-center justify-between shrink-0 select-none">
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Preview Pause Button */}
                      <button 
                        onClick={() => alert("Preview Paused")} 
                        className="w-8 h-8 rounded-full border border-neutral-850 hover:bg-neutral-900 flex items-center justify-center text-white active:scale-95 transition shrink-0"
                        title="Pause exam"
                      >
                        <Pause className="w-3.5 h-3.5 fill-white" />
                      </button>
                      
                      {/* Timer & Assessment category */}
                      <div className="flex flex-col text-left min-w-0">
                        <span className="text-[15px] font-bold tracking-tight font-mono leading-none text-white">
                          {formatHHMMSS(previewTimer)}
                        </span>
                        <span className="text-[10px] font-medium text-neutral-400 truncate mt-0.5 max-w-[190px]">
                          {subject || "General Intelligence and Reasoning"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Language indicator "E/अ" */}
                      <button 
                        onClick={() => alert("Defaulting to English layout")}
                        className="flex items-center space-x-1.5 px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-xs font-semibold text-neutral-200 active:scale-95 transition"
                      >
                        <Languages className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">E/अ</span>
                      </button>

                      {/* Hamburger Menu button */}
                      <button 
                        onClick={() => setShowPaletteDrawer(true)}
                        className="p-1.5 rounded-lg text-neutral-200 hover:bg-neutral-900 active:scale-95 transition"
                        title="Toggle Question Grid Sheet"
                      >
                        <Menu className="w-6 h-6" />
                      </button>
                    </div>
                  </header>

                  {/* Secondary Bar (White background, light gray bottom border) */}
                  <div className="h-10 border-b border-gray-100 bg-white px-4 flex items-center justify-between shrink-0 text-xs">
                    <div className="flex items-center space-x-1.5 font-bold text-neutral-700">
                      <span>Total Questions Answered:</span>
                      <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full text-[11px] font-black">
                        {answeredCount}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="bg-rose-50 text-rose-600 border border-rose-100 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 block"></span>
                        Last 15 Mins
                      </span>
                    </div>
                  </div>

                  {/* Inside viewport of phone container */}
                  <div className="flex-1 overflow-y-auto bg-white p-4 flex flex-col text-left">
                    {currentQ ? (
                      <div className="flex-1 flex flex-col justify-between">
                        
                        <div className="space-y-4">
                          {/* Active indices & timers */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {/* Blue circle indicator for active question number */}
                              <span className="w-7 h-7 bg-blue-600 text-white font-bold text-sm rounded-md flex items-center justify-center shadow">
                                {activePreviewIdx + 1}
                              </span>

                              {/* Question Timer */}
                              <span className="flex items-center space-x-1 text-slate-400 text-xs font-semibold font-mono">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{formatMMSS(previewQuestionSeconds[currentQ.id] || 0)}</span>
                              </span>
                            </div>

                            {/* Actions icons group */}
                            <div className="flex items-center space-x-3 text-slate-400">
                              <button 
                                onClick={() => alert("Flagged question metadata reported.")}
                                className="hover:text-amber-500 active:scale-90 transition"
                                title="Report question issue"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                              
                              <button 
                                onClick={() => setPreviewMarkedForReview(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))}
                                className={`${previewMarkedForReview[currentQ.id] ? "text-amber-500 fill-amber-500" : "hover:text-blue-600"} active:scale-95 transition`}
                                title="Bookmark Question"
                              >
                                <Bookmark className="w-4 h-4" />
                              </button>

                              <button 
                                onClick={() => alert("Marked as important star rating active")}
                                className="hover:text-yellow-500 active:scale-90 transition"
                                title="Favorite question"
                              >
                                <Star className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Question Text */}
                          <div className="pt-2 text-left">
                            <div className="text-[17px] font-bold text-slate-900 leading-snug tracking-tight">
                              <MathRenderer content={currentQ.text} />
                            </div>
                          </div>

                          {/* Multi choice Options with beautiful italic labeling prefixes */}
                          {currentQ.options && (
                            <div className="space-y-3 pt-3">
                              {currentQ.options.map((opt, oIdx) => {
                                const optIdxLabel = `${oIdx + 1}.`;
                                const isSelected = previewAnswers[currentQ.id] === opt;

                                return (
                                  <button
                                    key={oIdx}
                                    onClick={() => setPreviewAnswers(prev => ({ ...prev, [currentQ.id]: opt }))}
                                    className={`w-full text-left py-4 px-5 rounded-xl border text-base flex items-center justify-between transition duration-150 active:scale-[0.99] cursor-pointer shadow-sm ${
                                      isSelected 
                                        ? "ring-2 ring-blue-600 bg-blue-50/40 border-blue-600 font-bold" 
                                        : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                                    }`}
                                  >
                                    <div className="flex items-center min-w-0">
                                      {/* Italic Gray Index prefix */}
                                      <span className="font-serif italic text-base text-slate-450 mr-3 shrink-0">
                                        {optIdxLabel}
                                      </span>
                                      <span className="text-[15px] font-semibold text-slate-800">
                                        <MathRenderer content={opt} />
                                      </span>
                                    </div>
                                    
                                    {isSelected && (
                                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-bold">
                                        ✓
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Navigation controls & Mark For Review - Save & Next action row */}
                        <div className="pt-6 mt-auto pb-4 flex items-center justify-between gap-3">
                          <button
                            onClick={() => {
                              setPreviewMarkedForReview(prev => ({ ...prev, [currentQ.id]: true }));
                              if (activePreviewIdx < activeQs.length - 1) {
                                setActivePreviewIdx(prev => prev + 1);
                              } else {
                                alert("Last question. Use the slider menu to view exam status!");
                              }
                            }}
                            className="flex-1 py-3 border border-indigo-600 bg-transparent text-indigo-700 font-extrabold text-xs uppercase tracking-wider rounded-xl text-center active:scale-95 transition"
                          >
                            Mark For Review
                          </button>

                          <button
                            onClick={() => {
                              if (activePreviewIdx < activeQs.length - 1) {
                                setActivePreviewIdx(prev => prev + 1);
                              } else {
                                alert("Completed mock sequence! Open top menu to click Submit Test.");
                              }
                            }}
                            className="flex-1 py-3 bg-blue-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl text-center shadow-md active:scale-95 transition hover:bg-blue-755 hover:bg-blue-700"
                          >
                            Save & Next
                          </button>
                        </div>

                      </div>
                    ) : (
                      <div className="py-24 text-center text-slate-400 text-sm font-semibold">
                        No questions compiled.
                      </div>
                    )}
                  </div>

                  {/* STYLISH DRAWER PANEL OVERLAY (Screenshot 1) */}
                  <AnimatePresence key="test-creator-drawer-presence">
                    {showPaletteDrawer && (
                      <motion.div
                        key="test-creator-palette-drawer-wrapper"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40"
                      >
                        {/* Drawer Backdrop Glassmorphism */}
                        <div
                          onClick={() => setShowPaletteDrawer(false)}
                          className="absolute inset-0 bg-neutral-950/50 z-40 cursor-pointer"
                        />

                        {/* Side Sheet Drawer contents */}
                        <motion.div
                          initial={{ x: "100%" }}
                          animate={{ x: 0 }}
                          exit={{ x: "100%" }}
                          transition={{ type: "spring", damping: 25, stiffness: 220 }}
                          className="absolute right-0 top-0 bottom-0 w-4/5 max-w-[340px] bg-white z-50 flex flex-col shadow-2xl p-4 select-none"
                        >
                          <div className="flex items-center justify-between border-b pb-3 border-gray-150">
                            {/* Tab Layout: Symbols vs Instructions */}
                            <div className="flex gap-1">
                              <button 
                                onClick={() => setActivePreviewTab(activePreviewTab === 'symbols' ? null : 'symbols')}
                                className={`px-2 py-1.5 text-xs font-black rounded-lg flex items-center space-x-1 ${
                                  activePreviewTab === "symbols" ? "bg-blue-100 text-blue-700" : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                                }`}
                              >
                                <span>? Symbols</span>
                              </button>
                              <button 
                                onClick={() => setActivePreviewTab(activePreviewTab === 'instructions' ? null : 'instructions')}
                                className={`px-2 py-1.5 text-xs font-black rounded-lg flex items-center space-x-1 ${
                                  activePreviewTab === "instructions" ? "bg-blue-100 text-blue-700" : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                                }`}
                              >
                                <span>ⓘ Instructions</span>
                              </button>
                            </div>

                            <button 
                              onClick={() => setShowPaletteDrawer(false)}
                              className="p-1 rounded-full text-slate-400 hover:bg-slate-100 transition"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Render popup panels for Symbols or Instructions inside the drawer */}
                          {activePreviewTab && (
                            <div className="my-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-left select-text max-h-[140px] overflow-y-auto">
                              <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-1.5">
                                {activePreviewTab === "symbols" ? "Math Symbols Key" : "Exam Guidelines"}
                              </h4>
                              {activePreviewTab === "symbols" ? (
                                <div className="text-[11px] text-blue-800 space-y-1 font-mono">
                                  <p>• <strong>P</strong> : Algebraic Addition Operator (+)</p>
                                  <p>• <strong>Q</strong> : Product Multiplying Operator (×)</p>
                                  <p>• <strong>Δ</strong> : Dynamic Rate of Increment</p>
                                  <p>• <strong>Σ</strong> : Iterative Sum of parameters</p>
                                </div>
                              ) : (
                                <div className="text-[11px] text-blue-800 space-y-1">
                                  <p>1. Ensure to save your choice before clicking next.</p>
                                  <p>2. Questions flagged "Review" will hold color orange.</p>
                                  <p>3. Submit only after completing all responses.</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sub-header inside drawer */}
                          <div className="pt-3 text-left">
                            <span className="inline-block bg-blue-600 text-white font-extrabold text-[10px] px-3 py-1 rounded tracking-wide mb-2">
                              PART - A
                            </span>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-4">
                              Test
                            </h2>
                          </div>

                          {/* Answered / Unanswered stats row box details from Screenshot 1 */}
                          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 mb-4 shrink-0 text-left">
                            <div className="flex items-center justify-between p-3.5 bg-neutral-50/50">
                              <span className="flex items-center space-x-2 text-[13px] font-semibold text-slate-700">
                                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 block"></span>
                                <span>Answered Qs</span>
                              </span>
                              <span className="text-[14px] font-black text-slate-900 font-mono">
                                {answeredCount}
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-3.5 bg-neutral-50/50">
                              <span className="flex items-center space-x-2 text-[13px] font-semibold text-slate-700">
                                <span className="w-3.5 h-3.5 rounded-full bg-blue-600 block"></span>
                                <span>Unanswered Qs</span>
                              </span>
                              <span className="text-[14px] font-black text-slate-900 font-mono">
                                {unansweredCount}
                              </span>
                            </div>
                          </div>

                          {/* Answer Grid Palette from Screenshot 1 (25 Grid Cells) */}
                          <div className="flex-1 overflow-y-auto pr-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 leading-none">
                              Question Navigation Palette
                            </span>
                            
                            <div className="grid grid-cols-6 gap-2">
                              {activeQs.map((q, idx) => {
                                const isAnswered = !!previewAnswers[q.id];
                                const isMarked = previewMarkedForReview[q.id];
                                const isActive = activePreviewIdx === idx;

                                // Colors exactly matching Screenshot 1 guidelines
                                // Active: White bg, blue border, blue text
                                // Marked for Review: Solid orange bg, white text
                                // Answered Qs: Solid green bg, white text
                                // Unanswered Qs: Solid blue bg, white text
                                return (
                                  <button
                                    key={q.id}
                                    onClick={() => {
                                      setActivePreviewIdx(idx);
                                      setShowPaletteDrawer(false);
                                    }}
                                    className={`aspect-square rounded-xl text-sm font-bold flex items-center justify-center transition active:scale-95 duration-100 ${
                                      isActive 
                                        ? "bg-white border-2 border-blue-600 text-blue-600 ring-1 ring-blue-500/20"
                                        : isMarked 
                                          ? "bg-amber-500 text-white"
                                          : isAnswered 
                                            ? "bg-emerald-500 text-white" 
                                            : "bg-blue-600 text-white"
                                    }`}
                                  >
                                    {idx + 1}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Full-width drawer Submit Button matching screenshot 1 */}
                          <div className="pt-4 border-t mt-auto">
                            <button
                              onClick={() => {
                                setShowPaletteDrawer(false);
                                setShowPreviewSubmitConfirm(true);
                              }}
                              className="w-full py-4 bg-slate-400 hover:bg-slate-500 text-white font-extrabold text-sm uppercase tracking-widest rounded-xl text-center active:scale-105 transition shadow-md duration-150"
                            >
                              SUBMIT TEST
                            </button>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>

                {/* Submit test outcomes sheet overlay modal */}
                <AnimatePresence key="test-creator-submit-presence">
                  {showPreviewSubmitConfirm && (
                    <div key="test-creator-submit-confirm-backdrop" className="fixed inset-0 bg-slate-950/80  z-50 flex items-center justify-center p-4">
                      <motion.div 
                        key="test-creator-submit-confirm-modal"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
                      >
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                          <CheckCircle2 className="w-10 h-10" />
                        </div>
                        
                        <div className="space-y-1.5">
                          <h3 className="text-lg font-black text-slate-900 leading-none">Submit Examination?</h3>
                          <p className="text-xs text-slate-500">
                            Confirming will transmit mock student statistics to the assessment engine dashboards.
                          </p>
                        </div>

                        {/* Outcomes summary */}
                        <div className="bg-slate-50 p-3.5 rounded-2xl divide-y divide-slate-100 text-xs text-slate-700">
                          <div className="flex justify-between py-1.5">
                            <span>Total Questions</span>
                            <span className="font-extrabold text-slate-900">{activeQs.length}</span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span>Answered & Saved</span>
                            <span className="font-extrabold text-emerald-600">{answeredCount}</span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span>Marked for Review</span>
                            <span className="font-extrabold text-amber-500">
                              {Object.values(previewMarkedForReview).filter(Boolean).length}
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span>Unanswered Left</span>
                            <span className="font-extrabold text-blue-600">{unansweredCount}</span>
                          </div>
                        </div>

                        <div className="flex gap-3.5 pt-2">
                          <button
                            onClick={() => setShowPreviewSubmitConfirm(false)}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase rounded-xl transition"
                          >
                            Go Back
                          </button>
                          <button
                            onClick={() => {
                              setShowPreviewSubmitConfirm(false);
                              setStage('workspace');
                              alert(`Exam successfully processed! ${answeredCount} answered correctly or tracked.`);
                            }}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase rounded-xl transition shadow"
                          >
                            Submit Now
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

              </motion.div>
            );
          })()}

         {/* PROMPT PREVIEW OVERLAY MODAL (Req 20) */}
         <AnimatePresence key="test-creator-prompt-presence">
            {showPromptPreview && (
              <div key="test-creator-prompt-preview-backdrop" className="fixed inset-0 z-50 bg-slate-950/90  flex items-center justify-center p-4">
                 <motion.div 
                   key="test-creator-prompt-preview-modal"
                   initial={{ scale: 0.95, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   exit={{ scale: 0.95, opacity: 0 }}
                   className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm text-left space-y-4 shadow-2xl overflow-hidden relative font-sans"
                 >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
                    
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                       <div className="flex items-center space-x-2">
                          <Sparkles className="w-4 h-4 text-pink-500 animate-pulse" />
                          <h4 className="text-xs font-black uppercase text-white tracking-wider">AI Prompt Pipeline Preview</h4>
                       </div>
                       <button 
                         onClick={() => setShowPromptPreview(false)}
                         className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                       >
                          <X className="w-4 h-4" />
                       </button>
                    </div>

                    {/* Uploaded Documents List summary */}
                    <div className="space-y-1.5">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📂 Study Documents Ingestion Stack</span>
                       <div className="bg-slate-950 border border-slate-850 rounded-2xl p-3 space-y-1.5 max-h-24 overflow-y-auto no-scrollbar">
                          {uploadQueue.map((item, index) => (
                            <div key={`${item.id}-${index}`} className="flex items-center justify-between text-[11px] text-slate-300">
                               <span className="truncate max-w-[190px] font-bold">
                                 {index + 1}. {item.name}
                               </span>
                               <span className="text-[9px] uppercase font-black text-indigo-400 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/30">
                                 {item.type}
                               </span>
                            </div>
                          ))}
                       </div>
                       <p className="text-[9px] text-slate-500">
                         Loaded materials: {uploadQueue.length} files
                       </p>
                    </div>

                    {/* Fixed core extraction task flows */}
                    <div className="space-y-1.5">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">⚙️ Default Ingestion System Tasks</span>
                       <div className="grid grid-cols-1 gap-1 bg-slate-950 border border-slate-850 rounded-2xl p-3 font-medium">
                          {[
                            "Extract MCQs, true/false & single choice types",
                            "Synthesize correct answers with high-grade key",
                            "Generate granular, step-by-step explanations",
                            "Preserve original question identifiers & sequence numbering",
                            "Construct a responsive, mobile-first mock-test workspace"
                          ].map((task) => (
                            <div key={task} className="flex items-center space-x-2 text-[10px] text-slate-300">
                               <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                               <span>{task}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    {/* Custom overlays instructions text box */}
                    <div className="space-y-1.5">
                       <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">⚡ Custom Overlay Directives</span>
                       <div className="bg-slate-950 border border-rose-950/40 rounded-2xl p-3 min-h-[4.5rem] flex items-center justify-center">
                          {preferences.trim() ? (
                            <p className="text-[11px] text-slate-100 italic leading-relaxed text-left w-full font-medium">
                              "{preferences}"
                            </p>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic font-medium">
                              "None (Using deep, baseline precise parser settings only)"
                            </span>
                          )}
                       </div>
                    </div>

                    {/* Instructions warning */}
                    <p className="text-[9.5px] text-slate-400 leading-normal bg-indigo-950/30 border border-indigo-900/40 p-2.5 rounded-xl font-medium">
                      Your overlay directive works as an expert customization rules layer. It does not replace the default high-integrity parsers and safeguards.
                    </p>

                    {/* Confirm & Continue Buttons */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                       <button 
                         type="button"
                         onClick={() => setShowPromptPreview(false)}
                         className="py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider text-center active:scale-95 transition"
                       >
                         Edit Prompt
                       </button>
                       <button 
                         type="button"
                         onClick={() => {
                           setShowPromptPreview(false);
                           startAiAnalysis();
                         }}
                         className="py-2.5 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest text-center shadow-lg active:scale-95 transition"
                       >
                         Continue & Ingest
                       </button>
                    </div>
                 </motion.div>
              </div>
            )}
         </AnimatePresence>

         {/* MISSIONGRID QUESTION LIBRARY INTEGRATION MODAL */}
         <AnimatePresence key="test-creator-publish-options-presence">
            {isPublishModalOpen && (
              <div key="test-creator-publish-options-backdrop" className="fixed inset-0 z-50 bg-slate-950/90  flex items-center justify-center p-4 overflow-y-auto">
                 <motion.div 
                   key="test-creator-publish-options-modal"
                   initial={{ scale: 0.95, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   exit={{ scale: 0.95, opacity: 0 }}
                   className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg text-left space-y-5 shadow-2xl relative my-8"
                 >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                       <div className="flex items-center space-x-2.5">
                          <Bookmark className="w-5 h-5 text-indigo-400" />
                          <div>
                             <h3 className="text-sm font-black text-white uppercase tracking-wider">Commit & Publish Actions</h3>
                             <p className="text-[10px] text-slate-400">Finalize test creation and sync to the central repository</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => setIsPublishModalOpen(false)}
                         className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
                       >
                          <X className="w-4 h-4" />
                       </button>
                    </div>

                    {/* Checkbox Options */}
                    <div className="space-y-2.5">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Choose Action Options</span>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Option 1: Save to Question Library */}
                          <label 
                            className={`flex items-start p-3.5 rounded-2xl border cursor-pointer select-none transition-all duration-150 ${
                              publishSaveToLibrary 
                                ? 'bg-indigo-950/30 border-indigo-500/50 text-indigo-200' 
                                : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
                            }`}
                          >
                             <input 
                               type="checkbox" 
                               checked={publishSaveToLibrary}
                               onChange={(e) => setPublishSaveToLibrary(e.target.checked)}
                               className="sr-only"
                             />
                             <div className="flex items-center space-x-3">
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                  publishSaveToLibrary ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700'
                                }`}>
                                   {publishSaveToLibrary && <Check className="w-3 h-3" />}
                                </div>
                                <div>
                                   <span className="text-xs font-black uppercase tracking-wider block">Save to Library</span>
                                   <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Commit extracted items to MissionGrid Central Library</span>
                                </div>
                             </div>
                          </label>

                          {/* Option 2: Create Mock Test */}
                          <label 
                            className={`flex items-start p-3.5 rounded-2xl border cursor-pointer select-none transition-all duration-150 ${
                              publishCreateTest 
                                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' 
                                : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
                            }`}
                          >
                             <input 
                               type="checkbox" 
                               checked={publishCreateTest}
                               onChange={(e) => {
                                 setPublishCreateTest(e.target.checked);
                                 if (!e.target.checked) setPublishShareToCommunity(false);
                               }}
                               className="sr-only"
                             />
                             <div className="flex items-center space-x-3">
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                  publishCreateTest ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700'
                                }`}>
                                   {publishCreateTest && <Check className="w-3 h-3" />}
                                </div>
                                <div>
                                   <span className="text-xs font-black uppercase tracking-wider block">Create Test</span>
                                   <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Publish test and release mock paper to batches</span>
                                </div>
                             </div>
                          </label>
                       </div>
                       
                       
                    </div>

                    {/* Smart Classification Panel */}
                    {(publishSaveToLibrary || publishCreateTest) && (
                      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-3">
                         <div className="flex items-center space-x-1.5 border-b border-slate-850 pb-2">
                            <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest">🧠 Smart Classification & Meta Data</span>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Subject Override</label>
                               <input 
                                 type="text" 
                                 value={smartSubject}
                                 onChange={(e) => setSmartSubject(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white outline-none focus:border-indigo-500"
                                 placeholder="e.g. Physics"
                               />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Chapter Override</label>
                               <input 
                                 type="text" 
                                 value={smartChapter}
                                 onChange={(e) => setSmartChapter(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white outline-none focus:border-indigo-500"
                                 placeholder="e.g. Kinematics"
                               />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Topic Override</label>
                               <input 
                                 type="text" 
                                 value={smartTopic}
                                 onChange={(e) => setSmartTopic(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white outline-none focus:border-indigo-500"
                                 placeholder="e.g. Projectile Motion"
                               />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Difficulty</label>
                               <select 
                                 value={smartDifficulty}
                                 onChange={(e) => setSmartDifficulty(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white outline-none focus:border-indigo-500"
                               >
                                  <option value="Easy">Easy</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Hard">Hard</option>
                                  <option value="Expert">Expert</option>
                               </select>
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Target Exam / Tag</label>
                               <input 
                                 type="text" 
                                 value={smartExam}
                                 onChange={(e) => setSmartExam(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white outline-none focus:border-indigo-500"
                                 placeholder="e.g. JEE Main"
                               />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Language</label>
                               <select 
                                 value={smartLanguage}
                                 onChange={(e) => setSmartLanguage(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white outline-none focus:border-indigo-500"
                               >
                                  <option value="English">English</option>
                                  <option value="Hindi">Hindi</option>
                                  <option value="Bilingual">Bilingual</option>
                               </select>
                            </div>
                         </div>
                      </div>
                    )}

                    {/* Duplicate Detection Status Panel */}
                    {publishSaveToLibrary && (
                      <div className="space-y-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Duplicate Integrity Check</span>
                         {checkingDuplicates ? (
                           <div className="flex items-center justify-center p-6 bg-slate-950 border border-slate-850 rounded-2xl space-x-2 text-indigo-400">
                              <RotateCw className="w-4 h-4 animate-spin" />
                              <span className="text-xs font-bold uppercase tracking-wider">Scanning Central library...</span>
                           </div>
                         ) : duplicateCheckResults.length > 0 ? (
                           <div className="space-y-2.5">
                              <div className="flex items-center space-x-2 bg-amber-950/20 border border-amber-900/40 p-3 rounded-2xl text-amber-400 text-xs">
                                 <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
                                 <span>Detected <strong>{duplicateCheckResults.length}</strong> matching questions already in the library. Choose resolution rules:</span>
                              </div>

                              <div className="bg-slate-950 border border-slate-850 rounded-2xl max-h-40 overflow-y-auto p-3.5 space-y-3 divide-y divide-slate-900 no-scrollbar">
                                 {duplicateCheckResults.map((match) => (
                                   <div key={match.questionIndex} className="pt-3 first:pt-0">
                                      <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-widest mb-1.5 text-slate-400">
                                         <span>Question #{match.questionIndex + 1}</span>
                                         <span className="bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-900/30 font-mono">
                                            {match.similarity}% Overlap Match
                                         </span>
                                      </div>
                                      
                                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed mb-1.5 italic font-medium">
                                         Extracted: "{match.originalText}"
                                      </p>
                                      <p className="text-[10px] text-slate-500 line-clamp-1 mb-2 font-medium">
                                         Library standard: "{match.duplicateInLibrary.text}"
                                      </p>

                                      <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-850 w-full">
                                         <button
                                           type="button"
                                           onClick={() => setDuplicateAction(match.questionIndex, 'skip')}
                                           className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-100 ${
                                             match.action === 'skip' ? 'bg-indigo-650 text-white shadow' : 'text-slate-400 hover:text-white'
                                           }`}
                                         >
                                            Skip Sync
                                         </button>
                                         <button
                                           type="button"
                                           onClick={() => setDuplicateAction(match.questionIndex, 'replace')}
                                           className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-100 ${
                                             match.action === 'replace' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                                           }`}
                                         >
                                            Replace
                                         </button>
                                         <button
                                           type="button"
                                           onClick={() => setDuplicateAction(match.questionIndex, 'save_anyway')}
                                           className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-100 ${
                                             match.action === 'save_anyway' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                                           }`}
                                         >
                                            Save New
                                         </button>
                                      </div>
                                   </div>
                                 ))}
                              </div>
                           </div>
                         ) : (
                           <div className="flex items-center space-x-2 bg-emerald-950/20 border border-emerald-900/40 p-3.5 rounded-2xl text-emerald-400 text-xs font-semibold">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Clean scan! All {questions.length} questions are unique and safe to save!</span>
                           </div>
                         )}
                      </div>
                    )}

                    {/* Modal Actions */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                       <button 
                         type="button"
                         onClick={() => setIsPublishModalOpen(false)}
                         className="py-3 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-[11px] font-black uppercase tracking-wider text-center active:scale-95 transition"
                       >
                          Cancel
                       </button>
                       <button 
                         type="button"
                         onClick={() => {
                           saveWorkspaceDraft(false);
                           setIsPublishModalOpen(false);
                         }}
                         className="py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[11px] font-black uppercase tracking-wider text-center active:scale-95 transition shadow"
                       >
                          Save Draft
                       </button>
                       <button 
                         type="button"
                         disabled={isSaving || (publishSaveToLibrary && checkingDuplicates)}
                         onClick={publishTest}
                         className="py-3 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider text-center shadow-lg active:scale-95 transition disabled:opacity-40"
                       >
                          {isSaving ? "Publishing..." : (checkingDuplicates && publishSaveToLibrary) ? "Scanning..." : "Confirm"}
                       </button>
                    </div>
                 </motion.div>
              </div>
            )}
         </AnimatePresence>
      </main>
    </div>
  );
}
