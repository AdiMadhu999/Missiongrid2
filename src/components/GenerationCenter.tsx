import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  XCircle, 
  CheckCircle2, 
  Clock, 
  Terminal, 
  FileText, 
  Layers, 
  Loader2, 
  Play, 
  Trash2, 
  AlertTriangle, 
  X,
  ExternalLink,
  BookOpen,
  HelpCircle,
  Activity,
  Eye
} from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { downloadPdfStream } from '../utils/downloadHelper';

export interface GenerationJob {
  id: string;
  jobType?: 'ingestion' | 'study_material';
  createdBy?: string;
  topic?: string;
  tone?: string;
  depth?: string;
  language?: string;
  status: 'queued' | 'reading' | 'ocr' | 'cleaning' | 'extracting' | 'compiling' | 'generating' | 'formatting' | 'uploading' | 'completed' | 'failed' | 'cancelled' | 'paused_budget';
  stage?: string;
  etaSeconds?: number;
  percent: number;
  logs: string[];
  steps?: string[];
  pdfUrl?: string;
  pdfFilename?: string;
  pdfSize?: string;
  pdfUrlBn?: string;
  pdfFilenameBn?: string;
  pdfSizeBn?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

interface GenerationCenterProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const GenerationCenter: React.FC<GenerationCenterProps> = ({ onClose, isModal = false }) => {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'study' | 'ingestion' | 'running' | 'completed'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<GenerationJob | null>(null);
  const [previewEdition, setPreviewEdition] = useState<'english' | 'bengali'>('english');

  const fetchJobs = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';

