import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Activity, CheckCircle2, Download, X, Layers, BookOpen, Clock } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { GenerationCenter, GenerationJob } from './GenerationCenter';
import { downloadPdfStream } from '../utils/downloadHelper';

export const GenerationCenterFloatingWidget: React.FC = () => {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [completedToast, setCompletedToast] = useState<GenerationJob | null>(null);
  const previousCompletedIds = useRef<Set<string>>(new Set());

  const fetchJobs = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';

      const res = await fetch('/api/mentor/study-jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;

      const studyJobs: GenerationJob[] = await res.json();
      setJobs(studyJobs);

      // Check for newly completed jobs to show toast
      studyJobs.forEach(job => {
        if (job.status === 'completed') {
          if (!previousCompletedIds.current.has(job.id) && previousCompletedIds.current.size > 0) {
            setCompletedToast(job);
          }
          previousCompletedIds.current.add(job.id);
        }
      });
    } catch (err) {
      // Quiet fail in background floating widget
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  const runningJobs = jobs.filter(j => ['queued', 'reading', 'ocr', 'cleaning', 'extracting', 'compiling', 'generating', 'formatting', 'uploading'].includes(j.status));
  const activeCount = runningJobs.length;

  const topJob = runningJobs[0];
  const overallPercent = topJob ? topJob.percent : 0;
  const etaSeconds = topJob?.etaSeconds || 0;

  return (
    <>
      {/* Toast Notification when PDF generation completes */}
      {completedToast && (
        <div className="fixed bottom-20 right-6 z-50 bg-slate-900 border border-emerald-500/40 text-white p-4 rounded-2xl shadow-2xl max-w-sm animate-bounce">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Study Material PDF Ready!</h4>
                <p className="text-xs text-slate-300 mt-0.5 line-clamp-1 font-medium">
                  "{completedToast.topic}"
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  <button
                    onClick={async () => {
                      if (completedToast.pdfUrl) {
                        try {
                          await downloadPdfStream(completedToast.pdfUrl, completedToast.pdfFilename || 'MissionGrid_Study_Material.pdf');
                        } catch (e) {
                          console.warn("Floating widget download fallback:", e);
                          window.open(completedToast.pdfUrl, '_blank');
                        }
                      }
                      setCompletedToast(null);
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Download PDF
                  </button>
                  <button
                    onClick={() => { setIsOpen(true); setCompletedToast(null); }}
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    View Queue
                  </button>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setCompletedToast(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Right Badge */}
      <div className="fixed bottom-5 right-6 z-40 flex items-center space-x-2">
        <button
          onClick={() => setIsOpen(true)}
          className={`group flex items-center space-x-3 px-4 py-2.5 rounded-full shadow-2xl transition-all transform hover:scale-105 ${
            activeCount > 0 
              ? 'bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 border border-indigo-500/50 text-white shadow-indigo-500/20 ring-2 ring-indigo-500/30 animate-pulse'
              : 'bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 backdrop-blur-md'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className={`w-5 h-5 ${activeCount > 0 ? 'text-indigo-400 animate-spin' : 'text-slate-400'}`} />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-900 animate-ping" />
            )}
          </div>

          <div className="text-left pr-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold tracking-wide">
                {activeCount > 0 ? `${activeCount} PDF Jobs Processing` : 'Generation Center'}
              </span>
              {activeCount > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {overallPercent}%
                </span>
              )}
            </div>
            {activeCount > 0 && topJob && (
              <div className="flex items-center space-x-2 text-[10px] text-slate-300 mt-0.5">
                <span className="line-clamp-1 max-w-[120px] font-medium">{topJob.stage || 'Generating...'}</span>
                {etaSeconds > 0 && (
                  <span className="font-mono text-indigo-300 flex items-center">
                    <Clock className="w-2.5 h-2.5 mr-0.5" /> ~{etaSeconds}s
                  </span>
                )}
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Generation Center Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="w-full max-w-4xl relative">
            <GenerationCenter isModal onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
};
