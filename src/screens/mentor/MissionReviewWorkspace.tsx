import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Check, 
  X, 
  AlertTriangle, 
  Clock, 
  User, 
  Image as ImageIcon, 
  FileText, 
  ExternalLink,
  MessageSquare,
  Award,
  ChevronRight,
  ChevronLeft,
  Calendar,
  History,
  Star,
  Target,
  CheckCircle2,
  Search,
  RefreshCw,
  Loader2,
  Layers,
  BookOpen,
  ChevronDown,
  Trash2,
  Trash
} from 'lucide-react';
import { MissionService } from '../../services/mission';
import { DailyMissionReport, MissionStatus } from '../../models/mission';
import { useAuth } from '../../providers/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { DocumentSnapshot, doc, onSnapshot } from 'firebase/firestore';
import { db, auth, storage } from '../../services/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { getFreshUrlFromPathOrUrl } from '../../services/storage';

interface Props {
  batchId: string;
  onBack: () => void;
}

const SECTIONS_METADATA = [
  { id: 'section1', title: 'To Do List Submission', maxMarks: 20, icon: Layers, color: 'emerald', requirements: 'Completed To Do List, Daily Target Proof' },
  { id: 'section2', title: 'Rough Sheet Practice', maxMarks: 10, icon: FileText, color: 'rose', requirements: 'Rough Calculation Sheets, Practice Work' },
  { id: 'section3', title: 'Active Learning Reflection', maxMarks: 20, icon: BookOpen, color: 'amber', requirements: 'Learning Notes, Concept Understanding, Reflection, Key Learnings' },
  { id: 'section4', title: 'Backlog / Revision Covering', maxMarks: 10, icon: CheckCircle2, color: 'indigo', requirements: 'Revision Completed, Backlog Cleared' },
  { id: 'section5', title: 'Study Time Logging', maxMarks: 20, icon: Clock, color: 'sky', requirements: 'Total Study Hours, Study Screenshot, Study Report' },
  { id: 'section6', title: 'Error Register & Weakness Tracking', maxMarks: 20, icon: AlertTriangle, color: 'violet', requirements: 'Error Register, Weakness Register, Important Notes, Mistake Tracking' }
];

