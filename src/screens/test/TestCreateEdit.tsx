import React, { useState, useEffect } from "react";
import { Test, Question, Batch } from "../../models/mission";
import { TestFolder } from "../../models/testFolder";
import { TestService } from "../../services/test";
import { TestFolderService } from "../../services/testFolder";
import { BatchService } from "../../services/batch";
import { db } from "../../services/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, limit } from "firebase/firestore";
import { sendNotification } from "../../services/notifications";
import {
  X,
  Save,
  Plus,
  Trash2,
  Settings,
  FileText,
  ChevronRight,
  Check,
  Image as ImageIcon,
  Music,
  File,
  Youtube,
  Mic,
  ExternalLink,
  Eye,
  Camera,
  Upload,
  Play,
  Pause,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Database,
  Search,
  RefreshCw,
} from "lucide-react";
import { getQuestions } from "../../services/question";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../providers/AuthProvider";
import TestPreviewScreen from "./TestPreviewScreen";
import MathRenderer from "../../components/MathRenderer";
import MathDiagram from "../../components/MathDiagram";
import { sanitizeQuestionObject, validateTestForPublish } from "../../utils/questionSanitizer";
// import { toast } from 'react-hot-toast'; // Removed to avoid lint error

interface Props {
  testId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function TestCreateEdit({ testId, onClose, onSaved }: Props) {
  const { userProfile } = useAuth();
  const isActualMentor = userProfile?.role === "mentor" || userProfile?.role === "primary-mentor" || userProfile?.role === "admin";
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(!!testId);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState("");
  const [folders, setFolders] = useState<TestFolder[]>([]);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(60);
  const [passingMarks, setPassingMarks] = useState(0);
  const [instructions, setInstructions] = useState("");
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [randomization, setRandomization] = useState(false);
  const [difficulty, setDifficulty] = useState<
    "Easy" | "Medium" | "Hard" | "Expert"
  >("Medium");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [rankVisibility, setRankVisibility] = useState(true);
  const [visibility, setVisibility] = useState<
    "global" | "batch" | "individual"
  >("global");
  const [batchId, setBatchId] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState<
    "draft" | "published" | "live" | "completed" | "scheduled"
  >("draft");
  const [publishMethod, setPublishMethod] = useState<"as-is" | "double-and-jumbled">("as-is");
  const [testType, setTestType] = useState<"free" | "premium">("free");
  const [isFullMockTest, setIsFullMockTest] = useState(false);
  const [mockExamCategory, setMockExamCategory] = useState("SSC CGL");
  const [sections, setSections] = useState<any[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [timingMode, setTimingMode] = useState<"overall" | "section" | "hybrid">("overall");
  const [allowReturn, setAllowReturn] = useState(true);
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>("all");
  const [hasAttempts, setHasAttempts] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Public Shareable Live Test settings
  const [isPublic, setIsPublic] = useState(false);
  const [oneAttemptOnly, setOneAttemptOnly] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [registrationRequired, setRegistrationRequired] = useState(true);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [testPassword, setTestPassword] = useState("");
  const [showResultImmediately, setShowResultImmediately] = useState(true);
  const [showSolutions, setShowSolutions] = useState(true);
  const [enableLeaderboard, setEnableLeaderboard] = useState(true);
  const [shareableId, setShareableId] = useState("");
  const [shareToCommunity, setShareToCommunity] = useState(false);

  const [examName, setExamName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [pdfSharingEnabled, setPdfSharingEnabled] = useState(false);
  const [pdfDownloadType, setPdfDownloadType] = useState<
    "questions" | "keys" | "solutions" | "smart_book"
  >("questions");

  const [questions, setQuestions] = useState<Question[]>([]);

  // Question Library Import States
  const [showLibraryImport, setShowLibraryImport] = useState(false);
  const [libraryQuestions, setLibraryQuestions] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilterSubject, setLibraryFilterSubject] = useState("all");
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);

  const loadLibraryQuestions = async () => {
    setLibraryLoading(true);
    try {
      const qList = await getQuestions();
      setLibraryQuestions(qList);
    } catch (err) {
      console.error("Error loading library questions:", err);
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    if (showLibraryImport) {
      loadLibraryQuestions();
    }
  }, [showLibraryImport]);

  const handleImportSelected = () => {
    const selectedQ = libraryQuestions.filter(q => selectedLibraryIds.includes(q.id));
    if (selectedQ.length === 0) {
      alert("No questions selected");
      return;
    }

    const activeSec = isFullMockTest && activeSectionFilter !== "all" ? sections.find(s => s.id === activeSectionFilter) : null;
    
    const formattedQuestions: Question[] = selectedQ.map(q => {
      let localOptions: any[] = [];
      if (q.options && Array.isArray(q.options)) {
        localOptions = q.options.map((opt: any) => {
          if (typeof opt === 'object' && opt !== null) {
            return opt.text || '';
          }
          return String(opt);
        });
      }

      let localType = q.type;
      if (q.type === 'single_mcq') localType = 'MCQ';
      else if (q.type === 'multiple_mcq') localType = 'MSQ';
      else if (q.type === 'true_false') localType = 'Boolean';
      else if (q.type === 'numerical') localType = 'Integer';

      let localCorrectAnswers: string[] = [];
      if (q.correctAnswer) {
        localCorrectAnswers = String(q.correctAnswer).split(',').map(s => s.trim());
      } else if (q.correctAnswers) {
        localCorrectAnswers = q.correctAnswers;
      } else if (q.options && Array.isArray(q.options)) {
        q.options.forEach((opt: any, idx: number) => {
          if (typeof opt === 'object' && opt !== null && opt.isCorrect) {
            localCorrectAnswers.push(String(idx));
          }
        });
      }

      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        type: (localType as any) || "MCQ",
        text: q.text || "",
        points: activeSec ? (activeSec.marksPerQuestion || 2) : 2,
        negativePoints: activeSec ? (activeSec.negativeMarks || 0.5) : 0.5,
        sectionId: activeSec ? activeSec.id : undefined,
        options: localOptions.length > 0 ? localOptions : ["", "", "", ""],
        correctAnswers: localCorrectAnswers,
        explanation: q.explanation || "",
        attachments: q.attachments || []
      };
    });

    setQuestions([...questions, ...formattedQuestions]);
    setSelectedLibraryIds([]);
    setShowLibraryImport(false);
    setIsDirty(true);
    alert(`Successfully imported ${formattedQuestions.length} questions from Question Library!`);
  };

  useEffect(() => {
    console.log(`[TestCreateEdit] Questions state updated, count: ${questions.length}`);
  }, [questions]);
  const [globalPts, setGlobalPts] = useState(2);
  const [globalNeg, setGlobalNeg] = useState(0.5);

  const [activeTab, setActiveTab] = useState<"details" | "questions">(
    "details",
  );
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [uploading, setUploading] = useState<string | null>(null); // To track which image is being uploaded

