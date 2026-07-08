import React, { useState, useEffect, useRef } from 'react';
import { DailyTarget, Task, Batch } from '../../models/mission';
import { 
  X, Save, Trash2, Link as LinkIcon, Paperclip, Pin, 
  CheckCircle, Plus, Trash, Eye, Sparkles, BookOpen, 
  Calendar, User, AlertCircle, HelpCircle, FileText, Youtube, ExternalLink,
  Mic, Music, Loader2, Square, Play, Pause
} from 'lucide-react';
import { motion } from 'motion/react';
import { TargetService } from '../../services/target';
import { useAuth } from '../../providers/AuthProvider';
import { BatchService } from '../../services/batch';
import { getUsers } from '../../services/users';

interface Props {
  target?: DailyTarget;
  onClose: () => void;
  onSaved?: () => void;
}

export default function TargetFormModal({ target, onClose, onSaved }: Props) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  
  // Header Meta
  const [title, setTitle] = useState(target?.title || '');
  const [missionDay, setMissionDay] = useState((target as any)?.missionDay || '');
  const [targetDay, setTargetDay] = useState<number | string>((target as any)?.targetDay || '');
  const [mentorName, setMentorName] = useState((target as any)?.mentorName || userProfile?.name || 'Adi Madhu');
  const [motivationalQuote, setMotivationalQuote] = useState((target as any)?.motivationalQuote || '');
  const [announcement, setAnnouncement] = useState((target as any)?.announcement || '');

  // Core Configuration
  const [visibility, setVisibility] = useState<'global' | 'batch' | 'individual'>(target?.visibility || 'global');
  const [batchId, setBatchId] = useState(target?.batchId || '');
  const [studentId, setStudentId] = useState(target?.studentId || '');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived' | 'scheduled'>((target as any)?.status || 'published');
  const [scheduledFor, setScheduledFor] = useState((target as any)?.scheduledFor || '');
  const [isPinned, setIsPinned] = useState(target?.isPinned || false);
  const [theme, setTheme] = useState(target?.theme || 'slate');
  
  // Telegram Poster main payload description
  const [posterContent, setPosterContent] = useState(target?.description || '');

  // Flat General checklist of tasks (No subject subdivisions!)
  const [tasks, setTasks] = useState<Task[]>(target?.tasks || []);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskType, setNewTaskType] = useState<Task['type']>('Study');

  // Flat General attachment links
  const [pdfLinks, setPdfLinks] = useState<string[]>(target?.pdfLinks || []);
  const [youtubeLinks, setYoutubeLinks] = useState<string[]>(target?.youtubeLinks || []);
  const [websiteLinks, setWebsiteLinks] = useState<string[]>(target?.websiteLinks || []);

  const [pdfInput, setPdfInput] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [websiteInput, setWebsiteInput] = useState('');

  // Flag for triggering a high priority notification to students
  const [triggerHighPriorityNotification, setTriggerHighPriorityNotification] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isInstantMode, setIsInstantMode] = useState(true);
  const [voiceUrl, setVoiceUrl] = useState(target?.voiceUrl || '');
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // If loading a legacy target which has subjectsData, merge its content gracefully
  useEffect(() => {
    if (target && target.subjectsData) {
      let mergedText = target.description || '';
      const subjects = Object.keys(target.subjectsData);
      subjects.forEach(subKey => {
        const sub = target.subjectsData![subKey];
        if (sub && sub.enabled && sub.content) {
          mergedText += `\n\n### 📢 ${subKey.toUpperCase()}\n${sub.content}`;
        }
      });
      setPosterContent(mergedText.trim());
    }
  }, [target]);

  useEffect(() => {
    const loadSelectorsData = async () => {
      try {
        const [b, u] = await Promise.all([
          BatchService.getBatches(),
          getUsers()
        ]);
        setBatches(b);
        setStudents(u.filter(user => user.role === 'student'));
      } catch (err) {
        console.error("Failed to load mentor selectors", err);
      }
    };
    loadSelectorsData();
  }, []);

  const insertFormat = (markerStart: string, markerEnd: string) => {
    const textarea = document.getElementById('poster_textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = posterContent;

    const formatted = text.substring(0, start) + 
                      markerStart + 
                      (text.substring(start, end) || 'text_here') + 
                      markerEnd + 
                      text.substring(end);

    setPosterContent(formatted);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + markerStart.length, start + markerStart.length + (end - start || 9));
    }, 50);
  };

  const handleAddTask = () => {
    if (!newTaskName.trim()) return;
    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString().substring(2, 6)}`,
      name: newTaskName.trim(),
      type: newTaskType,
      priority: 'Medium',
      estimatedMinutes: 30,
      status: 'Not Started'
    };
    setTasks([...tasks, newTask]);
    setNewTaskName('');
  };

  const handleRemoveTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const handleAddLink = (type: 'pdf' | 'youtube' | 'website') => {
    if (type === 'pdf' && pdfInput.trim()) {
      setPdfLinks([...pdfLinks, pdfInput.trim()]);
      setPdfInput('');
    }
    if (type === 'youtube' && youtubeInput.trim()) {
      setYoutubeLinks([...youtubeLinks, youtubeInput.trim()]);
      setYoutubeInput('');
    }
    if (type === 'website' && websiteInput.trim()) {
      setWebsiteLinks([...websiteLinks, websiteInput.trim()]);
      setWebsiteInput('');
    }
  };

  const handleRemoveLink = (type: 'pdf' | 'youtube' | 'website', idx: number) => {
    if (type === 'pdf') setPdfLinks(pdfLinks.filter((_, i) => i !== idx));
    if (type === 'youtube') setYoutubeLinks(youtubeLinks.filter((_, i) => i !== idx));
    if (type === 'website') setWebsiteLinks(websiteLinks.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Please provide an overarching title for today's target poster.");
      return;
    }
    if (!posterContent.trim()) {
      alert("Please enter the main Telegram-poster style content.");
      return;
    }
    if (visibility === 'batch' && !batchId) {
      alert("Please select a target Batch.");
      return;
    }
    if (visibility === 'individual' && !studentId) {
      alert("Please select a specific Student.");
      return;
    }

    setLoading(true);
    try {
      const isEditingNew = !target?.id;
      
      const dayDigits = missionDay.match(/\d+/);
      const parsedDay = dayDigits ? parseInt(dayDigits[0], 10) : null;
      const targetDayVal = targetDay !== '' ? parseInt(targetDay.toString(), 10) : parsedDay;

      const targetPayload: any = {
        title: title.trim(),
        description: posterContent.trim(),
        isPinned,
        visibility,
        batchId: visibility === 'batch' ? batchId : undefined,
        studentId: visibility === 'individual' ? studentId : undefined,
        theme,
        voiceUrl,
        
        missionDay: missionDay.trim() || 'General',
        targetDay: targetDayVal,
        mentorName: mentorName.trim(),
        motivationalQuote: motivationalQuote.trim(),
        announcement: announcement.trim(),
        status,
        scheduledFor: status === 'scheduled' ? scheduledFor : undefined,
        
        // Flattened lists
        pdfLinks,
        youtubeLinks,
        websiteLinks,
        tasks,
        // Make sure to delete old subjectsData so we cleanly un-cluster and remove subject specificity!
        subjectsData: null
      };

      if (!userProfile) return;
      
      if (isEditingNew) {
        targetPayload.createdBy = userProfile.id;
        targetPayload.creatorName = userProfile.name || 'Mentor';
        const docId = await TargetService.createTarget(targetPayload);
        
        if (status === 'published') {
          await TargetService.createNotification(
            'info',
            `${missionDay || 'New Target'}: ${title}`,
            `New Telegram-style target poster has been dispatched by ${mentorName}!`,
            docId
          );
        }
      } else {
        await TargetService.updateTarget(target!.id, targetPayload);
        
        if (status === 'published') {
          await TargetService.createNotification(
            triggerHighPriorityNotification ? 'emergency' : 'update',
            triggerHighPriorityNotification ? `🚨 IMPORTANT UPDATE: Target modified!` : `Target Refined: ${title}`,
            `The Day target was recalculated by mentor Adi Madhu. Open to review!`,
            target!.id
          );
        }
      }

      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred while saving the target.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!target?.id) return;
    if (confirm('Permanently delete this target coordinate poster?')) {
      setLoading(true);
      try {
        await TargetService.deleteTarget(target.id);
        onSaved?.();
        onClose();
      } catch (err) {
        console.error(err);
        alert("Failed to delete target.");
        setLoading(false);
      }
    }
  };

  // Quick markdown rendering for live preview inside modal
  const formatPosterPreview = (text: string) => {
    if (!text) return <p className="text-sm font-bold text-slate-300 italic">Type content to see output...</p>;
    const paragraphs = text.split('\n');
    return paragraphs.map((para, idx) => {
      let trimmed = para.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;
      if (trimmed.startsWith('###')) return <h3 key={idx} className="text-sm font-black text-white uppercase mt-4 tracking-wider border-b border-white/10 pb-1">{trimmed.replace(/###/g, '')}</h3>;
      if (trimmed.startsWith('##')) return <h4 key={idx} className="text-base font-black text-white mt-3">{trimmed.replace(/##/g, '')}</h4>;
      if (trimmed.startsWith('#')) return <h2 key={idx} className="text-xl font-black text-white mt-4 border-b border-white/20 pb-1">{trimmed.replace(/#/g, '')}</h2>;
      if (trimmed.startsWith('>')) return <blockquote key={idx} className="border-l-4 border-amber-400 pl-3 py-1 italic font-bold bg-white/5 my-2 rounded-r-xl text-xs text-slate-100">{trimmed.substring(1).trim()}</blockquote>;
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) return <li key={idx} className="text-[13px] font-bold text-white ml-3 list-disc my-1 leading-relaxed">{trimmed.substring(1).trim()}</li>;
      
      const parts = trimmed.split('**');
      if (parts.length > 1) {
        return (
          <p key={idx} className="text-[13px] leading-relaxed text-white my-1 font-bold">
            {parts.map((p, i) => i % 2 === 1 ? <strong key={i} className="text-white font-black">{p}</strong> : p)}
          </p>
        );
      }
      return <p key={idx} className="text-[13px] leading-relaxed text-white my-1 font-bold">{trimmed}</p>;
    });
  };

  const themes = [
    { id: 'slate', name: 'Slate Gray', color: 'bg-slate-900 border-slate-700' },
    { id: 'indigo', name: 'Royal Indigo', color: 'bg-indigo-600 border-indigo-500' },
    { id: 'emerald', name: 'Sage Emerald', color: 'bg-emerald-600 border-emerald-500' },
    { id: 'amber', name: 'Amber Gold', color: 'bg-amber-500 border-amber-400' },
    { id: 'rose', name: 'Warm Rose', color: 'bg-rose-600 border-rose-500' },
    { id: 'violet', name: 'Velvet Violet', color: 'bg-violet-600 border-violet-500' },
  ];

  const handleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert("Please select an audio file.");
      return;
    }

    setVoiceUploading(true);
    try {
      const { url } = await TargetService.uploadFile(file, 'target_voices');
      setVoiceUrl(url);
    } catch (err) {
      console.error("Voice upload error:", err);
      alert("Failed to upload voice explanation.");
    } finally {
      setVoiceUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
        
        setVoiceUploading(true);
        try {
          const { url } = await TargetService.uploadFile(file, 'target_voices');
          setVoiceUrl(url);
        } catch (err) {
          console.error("Recording upload error:", err);
          alert("Failed to upload recording.");
        } finally {
          setVoiceUploading(false);
        }
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40  flex items-center justify-center px-2 py-4 md:p-6 text-slate-800 pt-[env(safe-area-inset-top)]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-3xl max-h-full bg-slate-50 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Top action header bar */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white shadow-sm z-30 shrink-0">
          <div className="flex items-center space-x-2">
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl transition-all">
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-[13px] font-black text-slate-900 leading-none">{target ? 'Refining Classroom Poster' : 'Create Target'}</h3>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button 
              type="button"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                isPreviewMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Eye size={12} />
              <span className="hidden sm:inline">{isPreviewMode ? 'Exit Preview' : 'Interactive Preview'}</span>
              <span className="sm:hidden">Preview</span>
            </button>

            {target && (
              <button 
                type="button"
                onClick={handleDelete} 
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 transition-colors flex items-center justify-center"
                title="Delete coordinates permanently"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button 
              onClick={handleSave} 
              disabled={loading || !title.trim()}
              className="flex items-center space-x-1 bg-indigo-650 text-white px-3 py-1.5 rounded-lg font-bold text-[11px] hover:bg-indigo-700 transition-all disabled:opacity-40 shadow-md shadow-indigo-100"
            >
              {loading ? 'Deploying...' : 'Deploy Board'}
            </button>
          </div>
        </div>

        {!isPreviewMode && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 border-b border-slate-200 gap-2 flex-wrap shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Target Creation Workflow
            </span>
            <div className="flex bg-white p-0.5 rounded-full border border-slate-205 shadow-sm">
              <button 
                type="button" 
                onClick={() => setIsInstantMode(true)}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full transition-all flex items-center gap-1 ${
                  isInstantMode 
                    ? 'bg-indigo-650 text-white shadow-sm scale-102' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                ⚡ Instant Target (Fast)
              </button>
              <button 
                type="button" 
                onClick={() => setIsInstantMode(false)}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full transition-all flex items-center gap-1 ${
                  !isInstantMode 
                    ? 'bg-indigo-650 text-white shadow-sm scale-102' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                ⚙️ Advanced Details
              </button>
            </div>
          </div>
        )}

        {isPreviewMode ? (
        /* SIMULATED STUDENT VIEW PREVIEW */
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 space-y-4">
          <div className="bg-amber-100 border border-amber-200 text-amber-900 p-2.5 rounded-2xl text-[10px] uppercase font-black tracking-widest text-center select-none">
            Simulated Perspective • Live Mentorship Board preview
          </div>
          
          <div className="max-w-md mx-auto bg-slate-900 p-6 rounded-[2rem] text-white border border-slate-800 shadow-xl space-y-4">
            <div>
              <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                {missionDay || 'MISSION DAY_'}
              </span>
              <h2 className="text-lg font-black text-white mt-3 tracking-tight">{title || 'Target Headline Poster'}</h2>
              <p className="text-[9px] text-slate-400 mt-1 uppercase">PUBLISHED BY: {mentorName}</p>
            </div>

            {motivationalQuote && (
              <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-xs italic text-slate-300">
                “{motivationalQuote}”
              </div>
            )}

            {announcement && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl text-amber-400 text-xs font-bold leading-relaxed">
                📢 {announcement}
              </div>
            )}

            {/* Poster Content Panel */}
            <div className="bg-black/25 p-4 rounded-2xl border border-white/5 space-y-2 text-slate-100 mt-2">
              {formatPosterPreview(posterContent)}
            </div>

            {/* Voice Preview */}
            {voiceUrl && (
              <div className="bg-indigo-600/20 border border-indigo-500/30 p-3 rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                  <Mic size={14} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">Voice Explanation</div>
                  <audio src={voiceUrl} controls className="h-6 w-full opacity-80" />
                </div>
              </div>
            )}

            {/* Flat tasks */}
            {tasks.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[9px] font-black tracking-widest text-slate-400 block px-1">DAY CHECKLIST</span>
                <div className="space-y-1.5">
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2.5 text-xs bg-white/5 p-2.5 rounded-xl border border-white/[0.02]">
                      <div className="w-3.5 h-3.5 rounded-full border border-white/35" />
                      <span className="text-white/95">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            {(pdfLinks.length > 0 || youtubeLinks.length > 0 || websiteLinks.length > 0) && (
              <div className="space-y-2 pt-3 border-t border-white/10">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">ATTACHED STUDY MATERIALS</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {pdfLinks.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-white/5 p-2 rounded-lg text-rose-300"><FileText size={12}/> <span className="truncate">PDF {idx+1}</span></div>
                  ))}
                  {youtubeLinks.map((y, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-white/5 p-2 rounded-lg text-red-350"><Youtube size={12}/> <span className="truncate">Video {idx+1}</span></div>
                  ))}
                  {websiteLinks.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-white/5 p-2 rounded-lg text-indigo-300"><ExternalLink size={12}/> <span className="truncate">Article {idx+1}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SIMPLIFIED workspace editor without subjects */
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 pb-24 bg-slate-50/50">
          
          {/* SECTION A: HEADER & META */}
          <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="text-[10px] font-black text-indigo-650 uppercase tracking-widest leading-none">
              {isInstantMode ? '⚡ 1. Core Target Coordinates' : '1. Mission Header Detail'}
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Overarching Target Headline</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  className="w-full border border-slate-205 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800" 
                  placeholder="e.g. Percentage Workout & Error Spotting Poster" 
                />
              </div>
              
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Mission Day Accent</label>
                <input 
                  type="text" 
                  value={missionDay} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setMissionDay(val);
                    const match = val.match(/\d+/);
                    if (match && !targetDay) {
                      setTargetDay(parseInt(match[0], 10));
                    }
                  }} 
                  className="w-full border border-slate-205 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800" 
                  placeholder="e.g. Day 45" 
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Target Day (Numeric)</label>
                <input 
                  type="number" 
                  value={targetDay} 
                  onChange={(e) => setTargetDay(e.target.value)} 
                  className="w-full border border-slate-205 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800" 
                  placeholder="e.g. 45" 
                  min="1"
                />
              </div>
            </div>

            {!isInstantMode && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Motivational Quote / Quick Notice</label>
                    <input 
                      type="text" 
                      value={motivationalQuote} 
                      onChange={(e) => setMotivationalQuote(e.target.value)} 
                      className="w-full border border-slate-205 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800" 
                      placeholder="Keep going daily! Ranks are built bit-by-bit." 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Mentor / Dispatcher Identity</label>
                    <input 
                      type="text" 
                      value={mentorName} 
                      onChange={(e) => setMentorName(e.target.value)} 
                      className="w-full border border-slate-205 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800" 
                      placeholder="Adi Madhu" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Sticky Classroom Warning Flag (Optional Banner Alert)</label>
                  <input 
                    type="text" 
                    value={announcement} 
                    onChange={(e) => setAnnouncement(e.target.value)} 
                    className="w-full border border-slate-205 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800" 
                    placeholder="Alert for class tests or mock updates..." 
                  />
                </div>
              </>
            )}
          </div>
 
          {/* SECTION B: TELEGRAM POSTER CONTENT WRITER */}
          <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-indigo-650 uppercase tracking-widest leading-none">
                  {isInstantMode ? '✍️ 2. Mentorship Target Poster Content' : '2. Mentorship Poster Template Editor'}
                </h4>
                <p className="text-[10px] text-slate-400 mt-1">Syllabus details, daily topics, worksheets or instructions.</p>
              </div>
              
              {!isInstantMode && (
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    id="voice_upload" 
                    hidden 
                    accept="audio/*" 
                    onChange={handleVoiceUpload} 
                  />
                  
                  {isRecording ? (
                    <button 
                      type="button"
                      onClick={stopRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all bg-red-50 text-red-600 border border-red-100 animate-pulse"
                    >
                      <Square size={12} className="fill-red-600" />
                      <span>Stop ({formatDuration(recordingDuration)})</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button 
                        type="button"
                        disabled={voiceUploading}
                        onClick={startRecording}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all bg-indigo-50 text-indigo-600 border border-indigo-100 hover:scale-105 active:scale-95"
                      >
                        <Mic size={12} />
                        <span>Record</span>
                      </button>
                      
                      <button 
                        type="button"
                        disabled={voiceUploading}
                        onClick={() => document.getElementById('voice_upload')?.click()}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                          voiceUrl ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                        } hover:scale-105 active:scale-95`}
                      >
                        {voiceUploading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Music size={12} />
                        )}
                        <span>{voiceUploading ? 'Uploading...' : voiceUrl ? 'Change Audio' : 'Upload Audio'}</span>
                      </button>
                    </div>
                  )}
 
                  {voiceUrl && !isRecording && (
                    <button 
                      type="button" 
                      onClick={() => setVoiceUrl('')}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
 
            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-1 p-2 bg-slate-100 rounded-t-xl border border-slate-200 border-b-none">
              <button type="button" onClick={() => insertFormat('**', '**')} className="px-2.5 py-1 bg-white rounded text-[10px] font-black text-slate-705 border">Bold (**text**)</button>
              <button type="button" onClick={() => insertFormat('*', '*')} className="px-2.5 py-1 bg-white rounded text-[10px] italic text-slate-705 border">Italic (*text*)</button>
              <button type="button" onClick={() => insertFormat('### ', '')} className="px-2.5 py-1 bg-white rounded text-[10px] font-bold text-slate-705 border">H3 Section Header (###)</button>
              <button type="button" onClick={() => insertFormat('> ', '')} className="px-2.5 py-1 bg-white rounded text-[10px] text-slate-705 border">Quote block (&gt;)</button>
              <button type="button" onClick={() => insertFormat('- ', '')} className="px-2.5 py-1 bg-white rounded text-[10px] text-slate-705 border">List Bullet (- )</button>
              <button type="button" onClick={() => setPosterContent(prev => prev + '\n\n📐 MATHEMATICS:\n- Complete Percentage lecture sheet.\n- Do 20 practice Qs.\n\n🧠 REASONING:\n- Solve blood relations workbook.')} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold border border-indigo-100 ml-auto">+ Template</button>
            </div>
 
            <textarea 
              id="poster_textarea"
              rows={isInstantMode ? 7 : 8}
              value={posterContent}
              onChange={(e) => setPosterContent(e.target.value)}
              placeholder="Draft your entire daily targets info deck here. Avoid subject boundaries; you can make any mentorship poster style target seamlessly!"
              className="w-full border border-t-none border-slate-200 rounded-b-xl p-3 text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none leading-relaxed text-slate-800"
            />
          </div>
 
          {/* SECTION C: TASK CHECKLIST (FLAT & MINIMAL) */}
          {!isInstantMode && (
            <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h4 className="text-[11px] font-black text-indigo-655 uppercase tracking-widest leading-none">3. Unified Daily Training Tasks</h4>
              <p className="text-[10px] text-slate-400">Add checklist nodes targeting the student coordinates tracker directly.</p>
  
              <div className="flex gap-2 items-end pt-1">
                <div className="flex-1">
                  <input 
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="Task action name e.g. Complete Percentage Exercises"
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-850"
                  />
                </div>
                <div>
                  <select 
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value as any)}
                    className="border border-slate-200 rounded-xl p-1.5 px-2 text-xs font-bold text-slate-650 bg-white"
                  >
                    <option value="Study">Study</option>
                    <option value="Practice">Practice</option>
                    <option value="Revision">Revision</option>
                    <option value="Mock Test">Mock Test</option>
                    <option value="Special">Special Mission</option>
                  </select>
                </div>
                <button 
                  type="button" 
                  onClick={handleAddTask}
                  className="bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs py-1.5 px-4 rounded-xl"
                >
                  Insert Task
                </button>
              </div>
  
              <div className="space-y-1.5 pt-2">
                {tasks.map((t, idx) => (
                  <div key={t.id || idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">#{idx+1}</span>
                      <span>{t.name}</span>
                      <span className="text-[8px] uppercase tracking-widest font-black px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">{t.type}</span>
                    </div>
                    <button type="button" onClick={() => handleRemoveTask(t.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-lg">
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className="text-[10px] text-slate-400 italic font-semibold px-1">No checklist items specified.</p>
                )}
              </div>
            </div>
          )}
 
          {/* SECTION D: STREAMLINED MATERIALS & RESOURCE ATTACHMENTS */}
          {!isInstantMode && (
            <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h4 className="text-[11px] font-black text-indigo-650 uppercase tracking-widest leading-none">4. Dynamic Files & Materials links</h4>
              
              <div className="space-y-3">
                {/* PDF */}
                <div>
                  <div className="flex gap-2">
                    <input type="text" value={pdfInput} onChange={(e) => setPdfInput(e.target.value)} placeholder="PDF resource URL Link" className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800" />
                    <button type="button" onClick={() => handleAddLink('pdf')} className="bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-[11px] px-3.5 rounded-xl hover:bg-indigo-100">Add PDF Link</button>
                  </div>
                  {pdfLinks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {pdfLinks.map((p, i) => (
                        <span key={`pdf-link-${i}-${p.substring(0, 10)}`} className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl flex items-center gap-1.5 border border-slate-205">
                          <span className="truncate max-w-[120px]">{p}</span>
                          <X className="w-3 h-3 text-red-500 cursor-pointer" onClick={() => handleRemoveLink('pdf', i)}/>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
  
                {/* YouTube */}
                <div>
                  <div className="flex gap-2">
                    <input type="text" value={youtubeInput} onChange={(e) => setYoutubeInput(e.target.value)} placeholder="YouTube video playlist / link URL" className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800" />
                    <button type="button" onClick={() => handleAddLink('youtube')} className="bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-[11px] px-3.5 rounded-xl hover:bg-indigo-100">Add Video Link</button>
                  </div>
                  {youtubeLinks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {youtubeLinks.map((y, i) => (
                        <span key={`youtube-link-${i}-${y.substring(0, 10)}`} className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl flex items-center gap-1.5 border border-slate-205">
                          <span className="truncate max-w-[120px]">{y}</span>
                          <X className="w-3 h-3 text-red-500 cursor-pointer" onClick={() => handleRemoveLink('youtube', i)}/>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
  
                {/* General Website links */}
                <div>
                  <div className="flex gap-2">
                    <input type="text" value={websiteInput} onChange={(e) => setWebsiteInput(e.target.value)} placeholder="General article / website link URL" className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800" />
                    <button type="button" onClick={() => handleAddLink('website')} className="bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-[11px] px-3.5 rounded-xl hover:bg-indigo-100">Add Website Link</button>
                  </div>
                  {websiteLinks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {websiteLinks.map((w, i) => (
                        <span key={`website-link-${i}-${w.substring(0, 10)}`} className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl flex items-center gap-1.5 border border-slate-205">
                          <span className="truncate max-w-[120px]">{w}</span>
                          <X className="w-3 h-3 text-red-500 cursor-pointer" onClick={() => handleRemoveLink('website', i)}/>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
  
              </div>
            </div>
          )}
 
          {/* SECTION E: CLASSROOM SCHEDULING & MISSION VISIBILITY */}
          <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="text-[10px] font-black text-indigo-650 uppercase tracking-widest leading-none">
              {isInstantMode ? '📡 3. Dispatch & Visibility settings' : '5. Class Dispatch Configuration & Visibility'}
            </h4>
 
            {isInstantMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* STATUS SELECT */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Target Coordinates status</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value as any)} 
                    className="w-full border border-slate-205 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-indigo-500 bg-white text-slate-750"
                  >
                    <option value="published">🚀 Publish Instantly to Classroom</option>
                    <option value="draft">Save as Draft (Post hidden)</option>
                  </select>
                </div>

                {/* VISIBILITY */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Designated Batch / Visibility</label>
                  <select 
                    value={visibility} 
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setVisibility(val);
                      if (val === 'global') {
                        setBatchId('');
                        setStudentId('');
                      }
                    }} 
                    className="w-full border border-slate-205 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-indigo-500 bg-white text-slate-750"
                  >
                    <option value="global">Global (All Batches/Students)</option>
                    <option value="batch">Batch Specific Only</option>
                  </select>
                </div>

                {visibility === 'batch' && (
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Choose Designated Batch</label>
                    <select 
                      value={batchId} 
                      onChange={(e) => setBatchId(e.target.value)} 
                      className="w-full border border-slate-205 rounded-xl px-3 py-2.5 text-xs font-black focus:ring-1 focus:ring-indigo-500 bg-white text-indigo-650"
                    >
                      <option value="">-- Choose designated Batch --</option>
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.batchName} ({b.batchCode})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* PUBLISHING */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Target Coordinates status</label>
                    <select 
                      value={status} 
                      onChange={(e) => setStatus(e.target.value as any)} 
                      className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-750 font-semibold"
                    >
                      <option value="published">🚀 Publish Instantly to Classroom</option>
                      <option value="draft">Save as Draft (Post hidden)</option>
                      <option value="scheduled">⏱️ Schedule Target for Future Date</option>
                      <option value="archived">📁 Archive Coordinates</option>
                    </select>
                    
                    {status === 'scheduled' && (
                      <div className="mt-2 text-indigo-650 animate-slide-down">
                        <label className="block text-[8px] font-black uppercase tracking-wider mb-1">Pick date</label>
                        <input 
                          type="date" 
                          value={scheduledFor} 
                          onChange={(e) => setScheduledFor(e.target.value)} 
                          className="border border-slate-200 rounded-xl p-2 px-3 text-xs font-bold text-slate-750" 
                        />
                      </div>
                    )}
                  </div>
    
                  {/* THEME COLOR */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Card Style Theme palette</label>
                    <div className="flex gap-1.5 pt-1">
                      {themes.map(t => (
                        <button 
                          key={t.id} 
                          type="button"
                          onClick={() => setTheme(t.id as any)}
                          className={`w-7 h-7 rounded-xl ${t.color} flex items-center justify-center transition-all ${
                            theme === t.id ? 'ring-2 ring-offset-2 ring-indigo-500 scale-105' : 'opacity-40 scale-90'
                          }`}
                          title={t.name}
                        >
                          {theme === t.id && <CheckCircle size={12} className="text-white"/>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
    
                {/* PIN TO TOP TRAPPINGS */}
                <div className="flex items-center justify-between border border-slate-100 p-3.5 rounded-2xl">
                  <div className="flex items-center space-x-2">
                    <Pin className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 leading-none">Pin bulletin to top of Board</h5>
                      <p className="text-[9px] text-slate-400 mt-1 uppercase">Recommended for important mission deadlines</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-650"></div>
                  </label>
                </div>
    
                {/* VISIBILITY */}
                <div className="space-y-2 pt-3 border-t">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Visibility Matrix Settings</label>
                  <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-80">
                    <button type="button" onClick={() => setVisibility('global')} className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${visibility === 'global' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>Global (All)</button>
                    <button type="button" onClick={() => setVisibility('batch')} className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${visibility === 'batch' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>Batch Only</button>
                    <button type="button" onClick={() => setVisibility('individual')} className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${visibility === 'individual' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>Private Student</button>
                  </div>
    
                  {visibility === 'batch' && (
                    <div className="pt-1.5">
                      <select 
                        value={batchId} 
                        onChange={(e) => setBatchId(e.target.value)} 
                        className="w-full sm:w-80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800"
                      >
                        <option value="">-- Choose designated Batch --</option>
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>{b.batchName} ({b.batchCode})</option>
                        ))}
                      </select>
                    </div>
                  )}
    
                  {visibility === 'individual' && (
                    <div className="pt-1.5 col-span-full">
                      <select 
                        value={studentId} 
                        onChange={(e) => setStudentId(e.target.value)} 
                        className="w-full sm:w-80 border border-slate-205 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800"
                      >
                        <option value="">-- Select custom student Profile --</option>
                        {students.map(s => (
                          <option key={s.id || s.mobile} value={s.id || s.mobile}>{s.name} ({s.phone || s.mobile || 'No Contact'})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
 
        </div>
      )}
      </motion.div>
    </div>
  );
}
