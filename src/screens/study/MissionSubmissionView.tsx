import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  FileText, 
  Plus, 
  X, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Trash2,
  Camera,
  Layers,
  FileSearch,
  BookOpen,
  Calendar,
  ChevronRight,
  ShieldCheck,
  History as HistoryIcon,
  Award,
  Clock,
  Check,
  ChevronDown,
  Eye,
  MessageSquare,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { useAppConfig } from '../../providers/AppProvider';
import { uploadFile } from '../../services/storage';
import { MissionService } from '../../services/mission';
import { DailyMissionReport, MissionSection } from '../../models/mission';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { StudentUpdatesCard } from '../../components/dashboard/StudentUpdatesCard';
import { MissionFeedbackModal } from '../../components/student/MissionFeedbackModal';
import imageCompression from 'browser-image-compression';
import { subscribeStudentLeaveRequests } from '../../services/leave';
import ApplyLeaveModal from '../student/ApplyLeaveModal';
import { LeaveRequest } from '../../models/leave';

interface Props {
  onBack: () => void;
}

interface SectionDef {
  id: string;
  title: string;
  subtitle: string;
  maxMarks: number;
  icon: React.ComponentType<any>;
  color: 'emerald' | 'rose' | 'amber' | 'indigo' | 'sky' | 'violet';
  bulletPoints: string[];
  placeholder: string;
  notesLabel: string;
}

const SECTIONS_DEF: SectionDef[] = [
  {
    id: 'section1',
    title: 'To Do List Submission',
    subtitle: 'Upload completed To-Do lists & proof of target accomplishment.',
    maxMarks: 20,
    icon: Layers,
    color: 'emerald',
    bulletPoints: [
      'Completed To Do List',
      'Daily Target Proof'
    ],
    placeholder: 'Summarize your targets completed today, list key accomplishments...',
    notesLabel: 'Completion Status / Daily Target Summary'
  },
  {
    id: 'section2',
    title: 'Rough Sheet Practice',
    subtitle: 'Practice/scratch sheets indicating calculation & hard practice.',
    maxMarks: 10,
    icon: FileText,
    color: 'rose',
    bulletPoints: [
      'Rough Calculation Sheets',
      'Practice Work & Calculations'
    ],
    placeholder: 'Details of chapters, exercises, or formula charts modeled today...',
    notesLabel: 'Practice Details'
  },
  {
    id: 'section3',
    title: 'Active Learning Reflection',
    subtitle: 'Notes, self-reflection & deep conceptual key learnings.',
    maxMarks: 20,
    icon: BookOpen,
    color: 'amber',
    bulletPoints: [
      'Learning Notes',
      'Concept Understanding',
      'Self Reflection',
      'Key Learnings & Takeaways'
    ],
    placeholder: 'Write your daily learning synthesis, core concepts digested, and self-reflection. Be specific and qualitative...',
    notesLabel: 'Understanding & Deep Reflections'
  },
  {
    id: 'section5',
    title: 'Study Time Logging',
    subtitle: 'Stopwatch, screen time analytics, and active hour verification.',
    maxMarks: 20,
    icon: Clock,
    color: 'sky',
    bulletPoints: [
      'Total Study Hours (e.g. 8.5 Hrs)',
      'Study Stopwatch Screenshot',
      'Study Report / Activity Log'
    ],
    placeholder: 'Detail your study routine, focus levels, and log of hours...',
    notesLabel: 'Study Time Log / Output'
  }
];