  useEffect(() => {
    TestFolderService.getFolders().then((f) => setFolders(f));
    BatchService.getBatches().then((list) => {
      const activeBatches = list.filter((b) => b.status === "active");
      setBatches(activeBatches);
    });

    if (testId) {
      TestService.getTest(testId).then((t) => {
        setTitle(t.title);
        setFolderId(t.folderId || "");
        setCategory(t.category || "");
        setDescription(t.description);
        setSubject(t.subject);
        setDuration(t.duration);
        setPassingMarks(t.passingMarks);
        setInstructions(t.instructions);
        setNegativeMarking(t.negativeMarking);
        setRandomization(t.randomization);
        setDifficulty(t.difficulty || "Medium");
        setTags(t.tags?.join(", ") || "");
        setNotes(t.notes || "");
        setScheduledFor(t.scheduledFor || "");
        setExpiryDate(t.expiryDate || "");
        setRankVisibility(t.rankVisibility ?? true);
        setVisibility(t.visibility);
        setBatchId(t.batchId || "");
        setBatchIds(t.batchIds || (t.batchId ? [t.batchId] : []));
        setStudentId(t.studentId || "");
        setStatus(t.status as any);
        setTestType(t.testType || "free");
        setQuestions(t.questions || []);

        setIsFullMockTest(t.isFullMockTest || false);
        setMockExamCategory(t.mockExamCategory || "SSC CGL");
        setSections(t.sections || []);
        setTimingMode(t.timingMode || "overall");
        setAllowReturn(t.allowReturn ?? true);

        setIsPublic(t.isPublic ?? false);
        setOneAttemptOnly(t.oneAttemptOnly ?? true);
        setMaxAttempts(t.maxAttempts ?? 1);
        setRegistrationRequired(t.registrationRequired ?? true);
        setPasswordProtected(t.passwordProtected ?? false);
        setTestPassword(t.testPassword || "");
        setShowResultImmediately(t.showResultImmediately ?? true);
        setShowSolutions(t.showSolutions ?? true);
        setEnableLeaderboard(t.enableLeaderboard ?? true);
        setShareableId(t.shareableId || "");
        setShareToCommunity(t.shareToCommunity || false);
        setExamName(t.examName || "");
        setChapterName(t.chapterName || "");
        setPdfSharingEnabled(t.pdfSharingEnabled ?? false);
        setPdfDownloadType(t.pdfDownloadType || "questions");

        // Check if there are any attempts for this test
        TestService.getAttemptsForTest(testId).then((atts) => {
          if (atts.length > 0) setHasAttempts(true);
        });

        // Use timeout to ensure states are applied before we start tracking changes
        setTimeout(() => setInitLoading(false), 100);
      });
    }
  }, [testId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const onChange = (fn: any) => (val: any) => {
    fn(val);
    if (!initLoading) setIsDirty(true);
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!title) return alert("Title relates to a test, please provide one.");

    // Format mathematical expressions and sanitize question text properly
    const sanitizedQuestions = questions.map(q => sanitizeQuestionObject(q, status === 'draft'));

    let questionsToPublish = sanitizedQuestions;
    if (status !== 'draft' && publishMethod === 'double-and-jumbled') {
      questionsToPublish = [...sanitizedQuestions, ...sanitizedQuestions]
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
    }

    // Quality Check before publishing/scheduling
    if (status !== "draft") {
      const unverified = questions.filter((q) => !q.isVerified);
      if (unverified.length > 0) {
        return alert(
          `Please verify all ${unverified.length} pending questions before publishing.`,
        );
      }
      if (questions.length === 0) {
        return alert("Cannot publish a test with no questions.");
      }

      // Run publish-grade validation checks on all questions
      const validationResult = validateTestForPublish(sanitizedQuestions);
      if (!validationResult.valid) {
        const firstFailed = validationResult.failedQuestions[0];
        return alert(`Publish Failed! 100% of questions must pass validation to publish.
Total failed questions: ${validationResult.failedQuestions.length}

Example failure at Question #${firstFailed.index + 1}:
${firstFailed.reasons.map(r => "- " + r).join("\n")}

Please fix all validation errors before publishing.`);
      }
    } else {
      // For draft, still reject if any question has an empty or null answer key
      const validationResult = validateTestForPublish(sanitizedQuestions);
      if (!validationResult.valid) {
        const hasMissingAnswerKey = validationResult.failedQuestions.some(fq => 
          fq.reasons.some(r => r.includes("answer key"))
        );
        if (hasMissingAnswerKey) {
          const firstFailed = validationResult.failedQuestions.find(fq => 
            fq.reasons.some(r => r.includes("answer key"))
          );
          return alert(`Save Rejected! No question may be saved if its answer key is missing or empty.
Please check Question #${(firstFailed?.index || 0) + 1}.`);
        }
      }
    }

    setLoading(true);
    try {
      const totalMarks = questionsToPublish.reduce(
        (sum, q) => sum + (Number(q.points) || 0),
        0,
      );

      let finalShareableId = isActualMentor ? shareableId : "";
      if (isActualMentor && isPublic && !finalShareableId) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        finalShareableId = result;
      }

      if (visibility === "batch" && batchIds.length === 0) {
        alert("Selecting at least one Batch is mandatory!");
        setLoading(false);
        return;
      }

      const primaryBatchId = batchIds[0] || "";
      const selectedBatch = batches.find((b) => b.id === primaryBatchId);
      const selectedBatchName = selectedBatch ? selectedBatch.batchName : "";

      const testData: Omit<Test, "id" | "createdAt" | "updatedAt"> = {
        title,
        folderId,
        category,
        description,
        subject,
        duration,
        maximumMarks: totalMarks,
        passingMarks,
        instructions,
        negativeMarking,
        randomization,
        difficulty,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes,
        scheduledFor,
        expiryDate,
        rankVisibility,
        visibility,
        batchId: visibility === "batch" ? primaryBatchId : undefined,
        batchName: visibility === "batch" ? selectedBatchName : undefined,
        batchIds: visibility === "batch" ? batchIds : [],
        studentId: visibility === "individual" ? studentId : undefined,
        status,
        testType,
        questions: questionsToPublish,
        attachments: [],
        createdBy: userProfile!.uid,
        isPublic: isActualMentor ? isPublic : false,
        shareableId: isActualMentor ? (finalShareableId || "") : "",
        oneAttemptOnly,
        maxAttempts: Number(maxAttempts) || 1,
        registrationRequired,
        passwordProtected,
        testPassword: passwordProtected ? testPassword : "",
        showResultImmediately,
        showSolutions,
        enableLeaderboard,
        examName,
        chapterName,
        pdfSharingEnabled,
        pdfDownloadType,
        isFullMockTest,
        mockExamCategory,
        sections,
        timingMode,
        allowReturn,
        shareToCommunity
      };

      let finalTestId = testId;
      if (testId) {
        await TestService.updateTest(testId, testData);
      } else {
        finalTestId = await TestService.createTest(testData);
      }

      if (status === 'published') {
        const q = query(collection(db, 'users'), where('role', '==', 'student'), limit(50));
        const usersSnap = await getDocs(q);
        usersSnap.forEach(user => {
            sendNotification(user.id, userProfile!.uid, 'DailyTest', finalTestId || 'new-test', 'New Daily Test Published', title);
        });
      }

      if (finalTestId) {
          const dtq = query(collection(db, 'dailyTests'), where('testId', '==', finalTestId), limit(5));
          const dtSnap = await getDocs(dtq);
          if (!dtSnap.empty) {
              // Update existing community post with latest details to keep in sync
              dtSnap.forEach(async (docSnap) => {
                  await updateDoc(doc(db, 'dailyTests', docSnap.id), {
                      testName: title,
                      duration: duration,
                      questionCount: questionsToPublish.length
                  });
              });
          }
      }

      setIsDirty(false);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = (type: Question["type"]) => {
    const activeSec = isFullMockTest && activeSectionFilter !== "all" ? sections.find(s => s.id === activeSectionFilter) : null;
    const newQ: Question = {
      id: Date.now().toString(),
      type,
      text: "",
      points: activeSec ? (activeSec.marksPerQuestion || 2) : 2,
      negativePoints: activeSec ? (activeSec.negativeMarks || 0.5) : 0.5,
      sectionId: activeSec ? activeSec.id : undefined,
      options:
        type === "MCQ" || type === "MSQ"
          ? ["", "", "", ""]
          : type === "Boolean"
            ? ["True", "False"]
            : undefined,
      correctAnswers: [],
      explanation: "",
      attachments: [],
    };
    setQuestions([...questions, newQ]);
    setEditingQuestionId(newQ.id);
    setActiveTab("questions");
    setIsDirty(true);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    );
    setIsDirty(true);
  };

  const handleImageUpload = async (qId: string, file: File) => {
    try {
      setUploading(qId);
      const url = await TestService.uploadQuestionImage(file);
      const q = questions.find((qu) => qu.id === qId);
      if (q) {
        const currentUrls = q.imageUrls || (q.imageUrl ? [q.imageUrl] : []);
        updateQuestion(qId, {
          imageUrls: [...currentUrls, url],
          imageUrl: url,
        });
      }
    } catch (e) {
      console.error(e);
      alert("Failed to upload image");
    } finally {
      setUploading(null);
    }
  };

  const removeQuestionImage = (qId: string, index: number) => {
    const q = questions.find((qu) => qu.id === qId);
    if (!q) return;
    const currentUrls = [...(q.imageUrls || [])];
    currentUrls.splice(index, 1);
    updateQuestion(qId, {
      imageUrls: currentUrls,
      imageUrl: currentUrls[0] || "",
    });
  };

  const handleSolutionMediaUpload = async (
    qId: string,
    file: File,
    type: "image" | "pdf" | "audio",
  ) => {
    try {
      setUploading(`${qId}-${type}`);
      const url = await TestService.uploadSolutionMedia(file, type);
      const q = questions.find((qu) => qu.id === qId);
      if (q) {
        const solution = q.solution || {};
        if (type === "image") {
          const currentImages = solution.images || [];
          updateQuestion(qId, {
            solution: { ...solution, images: [...currentImages, url] },
          });
        } else if (type === "pdf") {
          updateQuestion(qId, {
            solution: { ...solution, pdfUrl: url, pdfName: file.name },
          });
        } else if (type === "audio") {
          updateQuestion(qId, {
            solution: { ...solution, audioUrl: url, audioName: file.name },
          });
        }
      }
    } catch (e) {
      console.error(e);
      alert(`Failed to upload ${type}`);
    } finally {
      setUploading(null);
    }
  };

  const removeSolutionImage = (qId: string, index: number) => {
    const q = questions.find((qu) => qu.id === qId);
    if (!q || !q.solution || !q.solution.images) return;
    const currentImages = [...q.solution.images];
    currentImages.splice(index, 1);
    updateQuestion(qId, { solution: { ...q.solution, images: currentImages } });
  };

  if (initLoading)
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        Loading...
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col pt-[env(safe-area-inset-top)]"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCloseAttempt}
            className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 truncate">
              {testId ? "Edit Test" : "Create Test"}
            </h3>
            {hasAttempts && (
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded uppercase tracking-tighter inline-block whitespace-nowrap">
                🔒 Structure Locked
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center space-x-1 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className="flex items-center space-x-1 bg-primary-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-primary-500 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>
      </div>

      <div className="bg-white px-4 border-b border-slate-200 flex space-x-6">
        <button
          onClick={() => setActiveTab("details")}
          className={`py-3 relative text-sm font-medium transition-colors ${activeTab === "details" ? "text-primary-600" : "text-slate-500"}`}
        >
          Configuration
          {activeTab === "details" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("questions")}
          className={`py-3 relative text-sm font-medium transition-colors flex items-center space-x-1 ${activeTab === "questions" ? "text-primary-600" : "text-slate-500"}`}
        >
          <span>Questions</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded-md ${questions.filter((q) => !q.isVerified).length > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
          >
            {questions.filter((q) => q.isVerified).length}/{questions.length}{" "}
            Verified
          </span>
          {activeTab === "questions" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t-full" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "details" ? (
          <div className="space-y-6 max-w-lg mx-auto">
            {/* Test Creator Mode Choice */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Test Creator Mode
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFullMockTest(false)}
                  className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                    !isFullMockTest
                      ? "bg-primary-50 text-primary-700 border-primary-200 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  📝 Normal Test
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFullMockTest(true);
                    if (sections.length === 0) {
                      setSections([
                        { id: "s1", name: "General Intelligence & Reasoning", questionCount: 25, marksPerQuestion: 2, negativeMarks: 0.5, randomizeQuestions: true, randomizeOptions: true, lockPrevious: false, allowReview: true, showInstructions: true },
                        { id: "s2", name: "General Awareness", questionCount: 25, marksPerQuestion: 2, negativeMarks: 0.5, randomizeQuestions: true, randomizeOptions: true, lockPrevious: false, allowReview: true, showInstructions: true },
                        { id: "s3", name: "Quantitative Aptitude", questionCount: 25, marksPerQuestion: 2, negativeMarks: 0.5, randomizeQuestions: true, randomizeOptions: true, lockPrevious: false, allowReview: true, showInstructions: true },
                        { id: "s4", name: "English Comprehension", questionCount: 25, marksPerQuestion: 2, negativeMarks: 0.5, randomizeQuestions: true, randomizeOptions: true, lockPrevious: false, allowReview: true, showInstructions: true },
                      ]);
                    }
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                    isFullMockTest
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm ring-1 ring-indigo-200"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  🏆 Full Mock Test ⭐
                </button>
              </div>
            </div>

            {isFullMockTest && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Mock Exam Category
                  </label>
                  <select
                    value={mockExamCategory}
                    onChange={(e) => setMockExamCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white font-semibold text-slate-800"
                  >
                    <option value="SSC CGL">SSC CGL</option>
                    <option value="SSC CHSL">SSC CHSL</option>
                    <option value="SSC MTS">SSC MTS</option>
                    <option value="Railway">Railway</option>
                    <option value="Police">Police</option>
                    <option value="West Bengal Jobs">West Bengal Jobs</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>
            )}

            {isFullMockTest && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-indigo-900 font-sans text-base">
                    Section Builder ({sections.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const newSec = {
                        id: `sec-${Date.now()}`,
                        name: `Section ${sections.length + 1}`,
                        questionCount: 25,
                        marksPerQuestion: 2,
                        negativeMarks: 0.5,
                        instructions: "",
                        timeLimit: undefined,
                        randomizeQuestions: true,
                        randomizeOptions: true,
                        lockPrevious: false,
                        allowReview: true,
                        showInstructions: true
                      };
                      setSections([...sections, newSec]);
                    }}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Add Section
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {sections.map((sec, index) => (
                    <div
                      key={sec.id}
                      draggable
                      onDragStart={() => setDraggingIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggingIndex !== null && draggingIndex !== index) {
                          const nextSecs = [...sections];
                          const [moved] = nextSecs.splice(draggingIndex, 1);
                          nextSecs.splice(index, 0, moved);
                          setSections(nextSecs);
                        }
                        setDraggingIndex(null);
                      }}
                      onDragEnd={() => setDraggingIndex(null)}
                      className={`p-4 rounded-xl border space-y-3 transition-all cursor-move ${
                        draggingIndex === index ? "opacity-40 border-indigo-400 bg-indigo-50/20 shadow-inner" : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400">Section #{index + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              const nextSecs = [...sections];
                              const temp = nextSecs[index];
                              nextSecs[index] = nextSecs[index - 1];
                              nextSecs[index - 1] = temp;
                              setSections(nextSecs);
                            }}
                            className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={index === sections.length - 1}
                            onClick={() => {
                              const nextSecs = [...sections];
                              const temp = nextSecs[index];
                              nextSecs[index] = nextSecs[index + 1];
                              nextSecs[index + 1] = temp;
                              setSections(nextSecs);
                            }}
                            className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const dup = {
                                ...sec,
                                id: `sec-${Date.now()}`,
                                name: `${sec.name} (Copy)`
                              };
                              const nextSecs = [...sections];
                              nextSecs.splice(index + 1, 0, dup);
                              setSections(nextSecs);
                            }}
                            className="p-1 rounded bg-white border border-slate-200 text-amber-600 hover:bg-amber-50 text-xs font-bold px-1.5"
                            title="Duplicate"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${sec.name}"?`)) {
                                setSections(sections.filter(s => s.id !== sec.id));
                              }
                            }}
                            className="p-1 rounded bg-white border border-slate-200 text-red-600 hover:bg-red-50 text-xs font-bold px-1.5"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={sec.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSections(sections.map(s => s.id === sec.id ? { ...s, name: val } : s));
                          }}
                          placeholder="Section Name"
                          className="w-full border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Q Count</label>
                          <input
                            type="number"
                            value={sec.questionCount}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setSections(sections.map(s => s.id === sec.id ? { ...s, questionCount: val } : s));
                            }}
                            className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Points/Q</label>
                          <input
                            type="number"
                            value={sec.marksPerQuestion}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setSections(sections.map(s => s.id === sec.id ? { ...s, marksPerQuestion: val } : s));
                            }}
                            className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Neg Marks</label>
                          <input
                            type="number"
                            value={sec.negativeMarks}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setSections(sections.map(s => s.id === sec.id ? { ...s, negativeMarks: val } : s));
                            }}
                            className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Time (mins, opt)</label>
                          <input
                            type="number"
                            placeholder="Optional"
                            value={sec.timeLimit || ""}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : undefined;
                              setSections(sections.map(s => s.id === sec.id ? { ...s, timeLimit: val } : s));
                            }}
                            className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs"
                          />
                        </div>
                        <div className="flex flex-col justify-end space-y-1">
                          <label className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sec.randomizeQuestions ?? true}
                              onChange={(e) => {
                                setSections(sections.map(s => s.id === sec.id ? { ...s, randomizeQuestions: e.target.checked } : s));
                              }}
                              className="rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                            />
                            <span>Rand Qs</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sec.randomizeOptions ?? true}
                              onChange={(e) => {
                                setSections(sections.map(s => s.id === sec.id ? { ...s, randomizeOptions: e.target.checked } : s));
                              }}
                              className="rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                            />
                            <span>Rand Opts</span>
                          </label>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1.5">
                        <label className="flex items-center gap-1 text-[9px] text-slate-500 font-bold uppercase cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sec.lockPrevious ?? false}
                            onChange={(e) => {
                              setSections(sections.map(s => s.id === sec.id ? { ...s, lockPrevious: e.target.checked } : s));
                            }}
                            className="rounded text-primary-600 border-slate-300"
                          />
                          <span>Lock Prev</span>
                        </label>
                        <label className="flex items-center gap-1 text-[9px] text-slate-500 font-bold uppercase cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sec.allowReview ?? true}
                            onChange={(e) => {
                              setSections(sections.map(s => s.id === sec.id ? { ...s, allowReview: e.target.checked } : s));
                            }}
                            className="rounded text-primary-600 border-slate-300"
                          />
                          <span>Allow Rev</span>
                        </label>
                        <label className="flex items-center gap-1 text-[9px] text-slate-500 font-bold uppercase cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sec.showInstructions ?? true}
                            onChange={(e) => {
                              setSections(sections.map(s => s.id === sec.id ? { ...s, showInstructions: e.target.checked } : s));
                            }}
                            className="rounded text-primary-600 border-slate-300"
                          />
                          <span>Show Instr</span>
                        </label>
                      </div>

                      <div>
                        <textarea
                          rows={1}
                          placeholder="Section Specific Instructions..."
                          value={sec.instructions || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSections(sections.map(s => s.id === sec.id ? { ...s, instructions: val } : s));
                          }}
                          className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs resize-none"
                        />
                      </div>
                    </div>
                  ))}
                  {sections.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No sections added yet. Click "+ Add Section" to build your mock test sections.</p>
                  )}
                </div>
              </div>
            )}

            {isFullMockTest && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <h4 className="font-bold text-slate-900 font-sans text-base">
                  TIMING MODE
                </h4>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="timingMode"
                      value="overall"
                      checked={timingMode === "overall"}
                      onChange={() => setTimingMode("overall")}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-800">Mode 1: Overall Timer</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">Students get one single timer (e.g. 60 Minutes) and can freely move between sections.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="timingMode"
                      value="section"
                      checked={timingMode === "section"}
                      onChange={() => setTimingMode("section")}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-800">Mode 2: Section-wise Timer</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">Each section has its own dedicated timer. Moving to next section happens automatically when it finishes.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="timingMode"
                      value="hybrid"
                      checked={timingMode === "hybrid"}
                      onChange={() => setTimingMode("hybrid")}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-800">Mode 3: Hybrid Mode</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">Overall timer is active, but sections have recommended limits. Students can still switch sections.</p>
                    </div>
                  </label>
                </div>

                {timingMode === "section" && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Allow Return to Previous Sections?</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAllowReturn(true)}
                          className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                            allowReturn ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          YES
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllowReturn(false)}
                          className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                            !allowReturn ? "bg-red-100 text-red-800 border-red-200" : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          NO
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => onChange(setTitle)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="e.g., Weekly Mock Test"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => onChange(setSubject)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="e.g., Physics"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Exam Name
                </label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => onChange(setExamName)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="e.g., SSC CGL 2027"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Chapter / Topic
                </label>
                <input
                  type="text"
                  value={chapterName}
                  onChange={(e) => onChange(setChapterName)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="e.g., Trigonometry"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Folder / Category
                </label>
                <select
                  value={folderId}
                  onChange={(e) => onChange(setFolderId)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                >
                  <option value="">Uncategorized</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.icon} {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => onChange(setDescription)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                  placeholder="..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Instructions
                </label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => onChange(setInstructions)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                  placeholder="Read carefully before starting..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Mentor Notes (Private)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => onChange(setNotes)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                  placeholder="Private notes for mentors..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => onChange(setTags)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm"
                  placeholder="e.g. SSC, GS, Static, Important"
                />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h4 className="font-bold text-slate-900 font-sans text-base">
                TEST TYPE
              </h4>
              <div className="flex gap-2">
                <button 
                    onClick={(e) => { e.preventDefault(); onChange(setTestType)('free'); }}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        testType === 'free'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}
                >
                    🟢 Free Test
                </button>
                <button 
                    onClick={(e) => { e.preventDefault(); onChange(setTestType)('premium'); }}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        testType === 'premium'
                            ? 'bg-amber-50 text-amber-600 border-amber-200'
                            : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}
                >
                    ⭐ Premium Test
                </button>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 font-mono text-xs">
              <h4 className="font-bold text-slate-900 mb-2 font-sans text-base">
                Parameters
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) =>
                      onChange(setDuration)(Number(e.target.value))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Passing Marks
                  </label>
                  <input
                    type="number"
                    value={passingMarks}
                    onChange={(e) =>
                      onChange(setPassingMarks)(Number(e.target.value))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      onChange(setDifficulty)(e.target.value as any)
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => onChange(setStatus)(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                    <option value="live">Live</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Publishing Method
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="as-is"
                      checked={publishMethod === "as-is"}
                      onChange={() => setPublishMethod("as-is")}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">As it is</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="double-and-jumbled"
                      checked={publishMethod === "double-and-jumbled"}
                      onChange={() => setPublishMethod("double-and-jumbled")}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">Double and jumbled</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Scheduled For (Start)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => onChange(setScheduledFor)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Expiry Date (End)
                </label>
                <input
                  type="datetime-local"
                  value={expiryDate}
                  onChange={(e) => onChange(setExpiryDate)(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) =>
                    onChange(setVisibility)(e.target.value as any)
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                >
                  <option value="global">Global</option>
                  <option value="batch">Batch</option>
                  <option value="individual">Individual</option>
                </select>
              </div>

              {visibility === "batch" && (
                <div className="pt-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                      Linked Batches <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBatchIds(batches.map(b => b.id))}
                        className="text-[10px] font-semibold text-primary-600 hover:text-primary-700"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300 text-[10px]">|</span>
                      <button
                        type="button"
                        onClick={() => setBatchIds([])}
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-600"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 max-h-48 overflow-y-auto space-y-2">
                    {batches.map((b) => {
                      const isChecked = batchIds.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-start gap-2.5 cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            className="mt-1 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBatchIds([...batchIds, b.id]);
                              } else {
                                setBatchIds(batchIds.filter((id) => id !== b.id));
                              }
                            }}
                          />
                          <div className="text-sm">
                            <span className="font-medium text-slate-900">{b.batchName}</span>
                            <span className="text-xs text-slate-500 ml-1.5 font-mono">({b.batchCode})</span>
                          </div>
                        </label>
                      );
                    })}
                    {batches.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">No active batches available.</p>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
"Only students in the selected batches will be able to view and attempt this test."
                  </p>
                </div>
              )}



              {/* Public Shareable Test Settings */}
              {isActualMentor && (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Public Shareable Test
                    </h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Allow anyone with a secure link to participate.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isPublic}
                      onChange={(e) => { onChange(setIsPublic)(e.target.checked); if (e.target.checked && !shareableId) { const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let result = ""; for (let i = 0; i < 12; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); } setShareableId(result); } }}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                {isPublic && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/50 mt-2"
                  >
                    {shareableId && (
                      <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                        <label className="block text-[9px] font-black text-indigo-700 uppercase tracking-wider mb-1">
                          Secure Shareable Link
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/live/${shareableId}`}
                            className="flex-1 bg-white border border-indigo-200/60 rounded-lg px-2.5 py-1.5 text-xs text-indigo-950 font-mono outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/live/${shareableId}`);
                              alert(testId ? "Share link copied to clipboard!" : "Share link copied! Please SAVE the test to activate it.");
                            }}
                            className="px-2.5 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-[9px] text-amber-600 font-bold mt-1.5 px-1">
                          ⚠️ Click Save at the top to activate this link.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between col-span-2 py-1 border-b border-slate-200/60">
                        <span className="text-xs font-semibold text-slate-700">One Attempt Only</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={oneAttemptOnly}
                            onChange={(e) => {
                              onChange(setOneAttemptOnly)(e.target.checked);
                              if (e.target.checked) setMaxAttempts(1);
                            }}
                          />
                          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      {!oneAttemptOnly && (
                        <div className="col-span-2">
                          <label className="block text-[10px] font-medium text-slate-600 mb-1">
                            Maximum Attempts Allowed
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={maxAttempts}
                            onChange={(e) => onChange(setMaxAttempts)(Number(e.target.value))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between col-span-2 py-1 border-b border-slate-200/60">
                        <span className="text-xs font-semibold text-slate-700">Registration Required</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={registrationRequired}
                            onChange={(e) => onChange(setRegistrationRequired)(e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between col-span-2 py-1 border-b border-slate-200/60">
                        <span className="text-xs font-semibold text-slate-700">Password Protected</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={passwordProtected}
                            onChange={(e) => onChange(setPasswordProtected)(e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      {passwordProtected && (
                        <div className="col-span-2">
                          <label className="block text-[10px] font-medium text-slate-600 mb-1">
                            Test Password
                          </label>
                          <input
                            type="text"
                            value={testPassword}
                            onChange={(e) => onChange(setTestPassword)(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white"
                            placeholder="Enter password key"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between col-span-2 py-1 border-b border-slate-200/60">
                        <span className="text-xs font-semibold text-slate-700">Show Result Immediately</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={showResultImmediately}
                            onChange={(e) => onChange(setShowResultImmediately)(e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between col-span-2 py-1 border-b border-slate-200/60">
                        <span className="text-xs font-semibold text-slate-700">Show Solutions / Explanations</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={showSolutions}
                            onChange={(e) => onChange(setShowSolutions)(e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between col-span-2 py-1">
                        <span className="text-xs font-semibold text-slate-700">Enable Live Leaderboard</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={enableLeaderboard}
                            onChange={(e) => onChange(setEnableLeaderboard)(e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium text-slate-700">
                  Rank Visibility
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={rankVisibility}
                    onChange={(e) =>
                      onChange(setRankVisibility)(e.target.checked)
                    }
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium text-slate-700">
                  Negative Marking
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={negativeMarking}
                    onChange={(e) =>
                      onChange(setNegativeMarking)(e.target.checked)
                    }
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium text-slate-700">
                  Randomize Questions
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={randomization}
                    onChange={(e) =>
                      onChange(setRandomization)(e.target.checked)
                    }
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-700 block">
                      Enable PDF Download for Students
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Allow student profiles to download/print the PDF test.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={pdfSharingEnabled}
                      onChange={(e) =>
                        onChange(setPdfSharingEnabled)(e.target.checked)
                      }
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                {pdfSharingEnabled && (
                  <div className="mt-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-150">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Allowed PDF Format for Students
                    </label>
                    <select
                      value={pdfDownloadType}
                      onChange={(e) => onChange(setPdfDownloadType)(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white font-semibold text-slate-800"
                    >
                      <option value="questions">QUESTION PAPER</option>
                      <option value="smart_book">MISSIONGRID SMART STUDY BOOK ⭐</option>
                    </select>
                    <p className="text-[9px] text-slate-400 mt-1">
                      Determine which PDF type students can view and download.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Global Question Config
                </h5>
                <p className="text-[10px] text-slate-400">
                  Set these values for all existing questions in this test.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-1">
                      Points/Correct
                    </label>
                    <input
                      disabled={
                        hasAttempts &&
                        !["mentor", "primary-mentor", "admin"].includes(
                          userProfile?.role || "",
                        )
                      }
                      type="number"
                      step="0.5"
                      value={globalPts}
                      onChange={(e) => setGlobalPts(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm disabled:opacity-50"
                      placeholder="e.g. 2"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-1">
                      Neg Points
                    </label>
                    <input
                      disabled={
                        hasAttempts &&
                        !["mentor", "primary-mentor", "admin"].includes(
                          userProfile?.role || "",
                        )
                      }
                      type="number"
                      step="0.25"
                      value={globalNeg}
                      onChange={(e) => setGlobalNeg(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm disabled:opacity-50"
                      placeholder="e.g. 0.5"
                    />
                  </div>
                </div>
                <button
                  disabled={
                    hasAttempts &&
                    !["mentor", "primary-mentor", "admin"].includes(
                      userProfile?.role || "",
                    )
                  }
                  onClick={() => {
                    const pts = globalPts || 2;
                    const neg = globalNeg || 0;
                    console.log(`[ApplyToAll] Applying pts: ${pts}, neg: ${neg} to ${questions.length} questions`);
                    setQuestions((prev) =>
                      prev.map((q) => {
                        const updated = {
                          ...q,
                          points: pts,
                          negativePoints: neg,
                        };
                        console.log(`[ApplyToAll] Updating q ${q.id}: points=${updated.points}, negativePoints=${updated.negativePoints}`);
                        return updated;
                      }),
                    );
                    setIsDirty(true);
                    alert(
                      `Updated ${questions.length} questions to +${pts} / -${neg}`,
                    );
                  }}
                  className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  Apply to All {questions.length} Questions
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-4 pb-20">
            {/* Quality Check Summary Dashboard */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Quality Check & Stats
                </h4>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  Quality Score:{" "}
                  {Math.round(
                    (questions.filter((q) => q.isVerified).length /
                      (questions.length || 1)) *
                      100,
                  )}
                  %
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 p-2 rounded-xl text-center">
                  <div className="text-sm font-bold text-slate-900">
                    {questions.length}
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase font-black">
                    Generated
                  </div>
                </div>
                <div className="bg-amber-50 p-2 rounded-xl text-center">
                  <div className="text-sm font-bold text-amber-600">
                    {
                      questions.filter(
                        (q) =>
                          !q.correctAnswers || q.correctAnswers.length === 0,
                      ).length
                    }
                  </div>
                  <div className="text-[9px] text-amber-500 uppercase font-black text-amber-500">
                    Missing Ans
                  </div>
                </div>
                <div className="bg-rose-50 p-2 rounded-xl text-center">
                  <div className="text-sm font-bold text-rose-600">
                    {
                      questions.filter(
                        (q, i) =>
                          questions.findIndex((t) => t.text === q.text) !== i,
                      ).length
                    }
                  </div>
                  <div className="text-[9px] text-rose-500 uppercase font-black text-rose-500">
                    Duplicates
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 p-2 rounded-xl text-center">
                  <div className="text-sm font-bold text-blue-600">
                    {
                      questions.filter(
                        (q) =>
                          !q.solution ||
                          (!q.solution.text?.detailed && !q.explanation),
                      ).length
                    }
                  </div>
                  <div className="text-[9px] text-blue-500 uppercase font-black text-blue-500">
                    Missing Sol
                  </div>
                </div>
                <div className="bg-emerald-50 p-2 rounded-xl text-center">
                  <div className="text-sm font-bold text-emerald-600">
                    {questions.filter((q) => q.isVerified).length}
                  </div>
                  <div className="text-[9px] text-emerald-500 uppercase font-black text-emerald-600">
                    Verified
                  </div>
                </div>
                <div className="bg-slate-100 p-2 rounded-xl text-center">
                  <div className="text-sm font-bold text-slate-600">
                    {questions.filter((q) => !q.topic).length}
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase font-black">
                    Untagged
                  </div>
                </div>
              </div>

              {questions.filter((q) => !q.isVerified).length > 0 && (
                <div className="bg-amber-50 p-2 border border-amber-100 rounded-xl flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-[10px] text-amber-700 font-medium leading-tight">
                    Publishing is blocked until all questions are verified by a
                    mentor. {questions.filter((q) => !q.isVerified).length}{" "}
                    questions pending.
                  </p>
                </div>
              )}
            </div>

            {isFullMockTest && sections.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4 p-2 bg-slate-50 rounded-2xl border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setActiveSectionFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeSectionFilter === "all"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/60 hover:bg-slate-100"
                  }`}
                >
                  All Questions ({questions.length})
                </button>
                {sections.map((s) => {
                  const count = questions.filter((qu) => qu.sectionId === s.id).length;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSectionFilter(s.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeSectionFilter === s.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white text-slate-600 border border-slate-200/60 hover:bg-slate-100"
                      }`}
                    >
                      <span>{s.name}</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${activeSectionFilter === s.id ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {count}/{s.questionCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {questions
              .filter((q) => activeSectionFilter === "all" || q.sectionId === activeSectionFilter)
              .map((q, idx) => (
              <div
                key={`${q.id || 'q'}-${idx}`}
                className={`bg-white rounded-2xl shadow-sm border ${editingQuestionId === q.id ? "border-primary-500 ring-1 ring-primary-500" : "border-slate-100"}`}
              >
                {editingQuestionId === q.id ? (
                  <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-md uppercase">
                          {q.type}
                        </span>
                        {q.isVerified ? (
                          <span className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
                            <Check className="w-3 h-3 mr-0.5" /> Verified
                          </span>
                        ) : (
                          <span className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">
                            Pending Review
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setEditingQuestionId(null)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </div>

                     {isFullMockTest && (
                      <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mb-2">
                        <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">
                          Assigned Section ⭐
                        </label>
                        <select
                          value={q.sectionId || ""}
                          onChange={(e) => {
                            const secId = e.target.value;
                            const associatedSec = sections.find(s => s.id === secId);
                            updateQuestion(q.id, { 
                              sectionId: secId,
                              points: associatedSec ? (associatedSec.marksPerQuestion || q.points) : q.points,
                              negativePoints: associatedSec ? (associatedSec.negativeMarks || q.negativePoints) : q.negativePoints
                            });
                          }}
                          className="w-full border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">-- Choose Section --</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.questionCount} Qs, {s.marksPerQuestion} Marks)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Topic Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Percentage"
                          value={q.topic || ""}
                          onChange={(e) =>
                            updateQuestion(q.id, { topic: e.target.value })
                          }
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Question Difficulty
                        </label>
                        <select
                          value={q.difficulty || "Medium"}
                          onChange={(e) =>
                            updateQuestion(q.id, {
                              difficulty: e.target.value as any,
                            })
                          }
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                          <option value="Expert">Expert</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                      <input
                        type="checkbox"
                        id={`verified-${q.id}`}
                        checked={q.isVerified || false}
                        onChange={(e) =>
                          updateQuestion(q.id, { isVerified: e.target.checked })
                        }
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-emerald-300"
                      />
                      <label
                        htmlFor={`verified-${q.id}`}
                        className="text-xs font-bold text-emerald-700"
                      >
                        Solution & Content Verified by Mentor
                      </label>
                    </div>

                    <div>
                      <textarea
                        placeholder="Question text..."
                        value={q.text}
                        onChange={(e) =>
                          updateQuestion(q.id, { text: e.target.value })
                        }
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none min-h-[80px] resize-none"
                      />
                      {q.text && q.text.includes("$") && (
                        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm overflow-x-auto">
                          <MathRenderer content={q.text} formula_latex={q.formula_latex} />
                        </div>
                      )}
                    </div>

                    {/* Question Images */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase">
                        Question Images
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(q.imageUrls || (q.imageUrl ? [q.imageUrl] : [])).map(
                          (url, i) => (
                            <div key={i} className="relative group w-20 h-20">
                              <img
                                src={url}
                                className="w-full h-full object-cover rounded-lg border border-slate-200"
                                referrerPolicy="no-referrer"
                              />
                              <button
                                onClick={() => removeQuestionImage(q.id, i)}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ),
                        )}
                        <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-primary-400 transition-colors">
                          <Camera className="w-5 h-5 text-slate-400" />
                          <span className="text-[10px] text-slate-500 mt-1">
                            Add Image
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) =>
                              e.target.files?.[0] &&
                              handleImageUpload(q.id, e.target.files[0])
                            }
                          />
                        </label>
                        {uploading === q.id && (
                          <div className="w-20 h-20 flex items-center justify-center bg-slate-100 rounded-lg">
                            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>

                    {negativeMarking && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Points
                          </label>
                          <input
                            type="number"
                            value={q.points}
                            onChange={(e) =>
                              updateQuestion(q.id, {
                                points: Number(e.target.value),
                              })
                            }
                            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            -ve Points
                          </label>
                          <input
                            type="number"
                            value={q.negativePoints}
                            onChange={(e) =>
                              updateQuestion(q.id, {
                                negativePoints: Number(e.target.value),
                              })
                            }
                            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {!negativeMarking && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Points
                        </label>
                        <input
                          type="number"
                          value={q.points}
                          onChange={(e) =>
                            updateQuestion(q.id, {
                              points: Number(e.target.value),
                            })
                          }
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                    )}

                    {/* Multimedia Solution */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Multimedia Solution
                        </label>
                        <div className="flex items-center space-x-1">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] text-slate-400">
                            Detailed explanation & media
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Short Explanation
                          </label>
                          <textarea
                            rows={1}
                            placeholder="Quick summary..."
                            value={q.solution?.text?.short || ""}
                            onChange={(e) =>
                              updateQuestion(q.id, {
                                solution: {
                                  ...q.solution,
                                  text: {
                                    ...q.solution?.text,
                                    short: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                          />
                          {q.solution?.text?.short && q.solution.text.short.includes("$") && (
                            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm overflow-x-auto">
                              <MathRenderer content={q.solution.text.short} />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Detailed Explanation
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Step by step solution..."
                            value={q.solution?.text?.detailed || ""}
                            onChange={(e) =>
                              updateQuestion(q.id, {
                                solution: {
                                  ...q.solution,
                                  text: {
                                    ...q.solution?.text,
                                    detailed: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                          />
                          {q.solution?.text?.detailed && q.solution.text.detailed.includes("$") && (
                            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm overflow-x-auto">
                              <MathRenderer content={q.solution.text.detailed} />
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              Tips
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Tricks..."
                              value={q.solution?.text?.tips || ""}
                              onChange={(e) =>
                                updateQuestion(q.id, {
                                  solution: {
                                    ...q.solution,
                                    text: {
                                      ...q.solution?.text,
                                      tips: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              Common Mistakes
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Watch out for..."
                              value={q.solution?.text?.mistakes || ""}
                              onChange={(e) =>
                                updateQuestion(q.id, {
                                  solution: {
                                    ...q.solution,
                                    text: {
                                      ...q.solution?.text,
                                      mistakes: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                            />
                          </div>
                        </div>

                        {/* Solution Media */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Image Solutions */}
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">
                              Solution Images
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {q.solution?.images?.map((url, i) => (
                                <div
                                  key={i}
                                  className="relative group w-12 h-12"
                                >
                                  <img
                                    src={url}
                                    className="w-full h-full object-cover rounded border border-slate-200"
                                    referrerPolicy="no-referrer"
                                  />
                                  <button
                                    onClick={() => removeSolutionImage(q.id, i)}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-2 h-2" />
                                  </button>
                                </div>
                              ))}
                              <label className="w-12 h-12 flex items-center justify-center border border-dashed border-slate-200 rounded cursor-pointer hover:bg-slate-50 transition-colors">
                                <Plus className="w-4 h-4 text-slate-400" />
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) =>
                                    e.target.files?.[0] &&
                                    handleSolutionMediaUpload(
                                      q.id,
                                      e.target.files[0],
                                      "image",
                                    )
                                  }
                                />
                              </label>
                            </div>
                          </div>

                          {/* YouTube Link */}
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase flex items-center">
                              <Youtube className="w-3 h-3 mr-1 text-red-500" />{" "}
                              YouTube Video
                            </label>
                            <input
                              type="text"
                              placeholder="URL..."
                              value={q.solution?.youtubeUrl || ""}
                              onChange={(e) =>
                                updateQuestion(q.id, {
                                  solution: {
                                    ...q.solution,
                                    youtubeUrl: e.target.value,
                                  },
                                })
                              }
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* PDF Solution */}
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase flex items-center">
                              <File className="w-3 h-3 mr-1 text-blue-500" />{" "}
                              Solution PDF
                            </label>
                            {q.solution?.pdfUrl ? (
                              <div className="flex items-center justify-between text-xs bg-blue-50 text-blue-700 px-2 py-1.5 rounded-lg border border-blue-100 group">
                                <span className="truncate max-w-[100px]">
                                  {q.solution.pdfName || "Solution.pdf"}
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuestion(q.id, {
                                      solution: {
                                        ...q.solution,
                                        pdfUrl: "",
                                        pdfName: "",
                                      },
                                    })
                                  }
                                  className="p-0.5 opacity-0 group-hover:opacity-100"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center justify-center border border-dashed border-slate-200 rounded-lg p-2 cursor-pointer hover:bg-slate-50 transition-colors">
                                <Upload className="w-3 h-3 text-slate-400 mr-1" />
                                <span className="text-[10px] font-medium text-slate-500">
                                  Upload PDF
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf"
                                  onChange={(e) =>
                                    e.target.files?.[0] &&
                                    handleSolutionMediaUpload(
                                      q.id,
                                      e.target.files[0],
                                      "pdf",
                                    )
                                  }
                                />
                              </label>
                            )}
                          </div>

                          {/* Audio Solution */}
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase flex items-center">
                              <Mic className="w-3 h-3 mr-1 text-emerald-500" />{" "}
                              Voice Solution
                            </label>
                            {q.solution?.audioUrl ? (
                              <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg border border-emerald-100 group">
                                <span className="truncate max-w-[100px]">
                                  {q.solution.audioName || "Audio.mp3"}
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuestion(q.id, {
                                      solution: {
                                        ...q.solution,
                                        audioUrl: "",
                                        audioName: "",
                                      },
                                    })
                                  }
                                  className="p-0.5 opacity-0 group-hover:opacity-100"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center justify-center border border-dashed border-slate-200 rounded-lg p-2 cursor-pointer hover:bg-slate-50 transition-colors">
                                <Upload className="w-3 h-3 text-slate-400 mr-1" />
                                <span className="text-[10px] font-medium text-slate-500">
                                  Upload Audio
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="audio/*"
                                  onChange={(e) =>
                                    e.target.files?.[0] &&
                                    handleSolutionMediaUpload(
                                      q.id,
                                      e.target.files[0],
                                      "audio",
                                    )
                                  }
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase flex items-center">
                        <Lightbulb className="w-3.5 h-3.5 mr-1 text-amber-500" />{" "}
                        Legacy Explanation
                      </label>
                      <textarea
                        placeholder="Quick explanation..."
                        value={q.explanation || ""}
                        onChange={(e) =>
                          updateQuestion(q.id, { explanation: e.target.value })
                        }
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none h-20 resize-none"
                      />
                      {q.explanation && q.explanation.includes("$") && (
                        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm overflow-x-auto">
                          <MathRenderer content={q.explanation} />
                        </div>
                      )}
                    </div>

                    {(q.type === "MCQ" ||
                      q.type === "MSQ" ||
                      q.type === "Boolean") &&
                      q.options && (
                        <div className="space-y-2 mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                            Options
                          </label>
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-2">
                                {q.type === "MCQ" ? (
                                  <input
                                    type="radio"
                                    name={`correct-${q.id}`}
                                    checked={q.correctAnswers?.includes(
                                      optIdx.toString(),
                                    )}
                                    onChange={() =>
                                      updateQuestion(q.id, {
                                        correctAnswers: [optIdx.toString()],
                                      })
                                    }
                                  />
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={q.correctAnswers?.includes(
                                      optIdx.toString(),
                                    )}
                                    onChange={(e) => {
                                      const current = q.correctAnswers || [];
                                      updateQuestion(q.id, {
                                        correctAnswers: e.target.checked
                                          ? [...current, optIdx.toString()]
                                          : current.filter(
                                              (c) => c !== optIdx.toString(),
                                            ),
                                      });
                                    }}
                                  />
                                )}
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...q.options!];
                                    newOpts[optIdx] = e.target.value;
                                    updateQuestion(q.id, { options: newOpts });
                                  }}
                                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                                  placeholder={`Option ${optIdx + 1}`}
                                />
                                <button
                                  onClick={() => {
                                    const newOpts = q.options!.filter(
                                      (_, i) => i !== optIdx,
                                    );
                                    updateQuestion(q.id, { options: newOpts });
                                  }}
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {opt.includes("$") && (
                                <div className="ml-6 text-sm bg-white p-2 border border-slate-100 rounded-lg overflow-x-auto">
                                  <MathRenderer content={opt} />
                                </div>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() =>
                              updateQuestion(q.id, {
                                options: [...q.options!, ""],
                              })
                            }
                            className="text-xs text-primary-600 font-semibold mt-2 px-1"
                          >
                            + Add Option
                          </button>
                        </div>
                      )}

                    {q.type === "Integer" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 mt-4">
                          Correct Answer
                        </label>
                        <input
                          type="text"
                          value={q.correctAnswers?.[0] || ""}
                          onChange={(e) =>
                            updateQuestion(q.id, {
                              correctAnswers: [e.target.value],
                            })
                          }
                          placeholder="Exact value"
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                    )}

                    {q.type === "Fill" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 mt-4">
                          Correct Answer(s) (one per line)
                        </label>
                        <textarea
                          rows={2}
                          value={q.correctAnswers?.join("\n") || ""}
                          onChange={(e) =>
                            updateQuestion(q.id, {
                              correctAnswers: e.target.value.split("\n"),
                            })
                          }
                          placeholder="Possible correct values..."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                        />
                        {q.correctAnswers && q.correctAnswers.some(ans => ans.includes("$")) && (
                          <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm overflow-x-auto flex flex-col space-y-1">
                            {q.correctAnswers.map((ans, idx) => (
                              <MathRenderer key={idx} content={ans} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {q.type === "Subjective" && (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg mt-2 font-medium">
                        Subjective questions require manual evaluation.
                      </div>
                    )}

                    <div className="flex justify-end pt-2 border-t border-slate-100">
                      <button
                        onClick={() =>
                          setQuestions(questions.filter((qu) => qu.id !== q.id))
                        }
                        className="text-xs text-red-500 font-semibold flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove Question
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-4 flex items-start justify-between cursor-pointer hover:bg-slate-50"
                    onClick={() => setEditingQuestionId(q.id)}
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
                        <span className="text-xs font-bold text-slate-500">
                          Q{idx + 1}.
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                          {q.type}
                        </span>
                        <span className="text-xs text-slate-400">
                          {q.points} pt{q.points !== 1 ? "s" : ""}
                        </span>
                        {isFullMockTest && q.sectionId && (
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {sections.find(s => s.id === q.sectionId)?.name || 'Unknown Section'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-900 line-clamp-2">
                        {q.text ? (
                          <MathRenderer content={q.text} formula_latex={q.formula_latex} />
                        ) : (
                          <span className="italic text-slate-400">
                            Empty question
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 mt-1" />
                  </div>
                )}
              </div>
            ))}

            {questions.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-4">
                  No questions added yet.
                </p>
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-[env(safe-area-inset-bottom,16px)] flex items-center justify-between z-10 space-x-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setShowLibraryImport(true)}
                className="shrink-0 bg-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs font-black hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-1.5 mr-3"
              >
                <Database className="w-3.5 h-3.5 text-indigo-100" />
                <span>Import from Library</span>
              </button>

              <span className="text-xs font-bold text-slate-500 uppercase mr-2 shrink-0">
                Add Q:
              </span>
              {["MCQ", "MSQ", "Boolean", "Fill", "Integer", "Subjective"].map(
                (t) => (
                  <button
                    key={t}
                    disabled={hasAttempts}
                    onClick={() => addQuestion(t as any)}
                    className="shrink-0 bg-slate-100 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showLibraryImport && (
          <motion.div
            key="library-import-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/60  flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ y: 50, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 50, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">MissionGrid Question Library</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Select and import questions into your test paper</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLibraryImport(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Filters */}
              <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search library questions..." 
                    value={librarySearch}
                    onChange={e => setLibrarySearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                </div>

                <div>
                  <select 
                    value={libraryFilterSubject}
                    onChange={e => setLibraryFilterSubject(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Subjects</option>
                    {Array.from(new Set(libraryQuestions.map(q => q.subject).filter(Boolean))).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
                {libraryLoading ? (
                  <div className="text-center py-12 flex flex-col items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
                    <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                    <span>Accessing central bank...</span>
                  </div>
                ) : libraryQuestions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    The central library is currently empty.
                  </div>
                ) : (() => {
                  const filtered = libraryQuestions.filter(q => {
                    const matchesSearch = (q.text || '').toLowerCase().includes(librarySearch.toLowerCase()) || 
                                         (q.tags || []).join(' ').toLowerCase().includes(librarySearch.toLowerCase()) ||
                                         (q.chapter || '').toLowerCase().includes(librarySearch.toLowerCase());
                    const matchesSubject = libraryFilterSubject === 'all' || q.subject === libraryFilterSubject;
                    const isVerifiedOrPublished = q.status === 'verified' || q.status === 'published' || q.status === 'approved';
                    return matchesSearch && matchesSubject && isVerifiedOrPublished;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400 text-xs font-bold uppercase">
                        No verified questions match your filters.
                      </div>
                    );
                  }

                  return filtered.map((q, qIdx) => {
                    const isSelected = selectedLibraryIds.includes(q.id);
                    return (
                      <div 
                        key={q.id || qIdx}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedLibraryIds(prev => prev.filter(id => id !== q.id));
                          } else {
                            setSelectedLibraryIds(prev => [...prev, q.id]);
                          }
                        }}
                        className={`p-3.5 bg-white border rounded-2xl cursor-pointer hover:border-indigo-400 transition-all ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/10 bg-indigo-50/10' : 'border-slate-200'}`}
                      >
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            readOnly
                            className="mt-1 accent-indigo-600 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 leading-relaxed">{q.text}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[8px] font-black uppercase border border-slate-200">
                                {q.subject}
                              </span>
                              {q.chapter && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase">
                                  {q.chapter}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 text-[8px] font-black uppercase border border-slate-100">
                                {q.type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Action Footer */}
              <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                <span className="text-xs font-extrabold text-slate-500 uppercase">
                  {selectedLibraryIds.length} questions selected
                </span>

                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setSelectedLibraryIds([]);
                      setShowLibraryImport(false);
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleImportSelected}
                    disabled={selectedLibraryIds.length === 0}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Import Selected</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showPreview && (
          <TestPreviewScreen
            key="preview-screen"
            title={title}
            subject={subject}
            duration={duration}
            questions={questions}
            onClose={() => setShowPreview(false)}
          />
        )}
        {showConfirmClose && (
          <motion.div
            key="confirm-close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60  flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h4 className="text-xl font-bold text-slate-900 mb-2">
                Unsaved Changes
              </h4>
              <p className="text-slate-500 mb-6">
                You have unsaved progress in this test. Are you sure you want to
                discard your changes?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowConfirmClose(false)}
                  className="py-3 font-bold text-slate-700 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  Keep Editing
                </button>
                <button
                  onClick={onClose}
                  className="py-3 font-bold text-white bg-red-500 rounded-2xl hover:bg-red-600 transition-colors"
                >
                  Discard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
