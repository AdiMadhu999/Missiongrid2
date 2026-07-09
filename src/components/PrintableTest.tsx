import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileText,
  Printer,
  ShieldAlert,
  Check,
  HelpCircle,
  BookOpen,
  Layers,
  Video,
  FolderOpen,
  Globe,
  Download,
  Award,
  Calendar,
  Clock,
  BookMarked,
  Eye,
  Lock,
  ChevronRight,
  ArrowUpRight
} from "lucide-react";
import { Test, Question } from "../models/mission";
import appIcon from "../assets/images/app_logo_base_1783466372014.jpg";
import MathRenderer from "./MathRenderer";

interface PrintableTestProps {
  test: Test;
  isOpen: boolean;
  onClose: () => void;
  isMentor?: boolean;
}

interface DetectedResource {
  id: string;
  type: "video" | "pdf" | "drive" | "website" | "missiongrid";
  title: string;
  url: string;
  sourceQuestionNo?: number;
}

export default function PrintableTest({
  test,
  isOpen,
  onClose,
  isMentor = false,
}: PrintableTestProps) {
  // Available types: questions, smart_book
  const [mode, setMode] = useState<"questions" | "smart_book">("questions");
  const [isPrinting, setIsPrinting] = useState(false);

  // Load appropriate default format & validate student access
  useEffect(() => {
    if (isOpen && test) {
      if (isMentor) {
        setMode("questions"); // Mentors can choose anything, default to Questions Only
      } else {
        // Students are locked into what the mentor allowed
        const pdfType = (test.pdfDownloadType as any) || "questions";
        if (pdfType === "smart_book" || pdfType === "solutions" || pdfType === "keys") {
          setMode("smart_book");
        } else {
          setMode("questions");
        }
      }
    }
  }, [isOpen, test, isMentor]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Normalize and migrate the test schema for backward compatibility with older tests
  const normalizedTest = React.useMemo(() => {
    if (!test) return null;

    // Deep clone to avoid mutating the original prop
    const t = JSON.parse(JSON.stringify(test)) as Test;

    // 1. Core Metadata normalization
    t.title = t.title || "Untitled Test";
    t.subject = t.subject || "General Subject";
    t.examName = t.examName || "Practice Exam";
    t.chapterName = t.chapterName || "General Topic";
    t.instructions = t.instructions || "Solve carefully. Standard evaluation scheme.";
    t.difficulty = t.difficulty || "Medium";

    // 2. Questions migration
    let rawQuestions: any[] = [];
    if (Array.isArray(t.questions)) {
      rawQuestions = t.questions;
    } else if (t.questions && typeof t.questions === 'object') {
      // If questions is an object, maybe it's a dictionary or a nested structure
      rawQuestions = Object.values(t.questions);
    } else if (typeof t === 'object') {
      // Look for alternative questions keys in older schemas
      const candidates = [
        "questionsList", "questionList", "items", "mcqs", "quiz", "draftQuestions"
      ];
      for (const c of candidates) {
        if (Array.isArray((t as any)[c])) {
          rawQuestions = (t as any)[c];
          break;
        }
      }
    }

    // Map each raw question to the standard format
    t.questions = rawQuestions.map((q: any, idx: number) => {
      if (!q || typeof q !== 'object') {
        return {
          id: Math.random().toString(36).substring(2, 9),
          type: "MCQ",
          text: "Invalid Question Entry",
          options: ["A", "B", "C", "D"],
          correctAnswers: ["A"],
          points: 2,
          negativePoints: 0.5
        } as Question;
      }

      // Ensure id exists
      const qId = q.id || q.uid || `q-${idx}-${Math.random().toString(36).substring(2, 5)}`;

      // Question Text
      let qText = q.text || q.question || q.questionText || q.title || q.body || "";
      qText = typeof qText === "string" ? qText.trim() : "";

      // Type normalization
      let qType = q.type || q.questionType || "MCQ";
      qType = String(qType).trim().toUpperCase();
      if (qType.includes("MCQ")) qType = "MCQ";
      else if (qType.includes("MSQ")) qType = "MSQ";
      else if (qType.includes("INTEGER") || qType.includes("INT")) qType = "Integer";
      else if (qType.includes("SUBJECTIVE") || qType.includes("THEORY")) qType = "Subjective";
      else if (qType.includes("BOOLEAN")) qType = "Boolean";
      else if (qType.includes("FILL")) qType = "Fill";
      else qType = "MCQ";

      // Options / Choices normalization
      let qOptions: string[] = [];
      if (Array.isArray(q.options)) {
        qOptions = q.options.map((o: any) => String(o).trim());
      } else if (Array.isArray(q.choices)) {
        qOptions = q.choices.map((o: any) => String(o).trim());
      } else if (Array.isArray(q.answers)) {
        qOptions = q.answers.map((o: any) => String(o).trim());
      } else {
        // standalone keys
        const alphabet = ['A', 'B', 'C', 'D'];
        for (const l of alphabet) {
          const key = `option${l}` as string;
          if (q[key] !== undefined) {
            qOptions.push(String(q[key]).trim());
          }
        }
      }
      qOptions = qOptions.filter(opt => opt !== "");

      // Defaults for MCQ/MSQ/Boolean if options are empty
      if (qOptions.length === 0) {
        if (qType === 'Boolean') {
          qOptions = ["True", "False"];
        } else if (qType === 'MCQ' || qType === 'MSQ') {
          qOptions = ["Option A", "Option B", "Option C", "Option D"];
        }
      }

      // Ensure 4 options for MCQ/MSQ
      if (qType === 'MCQ' || qType === 'MSQ') {
        if (qOptions.length < 4) {
          const defaultOpts = ["Option A", "Option B", "Option C", "Option D"];
          while (qOptions.length < 4) {
            qOptions.push(defaultOpts[qOptions.length] || `Option ${String.fromCharCode(65 + qOptions.length)}`);
          }
        } else if (qOptions.length > 4) {
          qOptions = qOptions.slice(0, 4);
        }
      }

      // Correct Answers array normalization
      let qCorrectAnswers: string[] = [];
      if (Array.isArray(q.correctAnswers)) {
        qCorrectAnswers = q.correctAnswers.map((a: any) => String(a).trim());
      } else if (q.correctAnswer) {
        qCorrectAnswers = [String(q.correctAnswer).trim()];
      } else if (q.answer) {
        if (Array.isArray(q.answer)) {
          qCorrectAnswers = q.answer.map((a: any) => String(a).trim());
        } else {
          qCorrectAnswers = [String(q.answer).trim()];
        }
      } else if (q.correct_answer) {
        qCorrectAnswers = [String(q.correct_answer).trim()];
      }

      // Image Urls
      let qImageUrls: string[] = [];
      if (Array.isArray(q.imageUrls)) {
        qImageUrls = q.imageUrls.map((url: any) => String(url).trim());
      } else if (q.imageUrl) {
        qImageUrls = [String(q.imageUrl).trim()];
      }

      // Solution normalization (MultimediaSolution)
      let qSolution: any = q.solution || {};
      if (!qSolution.text && q.explanation) {
        qSolution.text = {
          detailed: String(q.explanation).trim()
        };
      }

      // Points and negative points
      const qPoints = Number(q.points) || 2.0;
      const qNegPoints = q.negativePoints !== undefined ? Number(q.negativePoints) : 0.5;

      return {
        ...q,
        id: qId,
        type: qType,
        text: qText,
        options: qOptions,
        correctAnswers: qCorrectAnswers,
        imageUrls: qImageUrls,
        imageUrl: q.imageUrl || (qImageUrls[0] || ""),
        solution: qSolution,
        points: qPoints,
        negativePoints: qNegPoints,
        difficulty: q.difficulty || t.difficulty || "Medium",
        topic: q.topic || t.chapterName || t.subject || "General"
      } as Question;
    });

    return t;
  }, [test]);

  // Block students if PDF download is disabled by mentor
  const isStudentBlocked = !isMentor && !normalizedTest?.pdfSharingEnabled;

  const handlePrint = () => {
    setIsPrinting(true);
    // Use timeout to allow rendering state to update before trigger
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 400);
  };

  const totalQuestions = normalizedTest?.questions?.length || 0;
  const examName = normalizedTest?.examName || "Practice Exam";
  const chapterName = normalizedTest?.chapterName || "General Topic";

  // Helper to parse resources automatically from test data
  const detectResources = (t: Test): DetectedResource[] => {
    const list: DetectedResource[] = [];
    const seenUrls = new Set<string>();

    const addResource = (
      url: string,
      title: string,
      type?: "video" | "pdf" | "drive" | "website" | "missiongrid",
      qNo?: number
    ) => {
      if (!url || typeof url !== "string") return;
      const cleanUrl = url.trim();
      if (!cleanUrl.startsWith("http")) return;
      if (seenUrls.has(cleanUrl)) return;
      seenUrls.add(cleanUrl);

      let resolvedType: "video" | "pdf" | "drive" | "website" | "missiongrid" = "website";
      if (type) {
        resolvedType = type;
      } else {
        const lower = cleanUrl.toLowerCase();
        if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("/shorts/")) {
          resolvedType = "video";
        } else if (lower.endsWith(".pdf") || lower.includes("/file/d/") || lower.includes("drive.google.com/open?id=")) {
          resolvedType = "pdf";
        } else if (lower.includes("drive.google.com/drive/folders/") || lower.includes("drive.google.com/folderview")) {
          resolvedType = "drive";
        } else if (lower.includes("drive.google.com")) {
          resolvedType = "drive";
        } else if (lower.includes("missiongrid") || lower.includes("ai.studio")) {
          resolvedType = "missiongrid";
        }
      }

      list.push({
        id: Math.random().toString(36).substring(2, 9),
        type: resolvedType,
        title,
        url: cleanUrl,
        sourceQuestionNo: qNo,
      });
    };

    // 1. Scan global test level resources
    if (t.solutions?.videoUrl) {
      addResource(t.solutions.videoUrl, "Test Introduction & Video Overview", "video");
    }
    if (t.solutions?.links && Array.isArray(t.solutions.links)) {
      t.solutions.links.forEach((l: any) => {
        const url = typeof l === "string" ? l : l.url;
        const title = typeof l === "string" ? "Reference Resource" : l.title || "Reference Link";
        addResource(url, title);
      });
    }
    if (t.attachments && Array.isArray(t.attachments)) {
      t.attachments.forEach((att: any, idx: number) => {
        const url = typeof att === "string" ? att : att.url;
        const name = typeof att === "string" ? `Attachment Resource #${idx + 1}` : att.name || `Attachment Resource #${idx + 1}`;
        addResource(url, name);
      });
    }

    // 2. Scan question level resources
    if (t.questions && Array.isArray(t.questions)) {
      t.questions.forEach((q, qIdx) => {
        const qNo = qIdx + 1;
        // Solution PDF
        if (q.solution?.pdfUrl) {
          addResource(q.solution.pdfUrl, `Q${qNo} Detailed Solution PDF`, "pdf", qNo);
        }
        // YouTube video
        if (q.solution?.youtubeUrl) {
          addResource(q.solution.youtubeUrl, `Q${qNo} Video Walkthrough`, "video", qNo);
        }
        // Links
        if (q.solution?.links && Array.isArray(q.solution.links)) {
          q.solution.links.forEach((link: any, lIdx: number) => {
            if (link && typeof link === "object" && link.url) {
              addResource(link.url, `Q${qNo} Resource: ${link.title || `Resource #${lIdx + 1}`}`, undefined, qNo);
            }
          });
        }
        // Embedded links scanner
        const urlRegex = /(https?:\/\/[^\s"'`<>()[\]{}]+)/gi;
        const scanText = (text: string) => {
          if (!text) return;
          let m;
          while ((m = urlRegex.exec(text)) !== null) {
            const url = m[1];
            addResource(url, `Q${qNo} Classroom Reference`, undefined, qNo);
          }
        };

        scanText(q.text);
        if (q.explanation) scanText(q.explanation);
        if (q.solution?.text?.detailed) scanText(q.solution.text.detailed);
      });
    }

    return list;
  };

  const detectedResources = detectResources(normalizedTest || test);

  // Dynamic Page Estimations for TOC (highly accurate A4 printing counts)
  const questionPaperStart = 3;
  const questionPaperPages = Math.max(1, Math.ceil(totalQuestions / 2.5));
  const answerKeyStart = questionPaperStart + questionPaperPages;
  const solutionsStart = answerKeyStart + 1;
  const solutionsPages = Math.max(1, Math.ceil(totalQuestions / 1.5));
  const resourcesStart = solutionsStart + solutionsPages;

  return (
    <>
      {/* Dynamic Style Injection for beautiful A4 printing */}
      <style>{`
        @media print {
          /* Hide all screen-only layout containers */
          body > div:not(#printable-test-paper-root),
          #root,
          .no-print,
          div[role="dialog"],
          .fixed {
            display: none !important;
            height: 0 !important;
            opacity: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
          }

          /* Force high-quality vector print layout */
          #printable-test-paper-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
            line-height: 1.5 !important;
          }

          /* Exact A4 Standard Paper Guidelines */
          @page {
            size: A4;
            margin: 15mm 12mm 20mm 12mm;
          }

          /* Subtle Diagonal Watermark on every printed page */
          .print-watermark {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) rotate(-35deg) !important;
            font-size: 38pt !important;
            font-weight: 900 !important;
            color: rgba(15, 23, 42, 0.035) !important;
            pointer-events: none !important;
            white-space: nowrap !important;
            z-index: -9999 !important;
            font-family: "Inter", sans-serif !important;
            text-transform: uppercase !important;
            letter-spacing: 4px !important;
          }

          /* Professional Page Footer */
          .print-footer {
            position: fixed !important;
            bottom: -15mm !important;
            left: 0 !important;
            right: 0 !important;
            height: 10mm !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-top: 1px solid #e2e8f0 !important;
            padding-top: 6px !important;
            font-size: 7.5pt !important;
            font-family: "JetBrains Mono", monospace !important;
            color: #64748b !important;
            z-index: 9999 !important;
          }

          .print-page-number::after {
            content: "Page " counter(page) !important;
          }

          /* Structured page splitting rules */
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* Black and white laser printer optimization */
          .print-black {
            color: #000000 !important;
          }

          body {
            background-color: #ffffff !important;
          }

          /* High resolution image printing */
          img {
            max-width: 100% !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {mode === "smart_book" && (
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 10mm 10mm 12mm 10mm !important;
            }
            #printable-test-paper-root {
              font-size: 8.5pt !important;
              line-height: 1.2 !important;
              padding: 0 !important;
            }
            .smart-book-content p,
            .smart-book-content li,
            .smart-book-content span,
            .smart-book-content div,
            .smart-book-content ol {
              font-size: 8.5pt !important;
              line-height: 1.2 !important;
            }
            .smart-book-item {
              margin-top: 4px !important;
              margin-bottom: 4px !important;
              padding-top: 4px !important;
              padding-bottom: 4px !important;
            }
          }
        `}</style>
      )}

      {/* Screen view backdrop/modal container */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 -xs p-4 no-print overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                <BookMarked className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm leading-tight">
                  MissionGrid Smart Study Hub
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Export Interactive Study Books & Papers
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body content */}
          {isStudentBlocked ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 border border-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-base">PDF Downloads Disabled</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
                The mentor has disabled PDF downloading for this specific test. Please solve it inside the interactive practice engine.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase transition-transform active:scale-95"
              >
                Go Back
              </button>
            </div>
          ) : totalQuestions === 0 ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-50 border border-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-base">No Questions Populated</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
                This test does not contain any questions. PDF generation requires at least 1 question to compile. Please add questions to the test before printing.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase transition-transform active:scale-95"
              >
                Go Back
              </button>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[70vh] p-6 space-y-6">
              
              {/* Context Summary Banner */}
              <div className="bg-indigo-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-8 text-indigo-800 font-bold text-[180px] pointer-events-none select-none opacity-20">
                  MG
                </div>
                <div className="relative z-10 space-y-1">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-indigo-300 bg-indigo-850 px-2 py-0.5 rounded-md">
                    Active Compilation
                  </span>
                  <h4 className="font-extrabold text-sm truncate max-w-[340px]">{normalizedTest?.title}</h4>
                  <p className="text-[10px] text-indigo-200 font-semibold">
                    {examName} • {normalizedTest?.subject} • {chapterName}
                  </p>
                </div>
                <div className="relative z-10 text-right font-mono text-xs border-l border-indigo-700/80 pl-4 space-y-0.5">
                  <p className="font-bold text-white text-sm">{totalQuestions} Qs</p>
                  <p className="text-[10px] text-indigo-300">{normalizedTest?.maximumMarks} Marks</p>
                </div>
              </div>

              {/* PDF Format Selector (Hides if Student is locked into a format) */}
              <div className="space-y-3">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  {isMentor ? "Select Compilation Format" : "Assigned PDF Format (Mentor Locked)"}
                </label>

                {isMentor ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option 1: QUESTION PAPER */}
                    <button
                      type="button"
                      onClick={() => setMode("questions")}
                      className={`group p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left relative overflow-hidden ${
                        mode === "questions"
                          ? "border-slate-800 bg-slate-50/50 text-slate-900 shadow-sm ring-1 ring-slate-800/10"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="space-y-3 w-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${mode === "questions" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <span className="font-extrabold text-xs uppercase tracking-tight text-slate-900">
                              QUESTION PAPER
                            </span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              mode === "questions" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
                            }`}
                          >
                            {mode === "questions" && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                          Clean traditional exam paper formatted for offline testing.
                        </p>
                        <div className="space-y-1.5 text-[9px] text-slate-600 font-semibold pt-1">
                          <p className="flex items-center gap-1.5">📄 Plain Questions Only</p>
                          <p className="flex items-center gap-1.5">🎓 Clean Exam Header & Rules</p>
                          <p className="flex items-center gap-1.5">📐 Printable A4 Layout</p>
                          <p className="flex items-center gap-1.5 text-slate-400">❌ No Answers or Key Sheets</p>
                          <p className="flex items-center gap-1.5 text-slate-400">❌ No Explanations/Solutions</p>
                        </div>
                      </div>
                    </button>

                    {/* Option 2: MISSIONGRID SMART STUDY BOOK ⭐ */}
                    <button
                      type="button"
                      onClick={() => setMode("smart_book")}
                      className={`group p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left relative overflow-hidden ${
                        mode === "smart_book"
                          ? "border-indigo-600 bg-indigo-50/15 text-indigo-950 shadow-md ring-1 ring-indigo-500/20"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="space-y-3 w-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${mode === "smart_book" ? "bg-indigo-600 text-white animate-pulse" : "bg-indigo-50 text-indigo-400"}`}>
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <span className="font-extrabold text-xs uppercase tracking-tight text-indigo-900 flex items-center gap-1">
                              SMART STUDY BOOK ⭐
                            </span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              mode === "smart_book" ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
                            }`}
                          >
                            {mode === "smart_book" && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-indigo-800 leading-normal font-semibold">
                          The single premium compilation format with advanced features.
                        </p>
                        <div className="space-y-1.5 text-[9px] text-indigo-950 font-semibold pt-1">
                          <p className="flex items-center gap-1.5">📚 Questions, Correct Answers & Complete Solutions</p>
                          <p className="flex items-center gap-1.5">🔗 Clickable YouTube, PDF & Web Link Shortcuts</p>
                          <p className="flex items-center gap-1.5">📱 Print-Ready Scan QR Codes for Resources</p>
                          <p className="flex items-center gap-1.5">🛡️ MissionGrid by Adi Madhu Diagonal Watermark</p>
                          <p className="flex items-center gap-1.5">📝 Professional Title Cover Page, TOC & Copyright</p>
                          <p className="flex items-center gap-1.5">🌐 Mobile-friendly Compact Professional Layout</p>
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  /* Lock and Lock Message for student profiles */
                  <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-slate-800">
                        {mode === "questions" ? "QUESTION PAPER" : "MISSIONGRID SMART STUDY BOOK ⭐"}
                      </p>
                      <p className="text-slate-500 mt-1 leading-relaxed font-medium">
                        The classroom mentor has compiled and locked your downloadable format to this option. You can save, print, or review the authorized document.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Standard Laser Printer Notice */}
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-normal">
                  <p className="font-bold">A4 High-Contrast Vector Compilation</p>
                  <p className="mt-1 font-medium text-slate-800">
                    Equations and diagrams are rendered in high-definition vectors, preserving clear text searches. Prints beautifully on standard monochrome laser printers and photocopiers.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* Action Footer */}
          {!isStudentBlocked && (
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 border border-slate-200 rounded-xl text-xs font-bold uppercase text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
              {totalQuestions > 0 && (
                <button
                  onClick={handlePrint}
                  className="flex-1 py-3 px-4 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>Compile & Print Book</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================================
          ACTUAL PRINT DOCUMENT CONTAINER (Displayed ONLY during media query printing)
          We render this via a React Portal directly inside document.body so that hiding 
          the #root element during window.print() does not accidentally hide the printable content.
          ====================================================================== */}
      {createPortal(
        <div
          id="printable-test-paper-root"
          className="hidden p-12 bg-white text-black text-sm leading-relaxed"
        >
        {/* Subtle Watermark on every printed page */}
        {mode === "smart_book" && (
          <div className="hidden print:block print-watermark">
            MissionGrid by Adi Madhu
          </div>
        )}

        {/* Professional Footer on every printed page */}
        {mode === "smart_book" && (
          <div className="hidden print:block print-footer">
            <div>© MissionGrid by Adi Madhu. All Rights Reserved.</div>
            <div className="text-slate-400">
              Generated: {new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} {normalizedTest?.version ? `| v${normalizedTest.version}` : "| Version 1.0"}
            </div>
            <div className="print-page-number"></div>
          </div>
        )}
        
        {/* ==================== SECTION 1: COVER PAGE ==================== */}
        {mode === "smart_book" && (
          <div
            id="cover"
            className="print-page-break flex flex-col justify-between min-h-[260mm] border-8 border-black p-12 bg-white print-avoid-break relative"
          >
            <h1 className="sr-only">Cover</h1>
            {/* Top Stripe */}
            <div className="border-b-4 border-black pb-6 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">
                  MissionGrid Interactive Series
                </p>
                <h1 className="text-4xl font-extrabold uppercase tracking-tight mt-1">
                  SMART STUDY BOOK
                </h1>
              </div>
              {/* MissionGrid Logo */}
              <div className="flex items-center gap-2">
                <img
                  src={appIcon}
                  alt="MissionGrid Logo"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-xl border border-slate-200 shadow-xs object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="text-left">
                  <span className="block font-black text-sm tracking-tight text-slate-900 leading-none">MissionGrid</span>
                  <span className="text-[7px] font-bold text-slate-400 font-mono tracking-widest uppercase block mt-1">Adi Madhu</span>
                </div>
              </div>
            </div>

            {/* Title Panel */}
            <div className="my-auto space-y-6 py-8">
              <span className="inline-block bg-black text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 font-mono rounded-md">
                Complete Study Companion
              </span>
              <h2 className="text-3xl font-black text-slate-950 uppercase leading-tight">
                {normalizedTest?.title}
              </h2>
              <p className="text-slate-600 font-medium text-xs leading-relaxed max-w-lg">
                This document is a professionally structured learning manual, featuring step-by-step methods, alternative approaches, comprehensive visual diagrams, and linked video/classroom material accessible instantly via printed QR Codes or direct hyperlinks.
              </p>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-6 border-t-2 border-black pt-8 text-xs font-mono">
              <div className="space-y-2">
                <p>
                  <span className="font-bold text-slate-400">EXAM CATEGORY:</span>{" "}
                  <span className="font-extrabold text-black">{examName}</span>
                </p>
                <p>
                  <span className="font-bold text-slate-400">SUBJECT AREA:</span>{" "}
                  <span className="font-extrabold text-black">{normalizedTest?.subject || "N/A"}</span>
                </p>
                <p>
                  <span className="font-bold text-slate-400">TOPIC AREA:</span>{" "}
                  <span className="font-extrabold text-black">{chapterName}</span>
                </p>
              </div>
              <div className="space-y-2 text-right">
                <p>
                  <span className="font-bold text-slate-400">TOTAL QUESTIONS:</span>{" "}
                  <span className="font-extrabold text-black">{totalQuestions} Items</span>
                </p>
                <p>
                  <span className="font-bold text-slate-400">MAXIMUM MARKS:</span>{" "}
                  <span className="font-extrabold text-black">{normalizedTest?.maximumMarks} Pts</span>
                </p>
                <p>
                  <span className="font-bold text-slate-400">DURATION LIMIT:</span>{" "}
                  <span className="font-extrabold text-black">{normalizedTest?.duration} Minutes</span>
                </p>
              </div>
            </div>

            {/* Cover Page Footer */}
            <div className="mt-8 border-t border-dashed border-slate-300 pt-4 flex justify-between text-[9px] font-mono text-slate-400">
              <span>Verified Educator Curriculum</span>
              <span>Copyright © {new Date().getFullYear()} MissionGrid</span>
            </div>
          </div>
        )}

        {/* ==================== SECTION 2: TABLE OF CONTENTS & RULES ==================== */}
        {mode === "smart_book" && (
          <div id="toc" className="print-page-break p-6 bg-white min-h-[260mm]">
            <div className="border-b-2 border-black pb-4 mb-8">
              <h2 className="text-xl font-bold font-sans uppercase tracking-tight">
                Table of Contents
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 font-mono">
                Study Book Navigation Outline
              </p>
            </div>

            {/* Dotted Leader Rows */}
            <div className="space-y-4 font-sans text-xs max-w-xl">
              <div className="flex justify-between items-end border-b border-dotted border-slate-200 pb-2">
                <a href="#cover" className="font-bold text-slate-800 hover:underline">
                  Cover Page
                </a>
                <span className="font-mono text-slate-400">Page 1</span>
              </div>
              <div className="flex justify-between items-end border-b border-dotted border-slate-200 pb-2">
                <a href="#toc" className="font-bold text-slate-800 hover:underline">
                  Table of Contents & Assessment Guidelines
                </a>
                <span className="font-mono text-slate-400">Page 2</span>
              </div>
              <div className="flex justify-between items-end border-b border-dotted border-slate-200 pb-2">
                <a href="#study-book-content" className="font-bold text-slate-800 hover:underline">
                  Complete Questions & Stepwise Solutions
                </a>
                <span className="font-mono text-slate-400">Page 3 onwards</span>
              </div>
            </div>

            {/* Instructions box inside TOC block */}
            <div className="border border-black p-5 mt-12 bg-slate-50">
              <h3 className="text-[11px] font-bold uppercase tracking-widest mb-2 font-mono">
                Standard Assessment Parameters
              </h3>
              {normalizedTest?.instructions ? (
                <div className="text-xs text-slate-700 whitespace-pre-line font-serif leading-relaxed">
                  {normalizedTest.instructions}
                </div>
              ) : (
                <p className="text-xs text-slate-600 font-serif leading-relaxed">
                  Attempt all questions sequentially. No external aid allowed. Maintain exam integrity.
                </p>
              )}
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-dashed border-slate-300 text-[10px] font-mono">
                <div>
                  <p className="font-bold text-slate-800">✔ Correct Response Award:</p>
                  <p className="text-emerald-700 font-black mt-0.5">
                    +{normalizedTest?.questions?.[0]?.points || 2.0} Marks (Full Points)
                  </p>
                </div>
                <div>
                  <p className="font-bold text-slate-800">✘ Negative Deductions:</p>
                  <p className="text-rose-700 font-black mt-0.5">
                    {normalizedTest?.questions?.[0]?.negativePoints ? `-${normalizedTest.questions[0].negativePoints}` : "-0.5"} Marks
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== SECTION: SMART STUDY BOOK UNIFIED CONTENT ==================== */}
        {mode === "smart_book" && (
          <div id="study-book-content" className="print-page-break p-6 bg-white smart-book-content">
            {/* Section Header */}
            <div className="border-b-4 border-black pb-3 mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  Questions & Stepwise Solutions
                </h2>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1 font-mono">
                  Complete Study Companion with Methodology & Resources
                </p>
              </div>
              <div className="flex items-center gap-2">
                <img
                  src={appIcon}
                  alt="MissionGrid Logo"
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-lg border border-slate-200 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-widest">MissionGrid</span>
              </div>
            </div>

            {/* Questions Flow */}
            <div className="space-y-6">
              {normalizedTest?.questions && normalizedTest.questions.length > 0 ? (
                (() => {
                  let currentSectionId = "";
                  return normalizedTest.questions.map((q: Question, qIdx: number) => {
                    const qNo = qIdx + 1;
                    const correctStr = q.correctAnswers?.join(", ") || "N/A";
                    const qLinks = detectedResources.filter(r => r.sourceQuestionNo === qNo);
                    const hasImages = q.imageUrls && q.imageUrls.length > 0;
                    const hasLegacyImage = !!q.imageUrl;

                    let sectionHeader = null;
                    if (normalizedTest.isFullMockTest && q.sectionId && q.sectionId !== currentSectionId) {
                      currentSectionId = q.sectionId;
                      const sec = normalizedTest.sections?.find((s: any) => s.id === q.sectionId);
                      if (sec) {
                        sectionHeader = (
                          <div className="print-avoid-break bg-slate-50 border-l-4 border-slate-800 p-3 mb-4 mt-4 rounded-r">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                              {sec.name}
                            </h3>
                            {sec.description && (
                              <p className="text-[9px] text-slate-500 font-serif mt-0.5">
                                {sec.description}
                              </p>
                            )}
                          </div>
                        );
                      }
                    }

                    return (
                      <React.Fragment key={q.id || `smart-book-q-${qIdx}`}>
                        {sectionHeader}
                        <div
                          className="print-avoid-break border-b border-slate-200 pb-5 last:border-0 smart-book-item"
                        >
                      {/* Question Header */}
                      <div className="flex items-start gap-2.5 mb-2">
                        <span className="font-mono font-black text-[9.5pt] bg-black text-white px-2 py-0.5 rounded">
                          Q{qNo}
                        </span>
                        <div className="flex-1 min-w-0">
                          {/* Question Text */}
                          <div className="text-[9pt] font-serif text-slate-900 leading-normal font-medium">
                            <MathRenderer content={q.text} />
                          </div>
                        </div>
                      </div>

                      {/* Question Images */}
                      {(hasImages || hasLegacyImage) && (
                        <div className="my-2 flex flex-wrap gap-2 justify-center print-avoid-break">
                          {hasImages &&
                            q.imageUrls?.map((url, imgIdx) => (
                              <img
                                key={url || imgIdx}
                                src={url}
                                alt={`Q${qNo} visual #${imgIdx + 1}`}
                                className="max-h-36 max-w-full w-auto h-auto object-contain border border-slate-150 rounded-lg p-1 bg-white print-avoid-break"
                                referrerPolicy="no-referrer"
                              />
                            ))}
                          {!hasImages && hasLegacyImage && (
                            <img
                              src={q.imageUrl}
                              alt={`Q${qNo} visual`}
                              className="max-h-36 max-w-full w-auto h-auto object-contain border border-slate-150 rounded-lg p-1 bg-white print-avoid-break"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>
                      )}

                      {/* Correct Answer Section (No Options listed!) */}
                      <div className="flex items-center gap-1.5 mt-2 mb-2">
                        <span className="text-[8pt] font-mono font-bold uppercase text-slate-400">
                          Correct Option:
                        </span>
                        <span className="bg-slate-100 text-black border border-slate-300 font-extrabold font-mono text-[8.5pt] px-2.5 py-0.5 rounded shadow-2xs">
                          {correctStr}
                        </span>
                      </div>

                      {/* Complete Detailed Solution (Exactly as stored) */}
                      <div className="space-y-3 mt-3 border-l-2 border-slate-150 pl-3">
                        
                        {/* Legacy Explanation */}
                        {q.explanation && (
                          <div className="space-y-0.5">
                            <p className="text-[8pt] font-mono font-bold uppercase text-slate-400">
                              Conceptual Explanation
                            </p>
                            <div className="text-[8.5pt] text-slate-700 font-serif leading-normal">
                              <MathRenderer content={q.explanation} />
                            </div>
                          </div>
                        )}

                        {/* Detailed text */}
                        {q.solution?.text?.detailed && (
                          <div className="space-y-0.5">
                            <p className="text-[8pt] font-mono font-bold uppercase text-slate-400">
                              Detailed Solution Breakdown
                            </p>
                            <div className="text-[8.5pt] text-slate-700 font-serif leading-normal">
                              <MathRenderer content={q.solution.text.detailed} />
                            </div>
                          </div>
                        )}

                        {/* Stepwise Methodology */}
                        {q.stepwiseSolution && q.stepwiseSolution.length > 0 && (
                          <div className="space-y-1 bg-slate-50/50 p-3 rounded border border-slate-150">
                            <p className="text-[8pt] font-mono font-bold uppercase text-slate-500">
                              Step-by-Step Methodology
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-[8.5pt] text-slate-700 font-serif leading-normal">
                              {q.stepwiseSolution.map((step, sIdx) => (
                                <li key={sIdx} className="pl-1">
                                  <MathRenderer content={step} className="inline" />
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Tips & Alternative Shortcuts */}
                        {q.solution?.text?.tips && (
                          <div className="bg-slate-50 border border-slate-200 p-3 rounded">
                            <p className="text-[8pt] font-mono font-bold uppercase text-slate-600">
                              💡 Mentor Tip / Alternative Shortcut
                            </p>
                            <div className="text-[8.5pt] text-slate-800 font-serif leading-normal font-medium mt-0.5">
                              <MathRenderer content={q.solution.text.tips} />
                            </div>
                          </div>
                        )}

                        {/* Mistakes to Avoid */}
                        {q.solution?.text?.mistakes && (
                          <div className="bg-slate-50 border border-slate-250 p-3 rounded">
                            <p className="text-[8pt] font-mono font-bold uppercase text-slate-700">
                              ⚠️ Common Mistakes to Avoid
                            </p>
                            <div className="text-[8.5pt] text-slate-900 font-serif leading-normal font-medium mt-0.5">
                              <MathRenderer content={q.solution.text.mistakes} />
                            </div>
                          </div>
                        )}

                        {/* Key Concept */}
                        {q.keyConcept && (
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded text-[8.5pt]">
                            <span className="text-[8pt] font-mono font-bold uppercase text-slate-400 block mb-0.5">
                              Key Concept
                            </span>
                            <p className="text-slate-800 font-serif leading-normal font-medium">
                              {q.keyConcept}
                            </p>
                          </div>
                        )}

                        {/* Interactive Educational Resource QR and Buttons */}
                        {qLinks.length > 0 && (
                          <div className="pt-2 border-t border-dashed border-slate-200">
                            <p className="text-[8pt] font-mono font-bold uppercase text-slate-400 mb-2">
                              Study Resources (Scan to Watch/Read)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {qLinks.map((res) => (
                                <div
                                  key={res.id}
                                  className="flex items-center gap-2 border border-slate-200 p-2 rounded bg-white max-w-[280px] print-avoid-break text-[8pt]"
                                >
                                  {/* Compact QR Code */}
                                  <div className="shrink-0 bg-slate-50 p-0.5 border border-slate-150 rounded">
                                    <img
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(
                                        res.url
                                      )}`}
                                      alt="QR"
                                      className="w-10 h-10"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  {/* Details */}
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-bold text-slate-800 text-[8.5pt] truncate leading-tight">
                                      {res.title}
                                    </h5>
                                    <a
                                      href={res.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[7.5pt] font-extrabold text-indigo-700 hover:underline flex items-center gap-0.5 mt-0.5"
                                    >
                                      {res.type === "video" && <span>🎥 Video Solution</span>}
                                      {res.type === "pdf" && <span>📘 Open PDF Notes</span>}
                                      {res.type === "drive" && <span>📂 Open Drive Folder</span>}
                                      {res.type === "website" && <span>🌐 Reference Site</span>}
                                      {res.type === "missiongrid" && <span>📥 Study Material</span>}
                                    </a>
                                    <p className="hidden print:block text-[6.5pt] text-slate-500 font-mono mt-0.5 break-all">
                                      {res.url}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>

                      </div>
                    </React.Fragment>
                  );
                });
              })()
            ) : (
                <p className="text-center text-slate-400 font-mono py-12">No questions populated.</p>
              )}
            </div>
          </div>
        )}

        {/* ==================== SECTION 3: QUESTION PAPER ==================== */}
        {mode !== "smart_book" && (
          <div id="question-paper" className="print-page-break p-6 bg-white">
          <h2 className="sr-only">Questions</h2>
          {/* Paper Banner Header */}
          <div className="border-b-4 border-black pb-4 mb-6 flex justify-between items-start">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">
                MissionGrid Examination Series
              </p>
              <h2 className="text-2xl font-black uppercase tracking-tight mt-0.5">
                {normalizedTest?.title}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="inline-block border border-black px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest font-mono">
                  {mode === "questions" ? "QUESTION PAPER ONLY" : "SECTION I: QUESTIONS"}
                </span>
                <p className="text-[9px] font-semibold text-slate-400 font-mono mt-1">
                  Ref Code: MG-{normalizedTest?.id ? normalizedTest.id.substring(0, 8).toUpperCase() : "TEST"}
                </p>
              </div>
              <img
                src={appIcon}
                alt="MissionGrid Logo"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg border border-slate-200 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          </div>

          {/* Quick Metrics (shown only if not in smart book which has a dedicated cover) */}
          <div className="grid grid-cols-4 gap-4 mb-6 border-b border-slate-200 pb-4 text-xs font-mono">
            <div>
              <p className="text-[8px] uppercase text-slate-400">Exam</p>
              <p className="font-extrabold mt-0.5">{examName}</p>
            </div>
            <div>
              <p className="text-[8px] uppercase text-slate-400">Subject</p>
              <p className="font-extrabold mt-0.5">{normalizedTest?.subject || "General"}</p>
            </div>
            <div>
              <p className="text-[8px] uppercase text-slate-400">Total Marks</p>
              <p className="font-extrabold mt-0.5">{normalizedTest?.maximumMarks} Pts</p>
            </div>
            <div>
              <p className="text-[8px] uppercase text-slate-400">Duration</p>
              <p className="font-extrabold mt-0.5">{normalizedTest?.duration} Min</p>
            </div>
          </div>

          {/* Rules/Instructions (shown only if not in smart book which has them in TOC) */}
          {normalizedTest?.instructions && (
            <div className="border border-slate-200 p-4 mb-6 bg-slate-50 text-xs">
              <p className="font-mono font-bold text-[9px] text-slate-400 uppercase tracking-widest mb-1">
                INSTRUCTIONS
              </p>
              <div className="text-slate-700 leading-relaxed font-serif">
                {normalizedTest.instructions}
              </div>
            </div>
          )}

          {/* Questions Grid */}
          <div className="space-y-8 mt-4">
            {normalizedTest?.questions && normalizedTest.questions.length > 0 ? (
              (() => {
                let currentSectionId = "";
                return normalizedTest.questions.map((q: Question, qIdx: number) => {
                  const hasImages = q.imageUrls && q.imageUrls.length > 0;
                  const hasLegacyImage = !!q.imageUrl;
                  const qNo = qIdx + 1;
                  const qTags = q.tags || (q.topic ? [q.topic] : []);

                  let sectionHeader = null;
                  if (normalizedTest.isFullMockTest && q.sectionId && q.sectionId !== currentSectionId) {
                    currentSectionId = q.sectionId;
                    const sec = normalizedTest.sections?.find((s: any) => s.id === q.sectionId);
                    if (sec) {
                      sectionHeader = (
                        <div className="print-avoid-break bg-slate-100 border-l-4 border-black p-3.5 mb-6 mt-4 rounded-r-lg">
                          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                            {sec.name}
                          </h3>
                          {sec.description && (
                            <p className="text-[10px] text-slate-500 font-medium font-serif mt-0.5">
                              {sec.description}
                            </p>
                          )}
                          <div className="flex gap-4 mt-1.5 text-[9px] font-mono font-bold text-slate-600 uppercase">
                            <span>Questions: {normalizedTest.questions.filter((qu: any) => qu.sectionId === sec.id).length}</span>
                            {sec.timeLimit && <span>Time Limit: {sec.timeLimit} Min</span>}
                          </div>
                        </div>
                      );
                    }
                  }

                  return (
                    <React.Fragment key={q.id || `print-q-${qIdx}`}>
                      {sectionHeader}
                      <div
                        id={`q-${qNo}`}
                        className="print-avoid-break border-b border-slate-100 pb-6 last:border-0"
                      >
                    <h3 className="sr-only">Question {qNo}</h3>
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <span className="font-mono font-black text-xs bg-black text-white w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                        {qNo}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {/* Marks/Difficulty */}
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[8px] font-bold font-mono px-2 py-0.5 rounded-md">
                            +{q.points || 2.0} Marks
                          </span>
                          {q.difficulty && (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[8px] font-bold font-mono px-2 py-0.5 rounded-md">
                              {q.difficulty}
                            </span>
                          )}
                          {/* Fallback tags */}
                          {qTags.map((tag: string, tIdx: number) => (
                            <span
                              key={tIdx}
                              className="bg-indigo-50/50 text-indigo-700 border border-indigo-100/50 text-[8px] font-bold font-mono px-2 py-0.5 rounded-md"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        {/* Question Text */}
                        <div className="text-sm font-serif text-slate-900 leading-relaxed font-medium">
                          <MathRenderer content={q.text} />
                        </div>
                      </div>
                    </div>

                    {/* Question Images */}
                    {(hasImages || hasLegacyImage) && (
                      <div className="my-4 flex flex-wrap gap-2 justify-center print-avoid-break">
                        {hasImages &&
                          q.imageUrls?.map((url, imgIdx) => (
                            <img
                              key={url || imgIdx}
                              src={url}
                              alt={`Q${qNo} visual #${imgIdx + 1}`}
                              className="max-h-52 max-w-full object-contain border border-slate-200 rounded p-1.5 bg-white"
                              referrerPolicy="no-referrer"
                            />
                          ))}
                        {!hasImages && hasLegacyImage && (
                          <img
                            src={q.imageUrl}
                            alt={`Q${qNo} visual`}
                            className="max-h-52 max-w-full object-contain border border-slate-200 rounded p-1.5 bg-white"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    )}

                    {/* MCQ Options grid */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-4 ml-10 print-avoid-break">
                        {q.options.map((option: string, optIdx: number) => {
                          const optLetter = String.fromCharCode(65 + optIdx);
                          return (
                            <div
                              key={optIdx}
                              className="flex items-start gap-2.5 text-xs border border-slate-150 p-2.5 rounded-xl bg-slate-50/10 font-sans print-black"
                            >
                              <span className="font-mono font-black border border-slate-400 w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-white">
                                {optLetter}
                              </span>
                              <span className="font-medium text-slate-800 self-center leading-normal">
                                <MathRenderer content={option} />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  </React.Fragment>
                );
              });
            })()
          ) : (
              <p className="text-center text-slate-400 font-mono py-12">No test questions populated.</p>
            )}
          </div>
        </div>
        )}

        {/* ==================== SECTION 4: QUICK ANSWER KEY ==================== */}
        {mode === "smart_book" && (
          <div id="answer-key" className="print-page-break p-6 bg-white min-h-[260mm]">
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold font-sans uppercase tracking-tight">
                  Answer Key
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 font-mono">
                  Rapid Self-Grading Sheet
                </p>
              </div>
              <div className="flex items-center gap-2">
                <img
                  src={appIcon}
                  alt="MissionGrid Logo"
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-lg border border-slate-200 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-widest">MissionGrid</span>
              </div>
            </div>

            {normalizedTest?.isFullMockTest && normalizedTest.sections && normalizedTest.sections.length > 0 ? (
              <div className="space-y-6 mt-4">
                {normalizedTest.sections.map((sec: any) => {
                  const secQs = normalizedTest.questions ? normalizedTest.questions.map((q, idx) => ({ q, idx })).filter(item => item.q.sectionId === sec.id) : [];
                  if (secQs.length === 0) return null;
                  return (
                    <div key={sec.id} className="print-avoid-break">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800 bg-slate-50 px-3 py-1.5 border-l-2 border-slate-700 rounded-r mb-3">
                        {sec.name}
                      </h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-3 font-sans">
                        {secQs.map(({ q, idx }) => {
                          const correctStr = q.correctAnswers?.join(", ") || "N/A";
                          return (
                            <div
                              key={q.id || idx}
                              className="flex justify-between items-center border-b border-slate-100 pb-2 text-xs font-mono"
                            >
                              <span className="font-bold text-slate-500">Question {idx + 1}:</span>
                              <span className="bg-black text-white font-extrabold px-2 py-0.5 rounded-md text-xs min-w-[24px] text-center">
                                {correctStr}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 font-sans max-w-2xl mt-4">
                {normalizedTest?.questions?.map((q, qIdx) => {
                  const correctStr = q.correctAnswers?.join(", ") || "N/A";
                  return (
                    <div
                      key={qIdx}
                      className="flex justify-between items-center border-b border-slate-100 pb-2 text-xs font-mono"
                    >
                      <span className="font-bold text-slate-500">Question {qIdx + 1}:</span>
                      <span className="bg-black text-white font-extrabold px-2 py-0.5 rounded-md text-xs min-w-[24px] text-center">
                        {correctStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== SECTION 5: DETAILED SOLUTIONS ==================== */}
        {false && (
          <div id="solutions" className="print-page-break p-6 bg-white">
            
            {/* Solutions Banner */}
            <div className="border-b-4 border-black pb-4 mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">
                  Detailed Solutions
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 font-mono">
                  Step-by-Step Logic, Notes & Explanations
                </p>
              </div>
              <div className="flex items-center gap-2">
                <img
                  src={appIcon}
                  alt="MissionGrid Logo"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-lg border border-slate-200 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="text-right">
                  <span className="block font-bold text-xs font-mono tracking-tight text-slate-900 leading-none">MissionGrid</span>
                  <span className="text-[6px] font-bold text-slate-400 font-mono tracking-widest uppercase block mt-0.5">Solutions</span>
                </div>
              </div>
            </div>

            <div className="space-y-10">
              {normalizedTest?.questions?.map((q, qIdx) => {
                const qNo = qIdx + 1;
                const correctStr = q.correctAnswers?.join(", ") || "N/A";
                
                // Collect links specific to this question
                const qLinks = detectedResources.filter(r => r.sourceQuestionNo === qNo);

                return (
                  <div
                    key={qIdx}
                    id={`sol-${qNo}`}
                    className="print-avoid-break border-b border-slate-200 pb-8 last:border-0"
                  >
                    <h3 className="sr-only">Solution {qNo}</h3>
                    {/* Solution Header */}
                    <div className="flex justify-between items-start mb-4 border-b border-dashed border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-md">
                          SOL {qNo}
                        </span>
                        <h3 className="font-extrabold text-sm text-slate-900">
                          Stepwise Analysis
                        </h3>
                      </div>
                      <a
                        href={`#q-${qNo}`}
                        className="text-[10px] font-bold text-slate-400 hover:underline no-print font-mono"
                      >
                        ← Back to Question
                      </a>
                    </div>

                    {/* Original text snippet to recall question context */}
                    <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl mb-4 text-xs text-slate-500 font-serif leading-relaxed italic">
                      <strong>Q{qNo}:</strong> <MathRenderer content={q.text.substring(0, 140) + (q.text.length > 140 ? "..." : "")} />
                    </div>

                    {/* Correct Key Badge */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                        Correct Option:
                      </span>
                      <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black font-mono px-3 py-1 rounded-lg uppercase shadow-xs">
                        {correctStr}
                      </span>
                    </div>

                    {/* Legacy / Simple Explanation */}
                    {q.explanation && (
                      <div className="space-y-1 mt-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                          Conceptual Explanation:
                        </p>
                        <div className="text-xs text-slate-700 font-serif leading-relaxed">
                          <MathRenderer content={q.explanation} />
                        </div>
                      </div>
                    )}

                    {/* Rich Multimedia Solutions Block */}
                    {q.solution && (
                      <div className="space-y-4 mt-4">
                        
                        {/* Detailed text */}
                        {q.solution.text?.detailed && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                              Detailed Breakdown:
                            </p>
                            <div className="text-xs text-slate-700 font-serif leading-relaxed">
                              <MathRenderer content={q.solution.text.detailed} />
                            </div>
                          </div>
                        )}

                        {/* Stepwise Breakdown */}
                        {q.stepwiseSolution && q.stepwiseSolution.length > 0 && (
                          <div className="space-y-1.5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest font-mono">
                              Step-by-Step Methodology:
                            </p>
                            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 font-serif leading-relaxed">
                              {q.stepwiseSolution.map((step, sIdx) => (
                                <li key={sIdx} className="pl-1">
                                  <MathRenderer content={step} className="inline" />
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Tips & Alternative Shortcuts */}
                        {q.solution.text?.tips && (
                          <div className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-xl">
                            <span className="text-[9px] font-extrabold uppercase text-indigo-800 font-mono tracking-widest block mb-1">
                              💡 Alternative Shortcut / Tip:
                            </span>
                            <div className="text-xs text-indigo-900 font-medium font-serif leading-normal">
                              <MathRenderer content={q.solution.text.tips} />
                            </div>
                          </div>
                        )}

                        {/* Avoid Mistakes block */}
                        {q.solution.text?.mistakes && (
                          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
                            <span className="text-[9px] font-extrabold uppercase text-rose-800 font-mono tracking-widest block mb-1">
                              ⚠️ Common Mistake to Avoid:
                            </span>
                            <div className="text-xs text-rose-950 font-medium font-serif leading-normal">
                              <MathRenderer content={q.solution.text.mistakes} />
                            </div>
                          </div>
                        )}

                        {/* Core concept tag summary */}
                        {q.keyConcept && (
                          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                            <span className="text-[9px] font-bold text-slate-500 font-mono block mb-1">
                              Key Concept:
                            </span>
                            <p className="text-xs text-slate-700 font-medium font-sans">
                              {q.keyConcept}
                            </p>
                          </div>
                        )}

                        {/* Question-level QR Codes beside each resource */}
                        {qLinks.length > 0 && (
                          <div className="space-y-3.5 pt-4 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                              Interactive QR Study Resources:
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              {qLinks.map((res) => (
                                <div
                                  key={res.id}
                                  className="flex items-center gap-3 border border-slate-200 p-3 rounded-xl bg-white shadow-xs print-avoid-break"
                                >
                                  {/* QR Code image */}
                                  <div className="shrink-0 bg-slate-50 p-1 border border-slate-150 rounded-lg">
                                    <img
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                                        res.url
                                      )}`}
                                      alt="QR Code"
                                      className="w-14 h-14"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  {/* Details */}
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-bold text-slate-800 text-[10px] truncate leading-tight">
                                      {res.title}
                                    </h5>
                                    
                                    {/* Action link styled button */}
                                    <a
                                      href={res.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 mt-2 text-[8px] font-bold rounded-md text-white ${
                                        res.type === "video"
                                          ? "bg-red-600 hover:bg-red-700"
                                          : res.type === "pdf"
                                          ? "bg-blue-600 hover:bg-blue-700"
                                          : res.type === "drive"
                                          ? "bg-amber-600 hover:bg-amber-700"
                                          : res.type === "missiongrid"
                                          ? "bg-purple-600 hover:bg-purple-700"
                                          : "bg-indigo-600 hover:bg-indigo-700"
                                      }`}
                                    >
                                      {res.type === "video" && <span>🎥 Watch Video Solution</span>}
                                      {res.type === "pdf" && <span>📘 Open PDF Notes</span>}
                                      {res.type === "drive" && <span>📂 Open Drive Folder</span>}
                                      {res.type === "website" && <span>🌐 Visit Reference Website</span>}
                                      {res.type === "missiongrid" && <span>📥 Download Study Material</span>}
                                    </a>
                                    <p className="hidden print:block text-[8px] text-slate-500 font-mono mt-1 break-all">
                                      {res.url}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== SECTION 6: SMART RESOURCE INDEX ==================== */}
        {mode === "smart_book" && false && (
          <div id="resources-index" className="print-page-break p-6 bg-white">
            
            {/* Index Banner */}
            <div className="border-b-4 border-black pb-4 mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">
                  Learning Resources
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 font-mono">
                  Grouped Video Solutions, PDF Notes & Materials Catalog
                </p>
              </div>
              <div className="flex items-center gap-2">
                <img
                  src={appIcon}
                  alt="MissionGrid Logo"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-lg border border-slate-200 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="text-right">
                  <span className="block font-bold text-xs font-mono tracking-tight text-slate-900 leading-none">MissionGrid</span>
                  <span className="text-[6px] font-bold text-slate-400 font-mono tracking-widest uppercase block mt-0.5">Resources</span>
                </div>
              </div>
            </div>

            {detectedResources.length > 0 ? (
              <div className="space-y-8">
                {/* 1. Video Solutions Category */}
                {detectedResources.some((r) => r.type === "video") && (
                  <div className="space-y-3 print-avoid-break">
                    <h3 className="text-xs font-black uppercase tracking-widest text-red-600 font-mono border-b border-red-100 pb-1">
                      🎥 Video Solutions
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {detectedResources
                        .filter((r) => r.type === "video")
                        .map((res) => (
                          <div
                            key={res.id}
                            className="flex items-center gap-3 border border-slate-200 p-3 rounded-xl bg-slate-50/50 print-avoid-break"
                          >
                            <div className="shrink-0 bg-white p-1 border border-slate-200 rounded-lg">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                                  res.url
                                )}`}
                                alt="QR Code"
                                className="w-14 h-14"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[7px] font-mono font-bold uppercase bg-red-100 text-red-800 px-1.5 py-0.2 rounded-md">
                                Video {res.sourceQuestionNo ? `• Q${res.sourceQuestionNo}` : ""}
                              </span>
                              <h4 className="font-extrabold text-slate-800 text-[10px] mt-1 truncate leading-tight">
                                {res.title}
                              </h4>
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 mt-2 text-[8px] font-bold rounded-md bg-red-600 text-white shadow-xs hover:bg-red-700"
                              >
                                🎥 Watch Video Solution
                              </a>
                              <p className="hidden print:block text-[8px] text-slate-500 font-mono mt-1 break-all">
                                {res.url}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 2. PDF Notes Category */}
                {detectedResources.some((r) => r.type === "pdf") && (
                  <div className="space-y-3 print-avoid-break">
                    <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 font-mono border-b border-blue-100 pb-1">
                      📘 PDF Notes
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {detectedResources
                        .filter((r) => r.type === "pdf")
                        .map((res) => (
                          <div
                            key={res.id}
                            className="flex items-center gap-3 border border-slate-200 p-3 rounded-xl bg-slate-50/50 print-avoid-break"
                          >
                            <div className="shrink-0 bg-white p-1 border border-slate-200 rounded-lg">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                                  res.url
                                )}`}
                                alt="QR Code"
                                className="w-14 h-14"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[7px] font-mono font-bold uppercase bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md">
                                PDF {res.sourceQuestionNo ? `• Q${res.sourceQuestionNo}` : ""}
                              </span>
                              <h4 className="font-extrabold text-slate-800 text-[10px] mt-1 truncate leading-tight">
                                {res.title}
                              </h4>
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 mt-2 text-[8px] font-bold rounded-md bg-blue-600 text-white shadow-xs hover:bg-blue-700"
                              >
                                📘 Open PDF Notes
                              </a>
                              <p className="hidden print:block text-[8px] text-slate-500 font-mono mt-1 break-all">
                                {res.url}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 3. Google Drive Folders/Files Category */}
                {detectedResources.some((r) => r.type === "drive") && (
                  <div className="space-y-3 print-avoid-break">
                    <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 font-mono border-b border-amber-100 pb-1">
                      📂 Google Drive Resources
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {detectedResources
                        .filter((r) => r.type === "drive")
                        .map((res) => (
                          <div
                            key={res.id}
                            className="flex items-center gap-3 border border-slate-200 p-3 rounded-xl bg-slate-50/50 print-avoid-break"
                          >
                            <div className="shrink-0 bg-white p-1 border border-slate-200 rounded-lg">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                                  res.url
                                )}`}
                                alt="QR Code"
                                className="w-14 h-14"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[7px] font-mono font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md">
                                Drive {res.sourceQuestionNo ? `• Q${res.sourceQuestionNo}` : ""}
                              </span>
                              <h4 className="font-extrabold text-slate-800 text-[10px] mt-1 truncate leading-tight">
                                {res.title}
                              </h4>
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 mt-2 text-[8px] font-bold rounded-md bg-amber-600 text-white shadow-xs hover:bg-amber-700"
                              >
                                📂 Open Drive Folder
                              </a>
                              <p className="hidden print:block text-[8px] text-slate-500 font-mono mt-1 break-all">
                                {res.url}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 4. Other Website Links & Reference websites */}
                {detectedResources.some((r) => r.type === "website") && (
                  <div className="space-y-3 print-avoid-break">
                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 font-mono border-b border-indigo-100 pb-1">
                      🌐 Websites
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {detectedResources
                        .filter((r) => r.type === "website")
                        .map((res) => (
                          <div
                            key={res.id}
                            className="flex items-center gap-3 border border-slate-200 p-3 rounded-xl bg-slate-50/50 print-avoid-break"
                          >
                            <div className="shrink-0 bg-white p-1 border border-slate-200 rounded-lg">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                                  res.url
                                )}`}
                                alt="QR Code"
                                className="w-14 h-14"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[7px] font-mono font-bold uppercase bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-md">
                                Web {res.sourceQuestionNo ? `• Q${res.sourceQuestionNo}` : ""}
                              </span>
                              <h4 className="font-extrabold text-slate-800 text-[10px] mt-1 truncate leading-tight">
                                {res.title}
                              </h4>
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 mt-2 text-[8px] font-bold rounded-md bg-indigo-600 text-white shadow-xs hover:bg-indigo-700"
                              >
                                🌐 Visit Reference Website
                              </a>
                              <p className="hidden print:block text-[8px] text-slate-500 font-mono mt-1 break-all">
                                {res.url}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 5. MissionGrid Direct Resources */}
                {detectedResources.some((r) => r.type === "missiongrid") && (
                  <div className="space-y-3 print-avoid-break">
                    <h3 className="text-xs font-black uppercase tracking-widest text-purple-600 font-mono border-b border-purple-100 pb-1">
                      📥 MissionGrid Resources
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {detectedResources
                        .filter((r) => r.type === "missiongrid")
                        .map((res) => (
                          <div
                            key={res.id}
                            className="flex items-center gap-3 border border-slate-200 p-3 rounded-xl bg-slate-50/50 print-avoid-break"
                          >
                            <div className="shrink-0 bg-white p-1 border border-slate-200 rounded-lg">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                                  res.url
                                )}`}
                                alt="QR Code"
                                className="w-14 h-14"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[7px] font-mono font-bold uppercase bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-md">
                                App {res.sourceQuestionNo ? `• Q${res.sourceQuestionNo}` : ""}
                              </span>
                              <h4 className="font-extrabold text-slate-800 text-[10px] mt-1 truncate leading-tight">
                                {res.title}
                              </h4>
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 mt-2 text-[8px] font-bold rounded-md bg-purple-600 text-white shadow-xs hover:bg-purple-700"
                              >
                                📥 Download Study Material
                              </a>
                              <p className="hidden print:block text-[8px] text-slate-500 font-mono mt-1 break-all">
                                {res.url}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-slate-400 font-mono py-12">
                No external links or educational resources detected in this paper.
              </p>
            )}
          </div>
        )}

      </div>,
      document.body
    )}
    </>
  );
}