export default function MissionHub({ onBack }: Props) {
  const { userProfile } = useAuth();
  const { setIsPremiumModalOpen } = useAppConfig();
  const [todayReport, setTodayReport] = useState<DailyMissionReport | null>(null);
  const [history, setHistory] = useState<DailyMissionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'submit' | 'history' | 'leave'>('submit');
  const [refreshUpdatesTrigger, setRefreshUpdatesTrigger] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [showApplyLeave, setShowApplyLeave] = useState(false);

  const handleFeedbackSubmit = async (feedback: string) => {
    if (!todayReport?.id) return;
    await MissionService.submitMissionFeedback(todayReport.id, feedback);
  };

  // Expanded section in Submission area
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Form states maps indexed by section ID
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({});
  const [sectionFiles, setSectionFiles] = useState<Record<string, { file: File; preview: string; type: 'image' | 'pdf' }[]>>({});
  const [sectionUploading, setSectionUploading] = useState<Record<string, boolean>>({});

  const [today, setToday] = useState(new Date().toISOString().split('T')[0]);

  // Update today if it changes (e.g. crossing midnight UTC)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toISOString().split('T')[0];
      if (now !== today) {
        setToday(now);
      }
    }, 60000); // Check once per minute
    return () => clearInterval(interval);
  }, [today]);

  useEffect(() => {
    console.log("DEBUG: MissionSubmissionView useEffect triggered", { userProfileId: userProfile?.id, today });
    if (!userProfile?.id) {
        console.log("DEBUG: userProfile.id missing, returning");
        return;
    }
    
    const uId = userProfile.id || userProfile.uid;

    let hasCached = false;

    // Synchronous state initialization from cache if available for faster initial paint
    try {
      const cached = localStorage.getItem(`mission_hub_cache_${uId}`);
      if (cached) {
         const parsed = JSON.parse(cached);
         if (parsed.todayReport && parsed.todayReport.date === today) {
           setTodayReport(parsed.todayReport);
           hasCached = true;
         } else {
           setTodayReport(null);
         }
         if (parsed.history) setHistory(parsed.history);
      }
    } catch (e) {
      console.error('Error fetching cache:', e);
    }
    
    if (!hasCached) {
        setLoading(true);
    }
    console.log("DEBUG: Loading check done, hasCached:", hasCached);

    // Subscribe to today's report with real-time listener
    const unsubscribeToday = MissionService.subscribeDailyReport(
      uId!,
      today,
      (report) => {
        setTodayReport(report);
        setLoading(false);

        // Update local cache
        try {
          const cached = localStorage.getItem(`mission_hub_cache_${uId}`);
          const prevCache = cached ? JSON.parse(cached) : {};
          localStorage.setItem(`mission_hub_cache_${uId}`, JSON.stringify({
            ...prevCache,
            todayReport: report
          }));
        } catch {}
      },
      (error) => {
        console.error('Subscription error for today report:', error);
        setLoading(false);
      }
    );

    // Subscribe to history with real-time listener
    const unsubscribeHistory = MissionService.subscribeStudentReports(
      uId!,
      (pastMissions) => {
        setHistory(pastMissions);

        // Update local cache with history
        try {
          const cached = localStorage.getItem(`mission_hub_cache_${uId}`);
          const prevCache = cached ? JSON.parse(cached) : {};
          localStorage.setItem(`mission_hub_cache_${uId}`, JSON.stringify({
            ...prevCache,
            history: pastMissions
          }));
        } catch {}
      },
      (error) => console.error('History subscription error:', error),
      15
    );

    // Subscribe to student's leave requests with real-time listener
    const unsubscribeLeaves = subscribeStudentLeaveRequests(uId!, (data) => {
      setLeaves(data);
    });

    return () => {
      unsubscribeToday();
      unsubscribeHistory();
      unsubscribeLeaves();
    };
  }, [userProfile?.id, today]);

  const handleForceSync = async () => {
    if (!userProfile) return;
    setSyncing(true);
    const uId = userProfile.id || userProfile.uid;
    try {
      const report = await MissionService.getDailyReport(uId!, today);
      setTodayReport(report);
      setRefreshUpdatesTrigger(prev => prev + 1);
      toast.success('Report synced with server');
    } catch (e) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleFileChange = async (sectionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    
    const existingFiles = sectionFiles[sectionId] || [];
    const validFiles: { file: File; preview: string; type: 'image' | 'pdf' }[] = [];

    for (const file of selectedFiles) {
      // Duplicate check
      if (existingFiles.some(f => f.file.name === file.name && f.file.size === file.size)) continue;

      if (file.type.startsWith('image/')) {
        try {
          const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
          const compressedFile = await imageCompression(file, options);
          validFiles.push({
            file: compressedFile,
            preview: URL.createObjectURL(compressedFile),
            type: 'image'
          });
        } catch (error) {
          console.error('Compression failed, using original:', error);
          validFiles.push({
            file,
            preview: URL.createObjectURL(file),
            type: 'image'
          });
        }
      } else {
        validFiles.push({
          file,
          preview: '',
          type: 'pdf'
        });
      }
    }

    setSectionFiles(prev => ({
      ...prev,
      [sectionId]: [...existingFiles, ...validFiles]
    }));
  };

  const removeFile = (sectionId: string, index: number) => {
    setSectionFiles(prev => {
      const list = [...(prev[sectionId] || [])];
      const removed = list.splice(index, 1)[0];
      if (removed && removed.preview) URL.revokeObjectURL(removed.preview);
      return {
        ...prev,
        [sectionId]: list
      };
    });
  };

  const handleSectionSubmit = async (sectionId: string, maxMarks: number) => {
    if (!userProfile) return;

    const notes = sectionNotes[sectionId] || '';
    const files = sectionFiles[sectionId] || [];

    // Validations: sections 1, 2, 5 need at least 1 image proof
    if (['section1', 'section2', 'section5'].includes(sectionId) && files.length === 0) {
      toast.error('This section requires at least one upload proof.');
      return;
    }

    if (['section3', 'section6'].includes(sectionId) && !notes.trim() && files.length === 0) {
      toast.error('Please either write key reflections/notes in the text box details or upload a proof.');
      return;
    }

    setSectionUploading(prev => ({ ...prev, [sectionId]: true }));
    try {
      const attachmentMetas = [];
      
      for (const f of files) {
        const timestamp = Date.now();
        const sanitizedName = f.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `submissions/${userProfile.id}/${today}/${sectionId}_${timestamp}_${sanitizedName}`;
        const { url, path: uploadedPath } = await uploadFile(path, f.file);
        
        attachmentMetas.push({
          url,
          type: f.type,
          name: f.file.name,
          path: uploadedPath || path,
          downloadURL: url,
          storagePath: uploadedPath || path
        });
      }

      await MissionService.submitSectionReport(
        userProfile.id || userProfile.uid!,
        userProfile.name || 'Anonymous Student',
        userProfile.mobile || null,
        userProfile.photoUrl || null,
        userProfile.batchId || null,
        today,
        sectionId,
        notes,
        attachmentMetas
      );

      toast.success('Section evidence submitted successfully!');
      setExpandedSection(null);
      // Clean up form inputs for this section
      setSectionNotes(prev => ({ ...prev, [sectionId]: '' }));
      setSectionFiles(prev => ({ ...prev, [sectionId]: [] }));

    } catch (e: any) {
      console.error(e);
      if (e.message.includes('premium')) {
        setIsPremiumModalOpen(true);
      } else {
        toast.error(e.message || 'Failed to submit section report');
      }
    } finally {
      setSectionUploading(prev => ({ ...prev, [sectionId]: false }));
    }
  };

  // Helper to color statuses
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2.5 py-1 text-[9px] font-black tracking-widest bg-emerald-100 text-emerald-700 rounded-full uppercase">Approved</span>;
      case 'Pending':
        return <span className="px-2.5 py-1 text-[9px] font-black tracking-widest bg-amber-100 text-amber-700 rounded-full uppercase">Pending Review</span>;
      case 'Rejected':
        return <span className="px-2.5 py-1 text-[9px] font-black tracking-widest bg-rose-100 text-rose-700 rounded-full uppercase">Rejected</span>;
      case 'Needs Improvement':
        return <span className="px-2.5 py-1 text-[9px] font-black tracking-widest bg-indigo-100 text-indigo-700 rounded-full uppercase">Needs Improvement</span>;
      default:
        return <span className="px-2.5 py-1 text-[9px] font-black tracking-widest bg-slate-100 text-slate-400 rounded-full uppercase">Not Submitted</span>;
    }
  };

  const getSectionColorClasses = (color: string) => {
    switch (color) {
      case 'emerald': return { bg: 'bg-emerald-50 text-emerald-600', hover: 'hover:border-emerald-200 hover:bg-emerald-50/20', accent: 'text-emerald-600' };
      case 'rose': return { bg: 'bg-rose-50 text-rose-600', hover: 'hover:border-rose-200 hover:bg-rose-50/20', accent: 'text-rose-600' };
      case 'amber': return { bg: 'bg-amber-50 text-amber-600', hover: 'hover:border-amber-200 hover:bg-amber-50/20', accent: 'text-amber-500' };
      case 'indigo': return { bg: 'bg-indigo-50 text-indigo-600', hover: 'hover:border-indigo-200 hover:bg-indigo-50/20', accent: 'text-indigo-600' };
      case 'sky': return { bg: 'bg-sky-50 text-sky-600', hover: 'hover:border-sky-200 hover:bg-sky-50/20', accent: 'text-sky-600' };
      case 'violet': return { bg: 'bg-violet-50 text-violet-600', hover: 'hover:border-violet-200 hover:bg-violet-50/20', accent: 'text-violet-600' };
      default: return { bg: 'bg-slate-50 text-slate-600', hover: 'hover:border-slate-200', accent: 'text-slate-600' };
    }
  };

  // Compute live scoreboard
  let totalReportScore = 0;
  const progressRows = SECTIONS_DEF.map(sec => {
    const sDoc = todayReport?.sections?.[sec.id];
    const score = sDoc?.status === 'Approved' ? (sDoc.marks || 0) : 0;
    totalReportScore += score;
    return {
      title: (sec.title.includes('To Do') ? 'DO' : 
              sec.title.includes('Rough') ? 'SHEET' :
              sec.title.includes('Learning') ? 'LEARNING' :
              sec.title.includes('Revision') ? 'REVISION' :
              sec.title.includes('Time') ? 'TIME' : 
              sec.title.includes('Error') ? 'REGISTER' : 
              sec.title.split(' ')[1] || sec.title),
      score: sDoc?.status === 'Approved' ? sDoc.marks : null,
      max: sec.maxMarks,
      status: sDoc?.status || 'Not Submitted'
    };
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 w-10 h-10 mb-2" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Accountabilities...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-indigo-50 flex items-center justify-between shadow-sm shrink-0">
         <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl text-slate-500 mr-1 shrink-0 transition-all">
               <ArrowLeft size={18} />
            </button>
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
               <ShieldCheck size={20} />
            </div>
            <div>
               <h1 className="text-lg font-black text-slate-900 tracking-tight">Mission Hub</h1>
               <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${todayReport ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {todayReport ? 'Live Tracking Active' : 'Evidence Submissions Pending'}
                  </p>
                  {todayReport?.updatedAt && (
                    <>
                      <span className="text-slate-200 text-[8px]">•</span>
                      <span className="text-[8px] font-medium text-slate-300">
                        {new Date(todayReport.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  )}
               </div>
            </div>
         </div>
         <div className="text-right">
            <div className="flex items-center gap-2 mb-1 justify-end">
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   handleForceSync();
                 }}
                 disabled={syncing}
                 className={`p-1 hover:bg-slate-50 rounded-lg text-slate-400 transition-all ${syncing ? 'animate-spin text-indigo-500' : ''}`}
                 title="Force sync with server"
               >
                 <RefreshCw size={14} />
               </button>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
            </div>
            <div className="flex gap-1 mt-1 justify-end">
               {[1,2,3,4,5,6,7].map(i => (
                  <div key={i} className={`w-1 h-3 rounded-full ${i <= (userProfile?.currentStreak || 0) % 7 ? 'bg-indigo-500' : 'bg-slate-100'}`} />
               ))}
            </div>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-4 shrink-0 gap-2 bg-slate-50">
         <button 
           onClick={() => setActiveTab('submit')}
           className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
             activeTab === 'submit' ? 'bg-slate-950 text-white shadow-md' : 'bg-white border border-slate-150 text-slate-400'
           }`}
         >
           Structured Report
         </button>
         <button 
           onClick={() => setActiveTab('history')}
           className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
             activeTab === 'history' ? 'bg-slate-950 text-white shadow-md' : 'bg-white border border-slate-150 text-slate-400'
           }`}
         >
           Mission Timeline
         </button>
         <button 
           onClick={() => setActiveTab('leave')}
           className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
             activeTab === 'leave' ? 'bg-slate-950 text-white shadow-md' : 'bg-white border border-slate-150 text-slate-400'
           }`}
         >
           Emergency Leave
         </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'submit' ? (
            <motion.div 
              key="submit"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Permanent Mission Rules Card */}
              <div className="bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-amber-50/70 border-2 border-amber-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/30 rounded-full -translate-y-16 translate-x-16" />
                <div className="flex items-start gap-4 relative">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-md">
                    <AlertCircle size={20} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Mission Rules</h3>
                    <ul className="text-xs font-semibold text-slate-700 space-y-1.5 list-disc pl-4 pt-1">
                      <li>Submit your Daily Mission regularly.</li>
                      <li>
                        If you do not submit your Mission for <strong className="text-rose-600 font-extrabold">10 consecutive days</strong>, you will lose your Premium access.
                      </li>
                      <li>
                        If you have a genuine emergency, please <strong className="text-indigo-600 font-extrabold">apply for Leave</strong> before missing your Mission.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Sections List */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-1">
                  <span>Structured Sections</span>
                  <span className="text-[9px] font-bold text-indigo-500 lowercase">(submit independently)</span>
                </h4>

                {SECTIONS_DEF.map((sec) => {
                  const sData: MissionSection | undefined = todayReport?.sections?.[sec.id];
                  const isExpanded = expandedSection === sec.id;
                  const colors = getSectionColorClasses(sec.color);
                  const isPending = sData?.status === 'Pending';
                  const isApproved = sData?.status === 'Approved';
                  const isRejected = sData?.status === 'Rejected';
                  const isNeedsImprovement = sData?.status === 'Needs Improvement';
                  
                  // Can the student edit / submit?
                  const canSubmit = !isApproved && !isPending;

                  return (
                    <div 
                      key={sec.id}
                      className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${
                        isExpanded ? 'border-indigo-200 ring-4 ring-indigo-50/40' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {/* Section Item Header */}
                      <div 
                        onClick={() => {
                          if (expandedSection === sec.id) setExpandedSection(null);
                          else setExpandedSection(sec.id);
                        }}
                        className="p-5 flex items-center justify-between cursor-pointer select-none gap-4"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}>
                            <sec.icon size={20} />
                          </div>
                          <div className="truncate flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-black text-slate-900 text-sm tracking-tight">{sec.title}</h5>
                              <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-lg shrink-0">
                                Max: {sec.maxMarks}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-400 truncate mt-0.5">{sec.subtitle}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right flex flex-col items-end">
                            {getStatusBadge(sData?.status || 'Not Submitted')}
                            {sData?.status === 'Approved' && (
                              <span className="text-[11px] font-black mt-1 text-slate-800">
                                {sData.marks} / {sec.maxMarks} Marks
                              </span>
                            )}
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-slate-400"
                          >
                            <ChevronDown size={16} />
                          </motion.div>
                        </div>
                      </div>

                      {/* Expandable Submission Form or File Preview Area */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden border-t border-slate-50"
                          >
                            <div className="p-6 bg-slate-50/50 space-y-5">
                              {/* Guidelines / Proof Items */}
                              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                  <AlertCircle size={10} className={colors.accent} /> Mandatory uploads & details:
                                </p>
                                <ul className="pl-4 list-disc space-y-1">
                                  {sec.bulletPoints.map((bp) => (
                                    <li key={bp} className="text-xs font-bold text-slate-600">{bp}</li>
                                  ))}
                                </ul>
                              </div>

                              {/* Submitted Content Display (If Submitted or Needs Improvement) */}
                              {sData?.submitted && (
                                <div className="space-y-3 bg-white p-4 border border-slate-100 rounded-3xl">
                                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your Submitted Files</span>
                                     <span className="text-[8px] font-bold text-slate-400 uppercase">
                                       Submitted: {sData.submittedAt ? new Date(sData.submittedAt).toLocaleTimeString() : 'Unknown'}
                                     </span>
                                  </div>

                                  {/* Files Row */}
                                  {sData.attachments && sData.attachments.length > 0 ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                      {sData.attachments.map((file) => (
                                        <a 
                                          key={file.path} 
                                          href={file.url} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="aspect-square bg-slate-50 border border-slate-150 rounded-xl flex flex-col items-center justify-center p-1 relative hover:bg-indigo-50/30 transition-all group"
                                        >
                                          {file.type === 'image' ? (
                                            <img src={file.url} className="w-full h-full object-cover rounded-lg" />
                                          ) : (
                                            <FileText className="text-rose-500 w-8 h-8" />
                                          )}
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                            <Eye className="text-white w-4 h-4" />
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs font-bold text-slate-400 italic">No attachments submitted.</p>
                                  )}

                                  {/* Student reflection notes */}
                                  {sData.notes && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 font-medium whitespace-pre-wrap">
                                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Student Notes Reflection:</p>
                                      "{sData.notes}"
                                    </div>
                                  )}

                                  {/* Mentor Remarks feedback */}
                                  {sData.remarks && (
                                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-left">
                                      <p className="text-[10px] font-black text-indigo-600 uppercase mb-1 flex items-center gap-1">
                                        <MessageSquare size={10} /> Mentor Evaluation Feedback:
                                      </p>
                                      <p className="text-xs text-slate-700 font-black italic">"{sData.remarks}"</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Form Input Area for active Submission */}
                              {canSubmit ? (
                                <div className="space-y-4">
                                  {/* text content details input */}
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                      {sec.notesLabel}
                                    </label>
                                    <textarea 
                                      value={sectionNotes[sec.id] || ''}
                                      onChange={e => setSectionNotes(prev => ({ ...prev, [sec.id]: e.target.value }))}
                                      placeholder={sec.placeholder}
                                      className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-100/50 min-h-[90px] transition-all"
                                    />
                                  </div>

                                  {/* file upload picker */}
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                      Attachments Verification
                                    </label>
                                    
                                    <div className="grid grid-cols-4 gap-2">
                                      {/* Add button trigger */}
                                      {userProfile?.isPremium ? (
                                        <label className="aspect-square bg-slate-100 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group shrink-0">
                                          <Plus className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 mb-0.5" />
                                          <span className="text-[7px] font-black uppercase text-slate-400">Upload</span>
                                          <input 
                                            type="file" 
                                            multiple 
                                            accept="image/*,application/pdf" 
                                            className="hidden" 
                                            onChange={(e) => handleFileChange(sec.id, e)} 
                                          />
                                        </label>
                                      ) : (
                                        <div className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center">
                                          <AlertCircle className="w-5 h-5 text-slate-300 mb-0.5" />
                                          <span className="text-[7px] font-black uppercase text-slate-400 text-center px-1">Premium Only</span>
                                        </div>
                                      )}

                                      {/* Selected list */}
                                      {(sectionFiles[sec.id] || []).map((f, idx) => (
                                        <div key={`${sec.id}-${f.file.name}-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white group shadow-xs shrink-0">
                                          {f.type === 'image' ? (
                                            <img src={f.preview} alt="preview" className="w-full h-full object-cover" />
                                          ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-rose-50">
                                              <FileText className="w-6 h-6 text-rose-500 mb-0.5" />
                                              <p className="text-[6px] font-black text-rose-700 truncate w-full text-center">{f.file.name}</p>
                                            </div>
                                          )}
                                          <button 
                                            onClick={() => removeFile(sec.id, idx)}
                                            className="absolute top-1 right-1 bg-black/60 text-white p-0.5 rounded-full hover:bg-black"
                                          >
                                            <X size={8} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Big Submit Section Action */}
                                  {userProfile?.isPremium ? (
                                    <button 
                                      onClick={() => handleSectionSubmit(sec.id, sec.maxMarks)}
                                      disabled={sectionUploading[sec.id]}
                                      className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-2 active:scale-97 disabled:opacity-50"
                                    >
                                      {sectionUploading[sec.id] ? (
                                        <>
                                          <Loader2 className="animate-spin" size={14} />
                                          Saving Accountabilities...
                                        </>
                                      ) : (
                                        <>
                                          <Upload size={14} />
                                          Submit {sec.title.split(' ')[1] || 'Proof'}
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <div className="w-full py-4 bg-amber-50 text-amber-700 rounded-2xl font-black text-[10px] uppercase tracking-widest text-center">
                                      Premium membership is required to submit missions.
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-2 text-slate-400 flex items-center justify-center gap-2 text-xs font-bold leading-relaxed bg-slate-100/50 rounded-2xl p-4">
                                  {isPending && <Clock size={14} className="text-amber-500 animate-spin" />}
                                  {isApproved && <CheckCircle2 size={14} className="text-emerald-500" />}
                                  <span>
                                    {isPending ? 'Under verification. Waiting for mentor grade approval.' : ''}
                                    {isApproved ? 'Section approved! Verified score: ' + sData.marks + '/' + sec.maxMarks + ' Marks.' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : activeTab === 'history' ? (
            <motion.div 
              key="history"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
               <div className="flex items-center justify-between px-2 pt-2">
                 <div className="flex items-center space-x-1.5">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-indigo-500 pl-3">Mentor Log & Feedback</h3>
                   <button 
                     type="button"
                     onClick={() => setShowHelpModal(true)}
                     className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                     title="Help & Info"
                   >
                     <HelpCircle size={12} />
                   </button>
                 </div>
                 <button 
                   onClick={handleForceSync}
                   className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase"
                 >
                   Refresh
                 </button>
               </div>
               {userProfile && (
                 <StudentUpdatesCard refreshTrigger={refreshUpdatesTrigger} 
                   studentId={userProfile.id!} 
                   authUid={userProfile.uid!} 
                 />
               )}
            </motion.div>
          ) : (
            <motion.div 
              key="leave"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-indigo-100 p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/40 rounded-full -translate-y-16 translate-x-16" />
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Apply Emergency Leave</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Approved leave protects you from losing Premium access due to inactivity. Leave will count toward preparation and target days, but your consecutive missed mission counter will remain protected.
                    </p>
                    <button 
                      onClick={() => setShowApplyLeave(true)}
                      className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-97"
                    >
                      Apply For Leave
                    </button>
                  </div>
                </div>
              </div>

              {/* Leave History */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Leave Request History</h4>
                {leaves.length === 0 ? (
                  <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center text-xs font-bold text-slate-400">
                    No emergency leave requests found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaves.map((l, index) => {
                      const isPending = l.status === 'pending';
                      const isApproved = l.status === 'approved';
                      const isRejected = l.status === 'rejected';
                      const isCancelled = l.status === 'cancelled';
                      
                      return (
                        <div key={l.id || index} className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs space-y-3">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={14} className="text-slate-400" />
                              <span className="text-xs font-black text-slate-900">Leave Date: {l.startDate}</span>
                            </div>
                            <div>
                              {isPending && <span className="px-2.5 py-1 text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-100 rounded-full uppercase animate-pulse">Pending</span>}
                              {isApproved && <span className="px-2.5 py-1 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full uppercase">Approved</span>}
                              {isRejected && <span className="px-2.5 py-1 text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-100 rounded-full uppercase">Rejected</span>}
                              {isCancelled && <span className="px-2.5 py-1 text-[9px] font-black bg-slate-100 text-slate-500 rounded-full uppercase">Cancelled</span>}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50/80 p-3 rounded-2xl">
                            <div>
                              <span className="text-slate-400 font-bold block">Number of Days:</span>
                              <span className="font-extrabold text-slate-700">{l.numberOfDays} {l.numberOfDays === 1 ? 'Day' : 'Days'}</span>
                            </div>
                            {l.endDate && (
                              <div>
                                <span className="text-slate-400 font-bold block">Until Date:</span>
                                <span className="font-extrabold text-slate-700">{l.endDate}</span>
                              </div>
                            )}
                          </div>

                          <div className="text-xs">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Reason</span>
                            <p className="font-bold text-slate-600 whitespace-pre-wrap bg-slate-50/50 p-3 rounded-2xl font-sans">"${l.reason}"</p>
                          </div>

                          {l.attachmentUrl && (
                            <div className="pt-1">
                              <a 
                                href={l.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-lg text-[9px] font-black text-indigo-600 tracking-wider uppercase"
                              >
                                <Eye size={10} />
                                <span>Attachment</span>
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showApplyLeave && userProfile && (
        <ApplyLeaveModal 
          onClose={() => setShowApplyLeave(false)} 
          userProfile={userProfile} 
        />
      )}

      {/* Help Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative border border-slate-100 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
              
              <div className="flex justify-between items-start mb-4 mt-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <HelpCircle size={18} />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Understanding Mentor Updates</h4>
                </div>
                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                <p>
                  The <strong className="text-slate-900 font-semibold">Mentor Updates & Log</strong> section is a real-time communications channel designed to display instantaneous feedback and professional guidance directly from your assigned mentor.
                </p>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                  <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Key Functional Roles:</h5>
                  <ul className="space-y-1.5 list-disc pl-4 text-slate-500 text-[11px]">
                    <li><strong className="text-slate-700">Real-Time Evaluation:</strong> Mentors publish graded results, score adjustments, and qualitative criteria.</li>
                    <li><strong className="text-slate-700">Advisory Guidance:</strong> Delivers instant remarks, study correction remarks, and daily target reviews.</li>
                    <li><strong className="text-slate-700">Official Letters & Notices:</strong> Warnings, general leaves, and general board announcements appear sequentially here to keep you synchronised.</li>
                  </ul>
                </div>
                <p className="text-slate-500 text-[10px]">
                  Use the <span className="font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded uppercase">Refresh</span> trigger at any time to force sync with your mentor's latest remarks from the cloud database.
                </p>
              </div>

              <button 
                onClick={() => setShowHelpModal(false)}
                className="w-full mt-6 py-3 bg-slate-900 hover:bg-slate-850 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-98"
              >
                Acknowledge & Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <MissionFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
        missionDate={today}
      />
    </div>
  );
}