      // Fetch study material background jobs
      const studyRes = await fetch('/api/mentor/study-jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const studyJobs: GenerationJob[] = studyRes.ok ? await studyRes.json() : [];

      // Fetch test ingestion active jobs
      const activeIngestRes = await fetch('/api/ai/active-jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const ingestJobsData = activeIngestRes.ok ? await activeIngestRes.json() : [];
      const ingestJobs: GenerationJob[] = Array.isArray(ingestJobsData) ? ingestJobsData : Object.values(ingestJobsData || {});

      // Merge and sort jobs by creation time
      const allMerged = [...studyJobs, ...ingestJobs.filter(j => !studyJobs.some(s => s.id === j.id))];
      allMerged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setJobs(allMerged);
    } catch (err) {
      console.error("Failed to load background generation jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2500); // Polling every 2.5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleCancelJob = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      const auth = getAuth();
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      await fetch(`/api/mentor/study-jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchJobs();
    } catch (err) {
      console.error("Cancel failed:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      const auth = getAuth();
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      await fetch(`/api/mentor/study-jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchJobs();
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      const auth = getAuth();
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      await fetch(`/api/mentor/study-jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadPdf = async (url: string, filename: string) => {
    try {
      await downloadPdfStream(url, filename);
    } catch (err) {
      console.warn("Blob download fallback:", err);
      window.open(url, '_blank');
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (activeTab === 'study') return job.jobType === 'study_material';
    if (activeTab === 'ingestion') return job.jobType === 'ingestion' || !job.jobType;
    if (activeTab === 'running') return ['queued', 'reading', 'ocr', 'cleaning', 'extracting', 'compiling', 'generating', 'formatting', 'uploading'].includes(job.status);
    if (activeTab === 'completed') return job.status === 'completed';
    return true;
  });

  const runningCount = jobs.filter(j => ['queued', 'reading', 'ocr', 'cleaning', 'extracting', 'compiling', 'generating', 'formatting', 'uploading'].includes(j.status)).length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <div className={`bg-slate-900 text-slate-100 flex flex-col ${isModal ? 'h-[85vh] max-h-[750px] w-full rounded-2xl border border-slate-800 shadow-2xl overflow-hidden' : 'min-h-screen p-4 sm:p-6'}`}>
      
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white tracking-tight">AI Generation Center</h2>
              {runningCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                  <Activity className="w-3 h-3 mr-1 animate-spin" /> {runningCount} Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Non-blocking asynchronous background processing queue for Study Material PDFs & AI Tests
            </p>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 bg-slate-950/30 border-b border-slate-800/60">
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/80">
          <span className="text-xs text-slate-400 block font-medium">Total Pipeline Jobs</span>
          <span className="text-xl font-bold text-white mt-0.5 block">{jobs.length}</span>
        </div>
        <div className="bg-indigo-950/30 rounded-xl p-3 border border-indigo-800/30">
          <span className="text-xs text-indigo-300 block font-medium">Processing Now</span>
          <span className="text-xl font-bold text-indigo-400 mt-0.5 block">{runningCount}</span>
        </div>
        <div className="bg-emerald-950/30 rounded-xl p-3 border border-emerald-800/30">
          <span className="text-xs text-emerald-300 block font-medium">Completed PDFs</span>
          <span className="text-xl font-bold text-emerald-400 mt-0.5 block">{completedCount}</span>
        </div>
        <div className="bg-rose-950/30 rounded-xl p-3 border border-rose-800/30">
          <span className="text-xs text-rose-300 block font-medium">Attention Required</span>
          <span className="text-xl font-bold text-rose-400 mt-0.5 block">{failedCount}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center space-x-1.5 min-w-max">
          {[
            { id: 'all', label: `All Jobs (${jobs.length})` },
            { id: 'study', label: `Study Guides (${jobs.filter(j => j.jobType === 'study_material').length})` },
            { id: 'ingestion', label: `Test Ingestions (${jobs.filter(j => j.jobType === 'ingestion' || !j.jobType).length})` },
            { id: 'running', label: `In Progress (${runningCount})` },
            { id: 'completed', label: `Completed (${completedCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button 
          onClick={fetchJobs} 
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Refresh Queue"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Job Cards Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm">Connecting to generation queue...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
            <BookOpen className="w-12 h-12 text-slate-600 mb-3 stroke-[1.5]" />
            <p className="text-base font-semibold text-slate-300">No background jobs in queue</p>
            <p className="text-xs text-slate-500 max-w-sm text-center mt-1">
              Start generating Study Material PDFs or AI Mock Tests to monitor non-blocking progress here in real-time.
            </p>
          </div>
        ) : (
          filteredJobs.map(job => {
            const isRunning = ['queued', 'reading', 'ocr', 'cleaning', 'extracting', 'compiling', 'generating', 'formatting', 'uploading'].includes(job.status);
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed';
            const isCancelled = job.status === 'cancelled';

            return (
              <div 
                key={job.id} 
                className={`bg-slate-950/70 border rounded-2xl p-5 transition-all ${
                  isRunning 
                    ? 'border-indigo-500/40 shadow-lg shadow-indigo-500/5' 
                    : isCompleted 
                    ? 'border-emerald-500/30' 
                    : isFailed 
                    ? 'border-rose-500/30' 
                    : 'border-slate-800'
                }`}
              >
                {/* Job Title & Badges */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2.5 rounded-xl mt-0.5 ${
                      job.jobType === 'study_material' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    }`}>
                      {job.jobType === 'study_material' ? <BookOpen className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-white tracking-tight">
                          {job.topic || "AI Content Generation Job"}
                        </h3>
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {job.jobType === 'study_material' ? 'Study Guide PDF' : 'Test Ingestion'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>Created {new Date(job.createdAt).toLocaleTimeString()}</span>
                        {job.language && <span>• Language: {job.language}</span>}
                        {job.tone && <span>• Tone: {job.tone}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isRunning && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        {job.stage || 'Processing...'}
                      </span>
                    )}
                    {isCompleted && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                        Ready
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                        Failed
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">{job.stage || 'Pipeline Active'}</span>
                    <div className="flex items-center space-x-3">
                      {isRunning && job.etaSeconds !== undefined && job.etaSeconds > 0 && (
                        <span className="text-indigo-400 flex items-center font-mono">
                          <Clock className="w-3 h-3 mr-1" /> ETA ~{job.etaSeconds}s
                        </span>
                      )}
                      <span className="font-bold text-white font-mono">{job.percent}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                          : isFailed 
                          ? 'bg-rose-500' 
                          : isCancelled 
                          ? 'bg-slate-600' 
                          : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 animate-pulse'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, job.percent))}%` }}
                    />
                  </div>
                </div>

                {/* Error Message callout if failed */}
                {isFailed && job.error && (
                  <div className="mt-3 p-3 bg-rose-950/40 border border-rose-800/40 rounded-xl text-xs text-rose-300">
                    <p className="font-semibold text-rose-200">Failure Reason:</p>
                    <p className="mt-0.5">{job.error}</p>
                  </div>
                )}

                {/* Bottom Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setExpandedLogId(expandedLogId === job.id ? null : job.id)}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors border border-slate-700/60"
                    >
                      <Terminal className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                      {expandedLogId === job.id ? 'Hide Logs' : `Logs (${job.logs?.length || 0})`}
                    </button>

                    {job.pdfSize && (
                      <span className="text-xs text-slate-400 font-mono">
                        Size: {job.pdfSize}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Action: Preview PDF */}
                    {isCompleted && (job.pdfUrl || job.pdfUrlBn) && (
                      <button
                        onClick={() => {
                          setPreviewEdition(job.pdfUrl ? 'english' : 'bengali');
                          setPreviewJob(job);
                        }}
                        className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer shadow-sm hover:text-amber-300"
                      >
                        <Eye className="w-4 h-4 mr-1.5 text-amber-400" />
                        Preview PDF
                      </button>
                    )}

                    {/* Action: Download English PDF */}
                    {isCompleted && job.pdfUrl && (
                      <button
                        onClick={() => handleDownloadPdf(job.pdfUrl!, job.pdfFilename || 'MissionGrid_English_Edition.pdf')}
                        className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        📘 English Edition
                      </button>
                    )}

                    {/* Action: Download Bengali PDF */}
                    {isCompleted && job.pdfUrlBn && (
                      <button
                        onClick={() => handleDownloadPdf(job.pdfUrlBn!, job.pdfFilenameBn || 'MissionGrid_Bengali_Edition.pdf')}
                        className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        📗 Bengali Edition
                      </button>
                    )}

                    {/* Action: Cancel Job */}
                    {isRunning && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        disabled={actionLoadingId === job.id}
                        className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-rose-600/20 hover:border-rose-500/40 transition-colors border border-slate-700"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                        Cancel
                      </button>
                    )}

                    {/* Action: Retry Job */}
                    {(isFailed || isCancelled) && (
                      <button
                        onClick={() => handleRetryJob(job.id)}
                        disabled={actionLoadingId === job.id}
                        className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md shadow-indigo-600/20"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${actionLoadingId === job.id ? 'animate-spin' : ''}`} />
                        Retry Generation
                      </button>
                    )}

                    {/* Action: Delete / Dismiss */}
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      disabled={actionLoadingId === job.id}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Dismiss Job"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable Live Terminal Logs */}
                {expandedLogId === job.id && (
                  <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto space-y-1">
                    <p className="text-slate-500 text-[10px] uppercase font-sans font-bold border-b border-slate-800/80 pb-1 mb-1">
                      Execution Terminal Logs
                    </p>
                    {job.logs && job.logs.length > 0 ? (
                      job.logs.map((log, idx) => (
                        <p key={idx} className="leading-relaxed text-slate-300">
                          {log}
                        </p>
                      ))
                    ) : (
                      <p className="text-slate-500 italic">No logs generated yet.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info Notice */}
      <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Jobs run asynchronously in the cloud. You can freely navigate or close this app anytime.
        </span>
        <span className="font-mono text-[11px] text-slate-500">
          MissionGrid Async Engine v2.5
        </span>
      </div>

      {/* Interactive PDF Document Preview Modal */}
      {previewJob && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-snug">
                    {previewJob.topic || 'PDF Study Document'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Live Interactive PDF Document Viewer
                  </p>
                </div>
              </div>

              {/* Controls and Switchers */}
              <div className="flex items-center gap-2">
                {previewJob.pdfUrl && previewJob.pdfUrlBn && (
                  <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
                    <button
                      onClick={() => setPreviewEdition('english')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${previewEdition === 'english' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      📘 English
                    </button>
                    <button
                      onClick={() => setPreviewEdition('bengali')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${previewEdition === 'bengali' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      📗 Bengali
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    const url = previewEdition === 'bengali' ? (previewJob.pdfUrlBn || previewJob.pdfUrl) : previewJob.pdfUrl;
                    if (url) window.open(url, '_blank');
                  }}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Open PDF in New Browser Tab"
                >
                  <ExternalLink size={18} />
                </button>

                <button
                  onClick={() => {
                    const url = previewEdition === 'bengali' ? (previewJob.pdfUrlBn || previewJob.pdfUrl) : previewJob.pdfUrl;
                    const fn = previewEdition === 'bengali' 
                      ? (previewJob.pdfFilenameBn || 'MissionGrid_Bengali_Edition.pdf') 
                      : (previewJob.pdfFilename || 'MissionGrid_English_Edition.pdf');
                    if (url) handleDownloadPdf(url, fn);
                  }}
                  className="inline-flex items-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Download size={14} className="mr-1.5" /> Download PDF
                </button>

                <button
                  onClick={() => setPreviewJob(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Close Preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body Viewer */}
            <div className="flex-grow p-2 sm:p-4 bg-slate-950/60 overflow-hidden relative flex flex-col justify-center">
              {(() => {
                const activeUrl = previewEdition === 'bengali' ? (previewJob.pdfUrlBn || previewJob.pdfUrl) : previewJob.pdfUrl;
                if (!activeUrl) return <p className="text-slate-400 text-center py-10">No PDF URL available for preview.</p>;

                return (
                  <iframe
                    src={activeUrl}
                    className="w-full h-[75vh] min-h-[400px] rounded-2xl border border-slate-800 bg-slate-900 shadow-inner"
                    title="PDF Document Preview"
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