export default function MissionReviewWorkspace({ batchId, onBack }: Props) {
  const { userProfile } = useAuth();
  const [reports, setReports] = useState<DailyMissionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const [selectedReport, setSelectedReport] = useState<DailyMissionReport | null>(null);
  
  // Real-time synchronization for the currently selected report to avoid stale data during review
  useEffect(() => {
    if (!selectedReport?.id) return;
    
    const unsubscribe = onSnapshot(doc(db, 'dailyMissionReports', selectedReport.id), (snap) => {
      if (snap.exists()) {
        const updatedData = { ...snap.data(), id: snap.id } as DailyMissionReport;
        
        // Only update if something meaningful changed (avoid loops)
        setSelectedReport(prev => {
          if (!prev) return updatedData;
          if (JSON.stringify(prev.sections) !== JSON.stringify(updatedData.sections)) {
            return updatedData;
          }
          return prev;
        });
      }
    }, (err) => {
      console.warn("MissionReviewWorkspace: failed to listen to report in real-time:", err);
    });

    return () => unsubscribe();
  }, [selectedReport?.id]);

  // Legacy Report Evaluation states
  const [marks, setMarks] = useState<number>(50);
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState<MissionStatus>('Approved');
  
  // Section-by-Section Evaluation states (Key: sectionId, Value: { status, marks, remarks })
  const [globalStatus, setGlobalStatus] = useState<'Approved' | 'Rejected' | null>(null);
  const [globalManualScore, setGlobalManualScore] = useState<number | ''>('');
  const [globalRemarks, setGlobalRemarks] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState('Submitting Evaluations...');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; type: 'image' | 'pdf' | string; name: string; path?: string } | null>(null);

  const isMentor = userProfile?.role === 'mentor' || userProfile?.role === 'primary-mentor' || userProfile?.role === 'staff' || userProfile?.role === 'admin' || userProfile?.role === 'examiner';

  const handleDeleteReport = async () => {
    if (!selectedReport || !userProfile) return;
    
    setSubmitting(true);
    try {
      await MissionService.deleteReport(selectedReport.id!, userProfile.id || userProfile.id!);
      toast.success('Submission successfully deleted');
      
      // Move to next in list
      const currentIndex = reports.findIndex(r => r.id === selectedReport.id);
      const remaining = reports.filter(r => r.id !== selectedReport.id);
      setReports(remaining);
      setConfirmDelete(false);
      
      if (remaining.length > 0) {
        const nextToShow = remaining[currentIndex] || remaining[remaining.length - 1];
        selectReport(nextToShow);
      } else {
        setSelectedReport(null);
        if (hasMore) loadPendingReports(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete submission');
    } finally {
      setSubmitting(false);
    }
  };

  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [loadingUrl, setLoadingUrl] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Diagnostics panel states
  const [diagnostics, setDiagnostics] = useState<{
    storagePath: string;
    authStatus: string;
    userRole: string;
    downloadUrlStatus: string;
    exactException: string;
  }>({
    storagePath: 'N/A',
    authStatus: 'Unknown',
    userRole: 'Unknown',
    downloadUrlStatus: 'Not Started',
    exactException: ''
  });

  useEffect(() => {
    if (!previewAttachment) {
      setResolvedUrl('');
      setLoadingUrl(true);
      setLoadError(null);
      setDiagnostics({
        storagePath: 'N/A',
        authStatus: 'Unknown',
        userRole: 'Unknown',
        downloadUrlStatus: 'Not Started',
        exactException: ''
      });
      return;
    }
    
    let active = true;
    setLoadingUrl(true);
    setLoadError(null);

    // Initial state of diagnostics
    const initialPath = previewAttachment.path || previewAttachment.url || 'N/A';
    setDiagnostics({
      storagePath: initialPath,
      authStatus: auth.currentUser ? 'Signed In' : 'Not Signed In',
      userRole: userProfile?.role || 'Unknown',
      downloadUrlStatus: 'Initializing',
      exactException: ''
    });
    
    const resolve = async () => {
      let fresh = '';
      let targetPath = previewAttachment.path || '';
      
      // If path is not defined directly but we have a direct storage URL, decode the storage path
      if (!targetPath && previewAttachment.url) {
        const u = previewAttachment.url;
        if (u.startsWith('http://') || u.startsWith('https://')) {
          if (u.includes('/o/')) {
            try {
              const parts = u.split('/o/');
              if (parts.length > 1) {
                const encodedPath = parts[1].split('?')[0];
                targetPath = decodeURIComponent(encodedPath);
              }
            } catch (err) {
              console.warn("Could not parse storage path from URL in preview:", err);
            }
          }
        }
      }

      if (!targetPath) {
        targetPath = previewAttachment.url || '';
      }

      // Update diagnostics with resolved path
      if (active) {
        setDiagnostics(prev => ({ ...prev, storagePath: targetPath, downloadUrlStatus: 'Resolving' }));
      }

      const maxRetries = 3;
      let attempt = 0;
      let success = false;
      let lastErrorMessage = '';
      let lastErrorStackOrObj = '';

      while (attempt < maxRetries && !success && active) {
        attempt++;
        try {
          // 3. Verify mentor authentication state before requesting file.
          const currentUser = auth.currentUser;
          if (!currentUser) {
            throw new Error("Mentor is not authenticated in Firebase Auth. Please log in.");
          }

          // 15. Verify mentor login token is correctly attached to Storage requests.
          // Force refreshing token so Firebase Storage SDK automatically uses the latest valid credentials.
          const token = await currentUser.getIdToken(true);
          if (!token) {
            throw new Error("Could not acquire a valid secure Firebase login token for Storage requests.");
          }

          if (active) {
            setDiagnostics(prev => ({ ...prev, authStatus: 'Authenticated & Verified (Token Refreshed)' }));
          }

          // 5. Before rendering attachment: Verify user role is Mentor or Admin.
          const isUserAuthorized = 
            userProfile?.role === 'mentor' || 
            userProfile?.role === 'primary-mentor' || 
            userProfile?.role === 'staff' || 
            userProfile?.role === 'admin' ||
            isMentor;

          if (!isUserAuthorized) {
            throw new Error(`Access Denied: User role (${userProfile?.role || 'Unknown'}) is not authorized. Mentor or Admin required.`);
          }

          if (active) {
            setDiagnostics(prev => ({ ...prev, userRole: `${userProfile?.role} (Authorized)` }));
          }

          // 4/5. Generate fresh download URL using Firebase Storage SDK.
          // Ensure attachment access uses authenticated Firebase SDK access instead of anonymous direct URL requests.
          if (targetPath && !targetPath.startsWith('http://') && !targetPath.startsWith('https://')) {
            const fileRef = ref(storage, targetPath);
            fresh = await getDownloadURL(fileRef);
          } else {
            // Fallback to direct library URL if it is already an external URL
            fresh = await getFreshUrlFromPathOrUrl(targetPath);
          }

          if (active) {
            setResolvedUrl(fresh);
            setLoadingUrl(false);
            setDiagnostics(prev => ({ 
              ...prev, 
              downloadUrlStatus: `Success (Attempt ${attempt})`, 
              exactException: '' 
            }));
            success = true;
          }
        } catch (err: any) {
          lastErrorMessage = err.message || String(err);
          lastErrorStackOrObj = JSON.stringify(err) !== '{}' ? JSON.stringify(err) : String(err);
          
          if (err.code === 'storage/object-not-found') {
            console.warn(`Firebase Storage: Object not found at road/path "${targetPath}". Safely falling back to meta url.`);
            if (active) {
              setDiagnostics(prev => ({ 
                ...prev, 
                downloadUrlStatus: `Not Found (404)`,
                exactException: `Notice: Storage object does not exist on GCS server.`
              }));
              setResolvedUrl(previewAttachment.url || '');
              setLoadingUrl(false);
              setLoadError(null);
            }
            success = true;
            break;
          }

          // Log other exceptions safely as warnings since they are caught and handled
          console.warn(`Firebase Storage SDK Access Warning (Attempt ${attempt}/${maxRetries}) for path "${targetPath}":`, err);
          
          if (active) {
            setDiagnostics(prev => ({ 
              ...prev, 
              downloadUrlStatus: `Failed (Attempt ${attempt}/${maxRetries})`,
              exactException: `Error message: ${lastErrorMessage}\nStatus/Code: ${err.code || 'N/A'}\nServer error response: ${lastErrorStackOrObj}`
            }));
          }

          if (attempt < maxRetries && active) {
            // Wait 1.2 seconds before retrying
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      }

      if (!success && active) {
        // Fallback to original URL if all attempts fail
        setResolvedUrl(previewAttachment.url || '');
        setLoadingUrl(false);
        setLoadError(`Firebase Storage Access Denied: ${lastErrorMessage}`);
      }
    };

    resolve();
    return () => {
      active = false;
    };
  }, [previewAttachment, userProfile]);

  useEffect(() => {
    loadPendingReports();
  }, [batchId]);

  // Synchronise form states when selected report switches
  useEffect(() => {
    if (selectedReport) {
      if (selectedReport.sections) {
        const initialReviews: Record<string, any> = {};
        SECTIONS_METADATA.forEach(secDef => {
          const s = selectedReport.sections?.[secDef.id];
          initialReviews[secDef.id] = {
            status: s?.status || 'Pending',
            marks: s?.status === 'Approved' ? s.marks : (s?.submitted ? secDef.maxMarks : 0),
            remarks: s?.remarks || ''
          };
        });
        // We no longer set local section reviews because we use global evaluation
      } else {
        // Fallback/Legacy
        setRemarks(selectedReport.remarks || '');
        setMarks(selectedReport.marks || 0);
        setStatus(selectedReport.status || 'Approved');
      }
    }
  }, [selectedReport]);

  const loadPendingReports = async (isLoadMore = false) => {
    if (isLoadMore) setLoadMoreLoading(true);
    else setLoading(true);

    try {
      const result = await MissionService.getPendingReportsByBatch(batchId, isLoadMore ? lastVisible : null, 25);
      
      if (isLoadMore) {
        setReports(prev => {
           const map = new Map();
           prev.forEach(r => map.set(r.id, r));
           result.data.forEach(r => map.set(r.id, r));
           return Array.from(map.values());
        });
      } else {
        setReports(result.data);
        if (result.data.length > 0 && window.innerWidth >= 768) {
          selectReport(result.data[0]);
        }
      }
      
      setLastVisible(result.lastVisible);
      setHasMore(!!result.lastVisible && result.data.length >= 25);
      setIsSearching(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load pending reports');
    } finally {
      setLoading(false);
      setLoadMoreLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      loadPendingReports();
      return;
    }

    setIsSearching(true);
    setLoading(true);
    try {
      const isNumeric = /^\d+$/.test(searchTerm);
      const results = await MissionService.searchReports(searchTerm, isNumeric ? 'userMobile' : 'userName');
      
      setReports(results);
      setHasMore(false);
      if (results.length > 0) selectReport(results[0]);
      else setSelectedReport(null);
      
    } catch (e) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const selectReport = (report: DailyMissionReport) => {
    setSelectedReport(report);
    setConfirmDelete(false);
    setGlobalStatus(null);
    setGlobalManualScore('');
    setGlobalRemarks('');
    // Initialize section reviews with existing data if any, or defaults
    const initialReviews: Record<string, any> = {};
    if (report.sections) {
      Object.keys(report.sections).forEach(secId => {
        const sec = report.sections![secId];
        initialReviews[secId] = {
          status: sec.status || 'Pending',
          marks: sec.marks || 0,
          remarks: sec.remarks || ''
        };
      });
    }
    // We no longer set local section reviews because we use global evaluation
  };

  const handleReview = async () => {
    if (!selectedReport || !userProfile) return;
    
    if (selectedReport.sections && !globalStatus) {
      toast.error('Please select Approve or Reject');
      return;
    }

    setSubmitting(true);
    try {
      const currentReportId = selectedReport.id!;
      const currentUser = userProfile.id || userProfile.id!;

      // Optimistically move to next
      const currentIndex = reports.findIndex(r => r.id === currentReportId);
      const remaining = reports.filter(r => r.id !== currentReportId);
      
      if (selectedReport.sections) {
        let finalScore = totalSubmittedMarks;
        if (globalStatus === 'Rejected') {
          finalScore = 0;
        } else if (globalManualScore !== '') {
          finalScore = Number(globalManualScore);
        }

        const allReviewed: Record<string, any> = {};
        
        // Force all sections to globalStatus upon evaluation
        SECTIONS_METADATA.forEach((sec, idx) => {
            let allocated = 0;
            if (globalStatus === 'Rejected') {
              allocated = 0;
            } else {
              // Distribute finalScore amongst sections
              // For now, distribute simply based on maxMarks
              allocated = Math.round((sec.maxMarks / 100) * finalScore);
            }

            allReviewed[sec.id] = {
              status: globalStatus,
              marks: allocated,
              remarks: globalRemarks || (globalStatus === 'Approved' ? 'Evaluated' : 'Needs Work')
            };
        });

        await MissionService.reviewSectionsReport(currentReportId, currentUser, allReviewed as any);
        toast.success('Evaluation Submitted');
      } else {
        const currentStatus = status;
        const currentMarks = marks;
        const currentRemarks = remarks;
        await MissionService.reviewReport(currentReportId, {
          status: currentStatus,
          marks: currentMarks,
          remarks: currentRemarks,
          reviewedBy: currentUser
        });
        toast.success('Performance Assessment Submitted');
      }
      
      setReports(remaining);
      
      if (remaining.length > 0) {
        const nextToShow = remaining[currentIndex] || remaining[remaining.length - 1];
        selectReport(nextToShow);
      } else {
        setSelectedReport(null);
        if (hasMore) loadPendingReports(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit evaluation review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (!userProfile) return;

    setSubmitting(true);
    setSubmittingMessage('Initializing Bulk Approval...');
    try {
      for (let i = 0; i < reports.length; i++) {
        const report = reports[i];
        setSubmittingMessage(`Approving ${i + 1}/${reports.length}...`);
        
        if (report.sections) {
          const reviews: Record<string, any> = {};
          SECTIONS_METADATA.forEach(meta => {
            const section = report.sections?.[meta.id];
            if (section && section.submitted) {
              reviews[meta.id] = {
                status: 'Approved',
                marks: meta.maxMarks,
                remarks: 'Approved in bulk.'
              };
            } else {
              reviews[meta.id] = {
                status: section?.status || 'Not Submitted',
                marks: section?.marks || 0,
                remarks: section?.remarks || ''
              };
            }
          });
          await MissionService.reviewSectionsReport(report.id!, userProfile.id || userProfile.id!, reviews, report);
        } else {
          await MissionService.reviewReport(report.id!, {
            status: 'Approved',
            marks: report.marks ?? 50,
            remarks: 'Approved in bulk.',
            reviewedBy: userProfile.id || userProfile.id!
          });
        }
      }
      toast.success('Bulk Evaluations Submitted');
      setReports([]);
      setSelectedReport(null);
    } catch (e) {
      console.error(e);
      toast.error('Bulk submission failed');
    } finally {
      setSubmitting(false);
      setSubmittingMessage('Submitting Evaluations...');
    }
  };

  const getSectionColorClasses = (color: string) => {
    switch (color) {
      case 'emerald': return { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-700', border: 'border-emerald-100' };
      case 'rose': return { bg: 'bg-rose-50 text-rose-600', text: 'text-rose-700', border: 'border-rose-100' };
      case 'amber': return { bg: 'bg-amber-50 text-amber-600', text: 'text-amber-700', border: 'border-amber-100' };
      case 'indigo': return { bg: 'bg-indigo-50 text-indigo-600', text: 'text-indigo-700', border: 'border-indigo-100' };
      case 'sky': return { bg: 'bg-sky-50 text-sky-600', text: 'text-sky-700', border: 'border-sky-100' };
      case 'violet': return { bg: 'bg-violet-50 text-violet-600', text: 'text-violet-700', border: 'border-violet-100' };
      default: return { bg: 'bg-slate-50 text-slate-500', text: 'text-slate-700', border: 'border-slate-100' };
    }
  };

  const handleQuickEvaluate = async () => {
    if (!selectedReport?.sections || !userProfile) return;
    
    const allApproved: Record<string, any> = {};
    SECTIONS_METADATA.forEach(sec => {
      // Autofill all sections with max marks for quick evaluation
      allApproved[sec.id] = {
        status: 'Approved',
        marks: sec.maxMarks,
        remarks: 'Approved after quick review.'
      };
    });

    setSubmitting(true);
    try {
        const currentReportId = selectedReport.id!;
        const currentUser = userProfile.id || userProfile.id!;
        
        // Optimistically move to next
        const currentIndex = reports.findIndex(r => r.id === currentReportId);
        const remaining = reports.filter(r => r.id !== currentReportId);
        
        MissionService.reviewSectionsReport(currentReportId, currentUser, allApproved as any).catch(e => console.error(e));
        toast.success('Quick Evaluation Submitted');
        
        setReports(remaining);
        
        if (remaining.length > 0) {
          const nextToShow = remaining[currentIndex] || remaining[remaining.length - 1];
          selectReport(nextToShow);
        } else {
          setSelectedReport(null);
          if (hasMore) loadPendingReports(true);
        }
    } catch (e) {
        toast.error('Failed to submit quick evaluation');
    } finally {
        setSubmitting(false);
    }
  };

  // Helper lists for legacy UI
  const quickMarks = [50, 40, 30, 20, 10, 0];
  const statuses: { label: string, value: MissionStatus, color: string }[] = [
    { label: 'Approve', value: 'Approved', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: 'Resubmit', value: 'Resubmit Required', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: 'Reject', value: 'Rejected', color: 'bg-rose-50 text-rose-600 border-rose-100' },
    { label: 'Late', value: 'Late Submission', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    { label: 'Emergency', value: 'Emergency Leave', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { label: 'Protected', value: 'Protected Day', color: 'bg-sky-50 text-sky-600 border-sky-100' },
  ];

  if (loading && !loadMoreLoading && !reports.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 font-sans">
        <Loader2 className="animate-spin text-indigo-600 w-10 h-10 mb-2" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Constructing Workspace...</p>
      </div>
    );
  }

  const totalSubmittedMarks = selectedReport?.sections ? SECTIONS_METADATA.reduce((sum, sec) => {
    const s = selectedReport.sections?.[sec.id];
    const evidence = s && s.submitted && (s.attachments && s.attachments.length > 0 || (s.notes && s.notes.trim() !== ''));
    return sum + (evidence ? sec.maxMarks : 0);
  }, 0) : 100;

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] bg-slate-50 font-sans">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center space-x-4">
           {selectedReport ? (
             <button onClick={() => setSelectedReport(null)} className="p-2 bg-slate-50 rounded-xl text-slate-400 md:hidden">
               <ChevronLeft size={20} />
             </button>
           ) : (
             <button onClick={onBack} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:bg-slate-100 transition-all">
               <ArrowLeft size={20} />
             </button>
           )}
           <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Evaluate</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {isSearching ? 'Search Results' : `${reports.length}${hasMore ? '+' : ''} reports pending evaluation`}
              </p>
           </div>
        </div>
        <button 
          onClick={() => loadPendingReports()}
          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <RefreshCw size={20} className={loading && !loadMoreLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {reports.length > 0 && !selectedReport && (
        <div className="bg-emerald-50 px-6 py-2 border-b border-emerald-100 flex items-center justify-between">
          <p className="text-[10px] font-black text-emerald-700 uppercase">Available Actions</p>
          <button 
            onClick={handleBulkApprove}
            disabled={submitting}
            className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-2"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {submitting ? submittingMessage : 'Bulk Approve All Pending'}
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Pending List */}
        <div className={`${selectedReport ? 'hidden md:block' : 'w-full'} md:w-1/3 border-r border-slate-100 bg-white flex flex-col transition-all duration-300 shadow-sm`}>
           {/* Search Input */}
           <div className="p-4 border-b border-slate-50">
              <form onSubmit={handleSearch} className="relative group">
                 <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                 <input 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   placeholder="Search Student Mobile or Name..."
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
                 />
                 {searchTerm && (
                   <button 
                     type="button" 
                     onClick={() => { setSearchTerm(''); loadPendingReports(); }}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                   >
                     <X size={14} />
                   </button>
                 )}
              </form>
           </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-2">
             {reports.map((r) => (
                 <button 
                   key={r.id}
                   onClick={() => selectReport(r)}
                   className={`w-full text-left p-4 rounded-2xl border transition-all ${
                     selectedReport?.id === r.id 
                     ? 'bg-indigo-50 border-indigo-200 shadow-xs' 
                     : 'bg-white border-transparent hover:bg-slate-50 shadow-xs'
                   }`}
                 >
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                          {r.userPhoto ? <img src={r.userPhoto} className="w-full h-full object-cover" /> : <User className="text-slate-300" />}
                       </div>
                       <div className="truncate flex-1">
                          <p className="font-bold text-sm text-slate-900 truncate">{r.userName || 'Anonymous Student'}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {r.batchId ? `${r.batchId} • ` : ''}
                            {r.sections ? (
                               <span className="text-indigo-600 font-black">Structured Grid</span>
                            ) : (
                               'Legacy Direct'
                            )}
                          </p>
                       </div>
                       <ChevronRight size={14} className="text-slate-300 md:hidden" />
                    </div>
                 </button>
              ))}
              
              {hasMore && (
                <button 
                  onClick={() => loadPendingReports(true)}
                  disabled={loadMoreLoading}
                  className="w-full py-4 text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:bg-indigo-50 rounded-2xl transition-colors border border-dashed border-indigo-100 flex items-center justify-center gap-2"
                >
                  {loadMoreLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {loadMoreLoading ? 'Loading More...' : 'Load More Pending'}
                </button>
              )}

              {reports.length === 0 && !loading && (
                <div className="text-center py-20 text-slate-300">
                   <CheckCircle2 className="mx-auto mb-2 opacity-20 text-emerald-500 animate-pulse" size={48} />
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inbox Zero</p>
                   <p className="text-[8px] font-medium text-slate-400 mt-1 uppercase">All pending reports evaluated</p>
                </div>
              )}
           </div>
        </div>

        {/* Right Content: Review Workspace */}
        <div className={`flex-1 overflow-y-auto bg-slate-50 relative p-4 md:p-6 ${selectedReport ? 'block' : 'hidden md:block'}`}>
           <AnimatePresence mode="wait">
              {selectedReport ? (
                <motion.div 
                  key={selectedReport.id}
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="max-w-3xl mx-auto space-y-6 pb-20"
                >
                  {/* Student Header */}
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
                     <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                           {selectedReport.userPhoto ? <img src={selectedReport.userPhoto} className="w-full h-full object-cover" /> : <User className="w-full h-full p-4 text-slate-300" />}
                        </div>
                        <div className="truncate">
                           <h2 className="text-lg font-black text-slate-900 truncate">{selectedReport.userName}</h2>
                           <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{selectedReport.userMobile || 'No contact added'}</p>
                           <div className="flex items-center gap-2 mt-1">
                              <Calendar size={12} className="text-slate-400" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Day: {selectedReport.date}</span>
                           </div>
                        </div>
                     </div>
                     <div className="text-right w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-3 font-sans">
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Submitted</p>
                           <p className="text-xs font-black text-slate-900">{selectedReport.submittedAt ? new Date(selectedReport.submittedAt).toLocaleTimeString() : 'Unknown Time'}</p>
                        </div>
                        {isMentor && (
                           <div className="mt-2 flex items-center gap-2">
                              {confirmDelete ? (
                                 <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-1.5 rounded-2xl">
                                    <button
                                       onClick={handleDeleteReport}
                                       className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-xs"
                                    >
                                       Confirm
                                    </button>
                                    <button
                                       onClick={() => setConfirmDelete(false)}
                                       className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all"
                                    >
                                       Cancel
                                    </button>
                                 </div>
                              ) : (
                                 <button
                                    onClick={() => setConfirmDelete(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-rose-200"
                                    title="Delete this student submission from database"
                                 >
                                    <Trash2 size={12} />
                                    Delete Submission
                                 </button>
                              )}
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Global Evaluation layout */}
                  {selectedReport.sections ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                          Student Submission Proofs (Max 100 Marks)
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                        {SECTIONS_METADATA.map((secDef) => {
                          const sData = selectedReport.sections?.[secDef.id];
                          const colors = getSectionColorClasses(secDef.color);
                          
                          // Always use full view so mentor can check contents even if not submitted
                          
                          return (
                            <div key={secDef.id} className={`bg-white rounded-xl border p-2 shadow-sm flex flex-col space-y-1.5 ring-1 ${sData?.submitted ? 'border-slate-150 ring-slate-100' : 'border-slate-100 ring-transparent opacity-80'}`}>
                              {/* Section title & Quick Action */}
                              <div className="flex flex-col items-start gap-1">
                                <div className="flex items-center justify-between w-full">
                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${colors.bg}`}>
                                    <secDef.icon size={12} />
                                  </div>
                                  <div className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-nowrap border border-indigo-100">
                                    {secDef.maxMarks} pt
                                  </div>
                                </div>
                                <h4 className="font-black text-[9px] text-slate-900 tracking-tight leading-tight line-clamp-2 mt-0.5">{secDef.title}</h4>
                                {!sData?.submitted && (
                                  <span className="px-1 py-0.5 bg-slate-100 text-slate-400 text-[7px] font-black uppercase rounded text-nowrap">Not Submitted</span>
                                )}
                              </div>

                              {/* Submitted content - prominent display */}
                              <div className="flex-1 p-1.5 bg-slate-50/80 border border-slate-100 rounded-lg flex flex-col space-y-1.5 overflow-hidden">
                                {sData?.notes && (
                                  <div className="bg-white p-1.5 rounded-md border border-slate-100 shadow-xs max-h-12 overflow-y-auto">
                                    <p className="text-[8px] text-slate-800 font-bold leading-tight whitespace-pre-wrap">
                                      "{sData.notes}"
                                    </p>
                                  </div>
                                )}

                                {sData?.attachments && sData.attachments.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {sData.attachments.map((at, atIdx) => (
                                      <button 
                                        key={atIdx}
                                        type="button"
                                        onClick={() => setPreviewAttachment({ url: at.url, type: at.type, name: at.name, path: at.path })}
                                        className="w-7 h-7 bg-white border border-slate-200 rounded-md relative group overflow-hidden hover:border-indigo-400 transition-colors shadow-xs shrink-0"
                                      >
                                        {at.type === 'image' ? (
                                          <img src={at.url} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-rose-50">
                                            <FileText className="text-rose-500 w-3.5 h-3.5" />
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[8px] font-bold text-slate-400 italic py-1">No evidence.</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Global Evaluation & Authorization Submit */}
                      <div className="bg-white p-6 rounded-3xl border border-indigo-100 space-y-5 shadow-sm">
                         <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                            <div>
                               <h3 className="text-sm font-black text-slate-900 tracking-tight">Final Evaluation</h3>
                               <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Authorize overall performance</p>
                            </div>
                            <div className="bg-indigo-50 text-indigo-700 px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase">
                              100 Max Points
                            </div>
                         </div>
                         
                         {/* 3 Main Opinions */}
                         <div className="flex flex-col gap-3">
                            <button
                               onClick={() => {
                                  setGlobalStatus('Approved');
                                  setGlobalManualScore('');
                               }}
                               className={`flex flex-col items-center justify-center py-4 rounded-2xl border-2 transition-all ${globalStatus === 'Approved' && globalManualScore === '' ? 'border-emerald-500 bg-emerald-50 shadow-md scale-[1.02]' : 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50'}`}
                            >
                               <span className={`text-sm font-black ${globalStatus === 'Approved' && globalManualScore === '' ? 'text-emerald-700' : 'text-slate-600'}`}>Approve ({totalSubmittedMarks} Marks)</span>
                               <span className={`text-[10px] font-bold mt-1 ${globalStatus === 'Approved' && globalManualScore === '' ? 'text-emerald-600/80' : 'text-slate-400'}`}>Real Submitted Score</span>
                            </button>

                            <button
                               onClick={() => {
                                  setGlobalStatus('Rejected');
                                  setGlobalManualScore('');
                               }}
                               className={`flex flex-col items-center justify-center py-4 rounded-2xl border-2 transition-all ${globalStatus === 'Rejected' ? 'border-rose-500 bg-rose-50 shadow-md scale-[1.02]' : 'border-slate-100 hover:border-rose-200 hover:bg-rose-50/50'}`}
                            >
                               <span className={`text-sm font-black ${globalStatus === 'Rejected' ? 'text-rose-700' : 'text-slate-600'}`}>Reject</span>
                               <span className={`text-[10px] font-bold mt-1 ${globalStatus === 'Rejected' ? 'text-rose-600/80' : 'text-slate-400'}`}>0 Marks</span>
                            </button>

                            <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${globalStatus === 'Approved' && globalManualScore !== '' ? 'border-indigo-500 bg-indigo-50 shadow-md scale-[1.02]' : 'border-slate-100 focus-within:border-indigo-300 hover:border-indigo-200'}`}>
                               <span className={`text-xs font-black mb-1.5 ${globalStatus === 'Approved' && globalManualScore !== '' ? 'text-indigo-700' : 'text-slate-600'}`}>Manual Score</span>
                               <div className="flex items-center gap-1">
                                 <input
                                   type="number"
                                   min="0"
                                   max="100"
                                   placeholder="100"
                                   value={globalManualScore}
                                   onChange={e => {
                                      setGlobalStatus('Approved');
                                      setGlobalManualScore(e.target.value === '' ? '' : Number(e.target.value));
                                   }}
                                   className="w-16 h-8 text-center text-sm font-black text-indigo-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                 />
                                 <span className="text-[10px] font-bold text-slate-400">/ 100</span>
                               </div>
                            </div>
                         </div>

                         {/* Remarks */}
                         <div>
                            <input 
                              type="text"
                              value={globalRemarks}
                              onChange={e => setGlobalRemarks(e.target.value)}
                              placeholder="Add optional final remarks..."
                              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl transition-all"
                            />
                         </div>

                         <div className="flex gap-2 pt-2">
                           <button 
                             onClick={handleReview}
                             disabled={submitting || !globalStatus}
                             className={`flex-1 py-4.5 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${globalStatus ? 'bg-slate-950 hover:bg-slate-900 active:scale-[0.98]' : 'bg-slate-300 cursor-not-allowed'}`}
                           >
                             {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                             {submitting ? 'Submitting...' : (
                                globalStatus === 'Rejected' ? 'Confirm Rejection (0 Marks)' :
                                globalManualScore !== '' ? `Approve Manual Score (${globalManualScore} Marks)` :
                                `Authorize Approve (${totalSubmittedMarks} Marks)`
                              )}
                           </button>
                         </div>
                      </div>
                    </div>
                  ) : (
                    /* Legacy single-upload review view fallback */
                    <div className="space-y-6">
                      {/* Attachments Section */}
                      <div className="space-y-4">
                         <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Legacy Attachments ({selectedReport.attachments.length})</h3>
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {selectedReport.attachments.map((at, idx) => (
                              <button 
                                key={idx} 
                                type="button"
                                onClick={() => setPreviewAttachment({ url: at.url, type: at.type, name: at.name, path: at.path })}
                                className="group relative aspect-square bg-white rounded-3xl border border-slate-200 overflow-hidden hover:ring-4 hover:ring-indigo-100 transition-all shadow-sm w-full cursor-pointer text-left focus:outline-none"
                              >
                                 {at.type === 'image' ? (
                                   <img src={at.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                 ) : (
                                   <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                      <FileText size={40} className="text-rose-500 mb-2" />
                                      <p className="text-[10px] font-bold text-slate-600 text-center truncate w-full">{at.name}</p>
                                   </div>
                                 )}
                                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <ExternalLink className="text-white" size={24} />
                                 </div>
                              </button>
                            ))}
                         </div>
                      </div>

                      {/* Note Section */}
                      {selectedReport.note && (
                        <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
                           <div className="flex items-center gap-2 mb-3">
                              <MessageSquare size={16} className="text-indigo-500" />
                              <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Student Notes</span>
                           </div>
                           <p className="text-sm text-slate-700 font-medium leading-relaxed italic">"{selectedReport.note}"</p>
                        </div>
                      )}

                      {/* Evaluation Panel */}
                      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl space-y-8">
                         <div className="flex items-center gap-3">
                            <Award className="text-amber-500" />
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Legacy Evaluation Model (Max 50)</h3>
                         </div>

                         {/* Status Selection */}
                         <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mission Outcome</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                               {statuses.map(s => (
                                 <button 
                                   key={s.value}
                                   onClick={() => setStatus(s.value)}
                                   className={`p-3 rounded-2xl border text-[10px] font-black uppercase tracking-tighter transition-all ${
                                     status === s.value ? s.color : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                                   }`}
                                 >
                                    {s.label}
                                 </button>
                               ))}
                            </div>
                         </div>

                         {/* Scoring Section */}
                         <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mission Marks (Max 50)</label>
                               <span className="text-2xl font-black text-indigo-600">{marks}</span>
                            </div>
                            <div className="flex gap-2">
                               {quickMarks.map(m => (
                                 <button 
                                   key={m}
                                   type="button"
                                   onClick={() => setMarks(m)}
                                   className={`flex-1 py-3 rounded-2xl border font-black text-sm transition-all ${
                                     marks === m ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                                   }`}
                                 >
                                    {m}
                                 </button>
                               ))}
                            </div>
                            <input 
                              type="range" min="0" max="50" step="1"
                              value={marks}
                              onChange={e => setMarks(Number(e.target.value))}
                              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                         </div>

                         {/* Remarks Section */}
                         <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mentor Remarks</label>
                            <textarea 
                              value={remarks}
                              onChange={e => setRemarks(e.target.value)}
                              placeholder="Provide constructive feedback, encouragement, or specific observations..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-5 text-sm font-medium focus:ring-4 focus:ring-indigo-50 outline-none min-h-[120px] transition-all"
                            />
                         </div>

                         {/* Submit Button */}
                         <button 
                           onClick={handleReview}
                           disabled={submitting}
                           className="w-full py-5 bg-slate-950 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                         >
                            {submitting ? <Clock className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                            {submitting ? 'Finalizing Evaluation...' : 'Authorize Performance'}
                         </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                   <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-6">
                      <Target size={48} />
                   </div>
                   <h2 className="text-2xl font-black text-slate-900 mb-2">Workspace Empty</h2>
                   <p className="text-xs text-slate-500 max-w-sm uppercase tracking-wider">Select a pending mission report from the sidebar to begin your professional evaluation.</p>
                </div>
              )}
           </AnimatePresence>
        </div>
      </div>

      {/* Premium Attachment Preview Modal */}
      <AnimatePresence>
        {previewAttachment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setPreviewAttachment(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  {previewAttachment.type === 'image' ? (
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <ImageIcon size={18} />
                    </div>
                  ) : (
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                      <FileText size={18} />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-black text-slate-800 truncate max-w-[250px] sm:max-w-md font-sans">
                      {previewAttachment.name || 'Attachment'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      {previewAttachment.type || 'unknown'} format
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {resolvedUrl && (
                    <a 
                      href={resolvedUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                      title="Open in new window"
                    >
                      <ExternalLink size={18} />
                    </a>
                  )}
                  <button 
                    onClick={() => setPreviewAttachment(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-6 bg-slate-50/50 flex flex-col justify-between min-h-[350px]">
                <div className="flex-1 flex flex-col justify-center items-center min-h-[250px] w-full mb-6">
                  {loadingUrl ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="animate-spin text-indigo-600" size={32} />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse font-mono">Resolving Secure Link...</p>
                    </div>
                  ) : loadError ? (
                    <div className="text-center max-w-md p-6 bg-white border border-rose-100 rounded-3xl shadow-sm space-y-4">
                      <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-[1.25rem] flex items-center justify-center mx-auto">
                        <AlertTriangle size={32} />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-base font-black text-slate-900 font-sans">Attachment unavailable</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed font-sans block">
                          This file cannot be retrieved securely. This can happen due to expired download tokens or direct URL access restrictions.
                        </p>
                      </div>
                      <div className="p-3 bg-rose-50/30 border border-rose-50 rounded-2xl text-left">
                        <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1 font-mono">Detailed Access Error:</p>
                        <p className="text-[10px] font-mono text-slate-600 break-all leading-normal whitespace-pre-wrap">
                          Error Reason: {loadError}
                          {"\n"}File Path: {previewAttachment.path || 'N/A'}
                          {"\n"}Direct URL: {resolvedUrl}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            setLoadError(null);
                            setLoadingUrl(true);
                            setPreviewAttachment({ ...previewAttachment });
                          }}
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer font-sans"
                        >
                          Try Refreshing
                        </button>
                        <a 
                          href={resolvedUrl || previewAttachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-black text-xs uppercase tracking-wider rounded-2xl transition-all text-center font-sans"
                        >
                          Try Direct Link
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      {previewAttachment.type === 'image' || previewAttachment.name.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) ? (
                        <div className="relative max-w-full max-h-[50vh] rounded-2xl overflow-hidden shadow-sm bg-white p-2 border border-slate-100 flex items-center justify-center">
                          <img 
                            src={resolvedUrl} 
                            alt={previewAttachment.name} 
                            className="max-h-[45vh] max-w-full object-contain rounded-xl select-none"
                            onError={(e) => {
                              const errorMsg = "Permission Denied or Frame Block - GCS Storage Rules block public unauthenticated reads.";
                              setLoadError(errorMsg);
                              console.warn("Firebase Storage Image Load Exception:", resolvedUrl, "Reason:", errorMsg);
                            }}
                          />
                        </div>
                      ) : previewAttachment.type === 'pdf' || previewAttachment.name.match(/\.pdf$/i) ? (
                        <div className="w-full h-[50vh] flex flex-col gap-4 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white p-1">
                          <iframe 
                            src={resolvedUrl} 
                            title={previewAttachment.name}
                            className="w-full h-full border-none rounded-xl bg-slate-50"
                          />
                          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                            <span className="text-[10px] text-slate-500 font-semibold">PDF loaded inside frame. If not visible, use Google Docs viewer fallback:</span>
                            <a 
                              href={`https://docs.google.com/viewer?url=${encodeURIComponent(resolvedUrl)}&embedded=true`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-all font-sans"
                            >
                              Google Docs Viewer
                            </a>
                          </div>
                        </div>
                      ) : (
                        // Support other formats with file viewer card
                        <div className="text-center max-w-md p-8 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
                          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                            <FileText size={32} />
                          </div>
                          <div className="space-y-1 font-sans">
                            <h4 className="text-base font-black text-slate-800 font-sans">{previewAttachment.name}</h4>
                            <p className="text-xs text-slate-400 font-medium font-sans">This file format is not natively previewable in-browser.</p>
                          </div>
                          <a 
                            href={resolvedUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-sm font-sans"
                          >
                            <ExternalLink size={14} /> Open in browser
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 10. Attachment diagnostics panel */}
                <div className="border-t border-slate-100 bg-slate-100/50 -mx-6 -mb-6 p-4 rounded-b-3xl">
                  <div className="flex items-center justify-between mb-2 border-b border-slate-200/50 pb-1.5">
                    <h4 className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">Attachment Diagnostics Dashboard</h4>
                    <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded-md">Live Storage Check</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 min-w-0">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono">Storage Path</p>
                      <p className="text-[9px] font-semibold text-slate-700 truncate font-mono mt-0.5" title={diagnostics.storagePath}>
                        {diagnostics.storagePath}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono">Authentication Status</p>
                      <span className={`inline-block text-[9px] font-bold mt-0.5 font-mono ${diagnostics.authStatus.includes('Verified') ? 'text-emerald-600' : 'text-rose-500'}`}>
                        ● {diagnostics.authStatus}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono">Role Status</p>
                      <span className={`inline-block text-[9px] font-bold mt-0.5 font-mono ${diagnostics.userRole.includes('Authorized') ? 'text-indigo-600' : 'text-slate-500'}`}>
                        ● {diagnostics.userRole}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono">Download URL Status</p>
                      <span className={`inline-block text-[9px] font-bold mt-0.5 font-mono ${diagnostics.downloadUrlStatus.includes('Success') ? 'text-emerald-600' : diagnostics.downloadUrlStatus.includes('Failed') ? 'text-rose-500' : 'text-amber-500'}`}>
                        ● {diagnostics.downloadUrlStatus}
                      </span>
                    </div>
                  </div>
                  {diagnostics.exactException && (
                    <div className="mt-2 p-2 bg-rose-50/50 border border-rose-100 rounded-lg">
                      <p className="text-[8px] font-black text-rose-700 uppercase tracking-wider font-mono mb-0.5">Last Logged GCS Storage Exception:</p>
                      <p className="text-[9px] font-mono text-slate-600 break-all whitespace-pre-wrap leading-tight">{diagnostics.exactException}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
