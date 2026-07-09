import React, { useState, useEffect } from 'react';
import { DailyTarget, Task, TargetReaction, Batch } from '../../models/mission';
import { TargetProgress } from '../../models/target_advanced';
import { DailyMissionReport } from '../../models/mission';
import { MissionService } from '../../services/mission';
import { 
  Clock, CheckCircle, Pin, ChevronRight, ChevronDown, 
  Bookmark, BookmarkCheck, Search, Calendar, User, 
  Sparkles, FileText, Youtube, ExternalLink, HelpCircle, 
  Bell, ArrowRight, CheckSquare, Award, Mic, Music, Volume2, Lock
} from 'lucide-react';
import { TargetService } from '../../services/target';
import { useAuth } from '../../providers/AuthProvider';
import { useAppConfig } from '../../providers/AppProvider';
import { useNavigate } from 'react-router-dom';
import { calculatePreparationDay, safeDate, safeSplitDate } from '../../utils/date';

interface Props {
  targets: DailyTarget[];
  currentBatchName?: string;
  batches?: Batch[];
  currentBatchId?: string;
  onBatchChange?: (batchId: string) => Promise<void>;
}

export default function StudentTargetView({ 
  targets, 
  currentBatchName = 'Aspirants',
  batches = [],
  currentBatchId,
  onBatchChange
}: Props) {
  const { userProfile } = useAuth();
  const { setIsPremiumModalOpen } = useAppConfig();
  const navigate = useNavigate();

  const parseTargetDay = (target: DailyTarget): number | null => {
    if (typeof (target as any).targetDay === 'number') {
      return (target as any).targetDay;
    }
    if (target.missionDay) {
      const match = target.missionDay.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }
    return null;
  };

  const regDateVal = userProfile?.registrationDate || userProfile?.createdAt || new Date().toISOString();
  
  const [prepDay, setPrepDay] = useState<number>(() => calculatePreparationDay(regDateVal));
  
  useEffect(() => {
    setPrepDay(calculatePreparationDay(regDateVal));
    
    // Auto-update state every minute to check for daily midnight transitions
    const interval = setInterval(() => {
      setPrepDay(calculatePreparationDay(regDateVal));
    }, 60000);
    
    return () => clearInterval(interval);
  }, [regDateVal]);
  
  // Tabs: 'today' or 'archive' or 'bookmarks'
  const [activeTab, setActiveTab] = useState<'today' | 'archive' | 'bookmarks'>('today');
  const [progress, setProgress] = useState<Record<string, TargetProgress>>({});
  const [reactions, setReactions] = useState<Record<string, TargetReaction[]>>({});
  const [expandedTargets, setExpandedTargets] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Bookmarks & Recents inside localStorage
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  
  const [todayMissionReport, setTodayMissionReport] = useState<DailyMissionReport | null>(null);
  const [studentReports, setStudentReports] = useState<DailyMissionReport[]>([]);
  
  // Archive filters
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');

  // Setup localStorage Bookmarks & Recents & Mission Listener
  useEffect(() => {
    if (!userProfile?.id) return;

    const savedBookmarked = localStorage.getItem(`bookmarks_${userProfile.id}`);
    if (savedBookmarked) {
      setBookmarkedIds(JSON.parse(savedBookmarked));
    }
    const savedRecents = localStorage.getItem(`recents_${userProfile.id}`);
    if (savedRecents) {
      setRecentlyViewedIds(JSON.parse(savedRecents));
    }

    // Fetch/Listen today's mission report
    const todayDate = new Date().toISOString().split('T')[0];
    const unsubscribe = MissionService.subscribeDailyReport(
      userProfile.id,
      todayDate,
      (report) => {
        setTodayMissionReport(report);
      },
      (err) => {
        console.error("Error subscribing to mission report", err);
      }
    );

    const unsubscribeReports = MissionService.subscribeStudentReports(
      userProfile.id,
      (reports) => {
        setStudentReports(reports);
      },
      (err) => {
        console.error("Error subscribing to student reports", err);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeReports();
    };
  }, [userProfile?.id]);

  // 1. Subscribe to progress (only depends on user's uid)
  useEffect(() => {
    if (!userProfile?.id) return;

    const unsubscribeProgress = TargetService.subscribeAllProgressForStudent(
      userProfile.id,
      (allProgress) => {
        const progressMap: Record<string, TargetProgress> = {};
        allProgress.forEach(p => {
          if (p.targetId) progressMap[p.targetId] = p;
        });
        setProgress(progressMap);
      },
      (err) => console.error("Progress sync error", err)
    );

    return () => unsubscribeProgress();
  }, [userProfile?.id]);

  // 2. Subscribe to reactions (only resubscribes when targets list (ids) actually changes)
  const targetIdsStr = JSON.stringify(targets.map(t => t.id));

  useEffect(() => {
    if (!userProfile?.id || targets.length === 0) return;

    const targetIds = JSON.parse(targetIdsStr);
    const unsubscribeReactions = TargetService.subscribeBulkReactions(
      targetIds,
      (allReactions) => {
        const reactionsMap: Record<string, TargetReaction[]> = {};
        allReactions.forEach(r => {
          if (r.targetId) {
            if (!reactionsMap[r.targetId]) {
              reactionsMap[r.targetId] = [];
            }
            reactionsMap[r.targetId].push(r);
          }
        });
        setReactions(reactionsMap);
      },
      (err) => console.error("Reactions sync error", err)
    );

    return () => unsubscribeReactions();
  }, [targetIdsStr, userProfile?.id]);

  // 3. Fetch notifications (run once when targets are loaded)
  useEffect(() => {
    if (targets.length === 0) return;

    const loadNotifs = async () => {
      try {
        const list = await TargetService.getNotifications();
        setNotifications(list);
      } catch (e) {
        console.error("Notifications fetch error", e);
      }
    };
    loadNotifs();
  }, [targets.length]);

  const handleTrackRecentlyViewed = (targetId: string) => {
    if (!userProfile) return;
    setRecentlyViewedIds(prev => {
      const updated = [targetId, ...prev.filter(id => id !== targetId)].slice(0, 5);
      localStorage.setItem(`recents_${userProfile.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const toggleBookmark = (targetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile) return;
    setBookmarkedIds(prev => {
      let updated;
      if (prev.includes(targetId)) {
        updated = prev.filter(id => id !== targetId);
      } else {
        updated = [...prev, targetId];
      }
      localStorage.setItem(`bookmarks_${userProfile.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const toggleTask = async (targetId: string, taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile) return;
    
    const currentStatus = progress[targetId]?.taskStatuses?.[taskId] || 'Not Started';
    const newStatus = currentStatus === 'Completed' ? 'Not Started' : 'Completed';
    
    // Optimistic Update
    setProgress(prev => {
      const existing = prev[targetId] || {
        targetId,
        studentId: userProfile.id,
        status: 'Started' as const,
        taskStatuses: {},
        updatedAt: new Date().toISOString()
      };
      
      return {
        ...prev,
        [targetId]: {
          ...existing,
          status: 'Started',
          taskStatuses: {
            ...existing.taskStatuses,
            [taskId]: newStatus
          },
          updatedAt: new Date().toISOString()
        } as TargetProgress
      };
    });

    try {
      await TargetService.updateTaskProgress(targetId, userProfile.id, taskId, newStatus);
    } catch (error) {
      console.error("Error updating task progress:", error);
    }
  };

  const handleAddReaction = async (targetId: string, type: 'Like' | 'Fire' | 'Clap' | 'Heart', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile) return;
    
    // Optimistic Update
    const mockReaction: TargetReaction = {
      id: Math.random().toString(),
      targetId,
      userId: userProfile.id,
      type,
      createdAt: new Date().toISOString()
    };
    
    setReactions(prev => {
      const current = prev[targetId] || [];
      const filtered = current.filter(r => r.userId !== userProfile.id);
      return {
        ...prev,
        [targetId]: [...filtered, mockReaction]
      };
    });

    try {
      await TargetService.addReaction(targetId, userProfile.id, type);
    } catch (err) {
      console.error("Error saving reaction", err);
    }
  };

  // Modern clean Telegram Poster style converter
  const formatPosterContent = (text: string, isDark: boolean) => {
    if (!text) return null;
    
    const paragraphs = text.split('\n');
    return paragraphs.map((para, idx) => {
      let trimmed = para.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;

      if (trimmed.startsWith('###')) {
        return <h5 key={idx} className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-[#5bc0be] border-white/5' : 'text-indigo-600 border-slate-100'} mb-1.5 mt-3 border-b pb-1`}>{trimmed.replace(/###/g, '')}</h5>;
      }
      if (trimmed.startsWith('##')) {
        return <h4 key={idx} className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'} mb-1 mt-3`}>{trimmed.replace(/##/g, '')}</h4>;
      }
      if (trimmed.startsWith('#')) {
        return <h3 key={idx} className={`text-base font-black ${isDark ? 'text-white border-white/10' : 'text-slate-900 border-slate-200'} mb-2 mt-4 border-b pb-1`}>{trimmed.replace(/#/g, '')}</h3>;
      }

      if (trimmed.startsWith('>')) {
        return (
          <blockquote key={idx} className={`border-l-4 border-amber-400 pl-3 py-1 italic font-bold rounded-r-xl my-2 text-xs ${isDark ? 'bg-white/5 text-slate-100' : 'bg-slate-50 text-slate-700'}`}>
            {trimmed.substring(1).trim()}
          </blockquote>
        );
      }

      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        return (
          <div key={idx} className={`flex items-start gap-2 text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-800'} pl-2 my-1 leading-relaxed`}>
            <span className="text-amber-400 mt-1.5">•</span>
            <span>{trimmed.substring(1).trim()}</span>
          </div>
        );
      }

      // Double asterisks styling
      const parts = trimmed.split('**');
      if (parts.length > 1) {
        return (
          <p key={idx} className={`text-[13px] leading-relaxed ${isDark ? 'text-white' : 'text-slate-800'} my-1 font-bold`}>
            {parts.map((p, i) => i % 2 === 1 ? <strong key={i} className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{p}</strong> : p)}
          </p>
        );
      }

      return <p key={idx} className={`text-[13px] leading-relaxed ${isDark ? 'text-white' : 'text-slate-800'} my-1 font-bold`}>{trimmed}</p>;
    });
  };

  const getReactionCount = (targetId: string, type: 'Like' | 'Fire' | 'Clap' | 'Heart') => {
    const list = reactions[targetId] || [];
    return list.filter(r => r.type === type).length;
  };

  const hasReacted = (targetId: string, type: 'Like' | 'Fire' | 'Clap' | 'Heart') => {
    const list = reactions[targetId] || [];
    return list.some(r => r.userId === userProfile?.id && r.type === type);
  };

  const getRelativeDateLabel = (dateStr: string) => {
    try {
      const targetDate = safeDate(dateStr);
      const today = new Date();
      if (targetDate.toDateString() === today.toDateString()) {
        return "Today's Target";
      }
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (targetDate.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      }
      return targetDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'long' });
    } catch (e) {
      return dateStr;
    }
  };

  const getThemePalette = (tTheme?: string) => {
    switch (tTheme) {
      case 'indigo': return 'from-indigo-600 to-indigo-700 text-white';
      case 'emerald': return 'from-emerald-600 to-emerald-700 text-white';
      case 'amber': return 'from-amber-500 to-amber-600 text-white';
      case 'rose': return 'from-rose-600 to-rose-700 text-white';
      case 'violet': return 'from-violet-600 to-violet-700 text-white';
      default: return 'from-white to-white text-slate-900 border-slate-200';
    }
  };

  // Render Telegram-style message card
  const renderTelegramTargetCard = (target: DailyTarget, idx: number) => {
    const isBookmarked = bookmarkedIds.includes(target.id);
    const themeClass = getThemePalette(target.theme);
    const isDarkTheme = target.theme && target.theme !== 'slate';
    const isTargetCompleted = progress[target.id]?.status === 'Completed';

    const targetDateStr = safeSplitDate(target.createdAt);
    const prevDateStr = (() => {
      try {
        const d = new Date(targetDateStr + "T00:00:00");
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
      } catch (e) {
        return '';
      }
    })();

    const registrationDateStr = (userProfile?.registrationDate || userProfile?.createdAt || '').split('T')[0];
    const isFirstDay = prevDateStr < registrationDateStr;

    const prevMissionSubmitted = isFirstDay || studentReports.some(r => r.date === prevDateStr);
    const currentMissionSubmitted = studentReports.some(r => r.date === targetDateStr);

    const canMarkDone = prevMissionSubmitted && currentMissionSubmitted;

    const tDay = parseTargetDay(target);
    const isFutureTarget = tDay !== null && tDay > prepDay;
    const isLocked = isFutureTarget && !prevMissionSubmitted;

    if (isLocked) {
      return (
        <div key={target.id} className="flex flex-col gap-1 max-w-[90%] sm:max-w-[85%] self-start animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
          <div className="flex items-center gap-2 px-2 ml-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {target.missionDay || 'MISSION'} • {getRelativeDateLabel(target.createdAt)} (LOCKED)
            </span>
          </div>
          
          <div className="rounded-2xl p-5 shadow-sm border bg-slate-50 border-slate-200 relative">
            <div className="space-y-4">
              {/* Header */}
              <div className="opacity-50">
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight text-slate-400">
                  {target.title}
                </h3>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  BY {target.creatorName || (target as any).mentorName || 'ADI MADHU'}
                </p>
              </div>

              {/* Locked Overlay Body */}
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 shadow-inner">
                  <Lock size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-slate-700 font-extrabold text-xs">Target Locked</h4>
                  <p className="text-slate-500 text-[10px] font-semibold max-w-xs mx-auto leading-relaxed mt-1">
                    This target will unlock automatically as soon as you submit your daily mission proof for {getRelativeDateLabel(prevDateStr)}.
                  </p>
                </div>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    navigate('/app/create-submission', { state: { targetId: target.id } }); 
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/10 active:scale-95 flex items-center gap-1.5"
                >
                  <span>Submit {getRelativeDateLabel(prevDateStr)} Proof</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={target.id} className="flex flex-col gap-1 max-w-[90%] sm:max-w-[85%] self-start animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-2 px-2 ml-1">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/50 px-2 py-0.5 rounded-full border border-slate-100">
            {target.missionDay || 'MISSION'} • {getRelativeDateLabel(target.createdAt)}
          </span>
        </div>
        
        <div 
          className={`rounded-2xl p-4 sm:p-5 shadow-sm border relative group ${
            isDarkTheme ? themeClass + ' border-transparent' : 'bg-white border-slate-200'
          } ${target.isPinned ? 'ring-2 ring-amber-400' : ''}`}
        >
          {target.isPinned && (
            <div className="absolute -top-2 -right-2 bg-amber-400 text-slate-900 p-1 rounded-full shadow-md z-10">
              <Pin size={12} className="fill-slate-900" />
            </div>
          )}

          <div className="space-y-4">
            {/* Header / Title */}
            <div>
              <h3 className={`text-base sm:text-lg font-black tracking-tight leading-tight ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                {target.title}
              </h3>
              <div className="flex items-center justify-between mt-1">
                <p className={`text-[9px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-white/70' : 'text-indigo-600'}`}>
                  BY {target.creatorName || (target as any).mentorName || 'ADI MADHU'}
                </p>
                <button 
                  onClick={(e) => toggleBookmark(target.id, e)}
                  className={`p-1.5 rounded-lg transition-all ${isBookmarked ? 'text-amber-500' : isDarkTheme ? 'text-white/40' : 'text-slate-300'}`}
                >
                  <Bookmark size={14} className={isBookmarked ? 'fill-amber-500' : ''} />
                </button>
              </div>
            </div>

            {/* Voice Explanation */}
            {target.voiceUrl && (
              <div className={`p-3 rounded-xl flex items-center gap-3 ${isDarkTheme ? 'bg-black/20' : 'bg-indigo-50 border border-indigo-100/50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDarkTheme ? 'bg-white/10 text-white' : 'bg-indigo-600 text-white'}`}>
                  <Volume2 size={16} />
                </div>
                <audio src={target.voiceUrl} controls className="h-7 w-full flex-1 opacity-90" />
              </div>
            )}

            {/* Motivational Quote */}
            {(target as any).motivationalQuote && (
              <div className={`p-3 rounded-xl border-l-4 text-xs italic ${
                isDarkTheme ? 'bg-white/5 border-amber-400/50 text-white/90' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                “{(target as any).motivationalQuote}”
              </div>
            )}

            {/* Main Content */}
            <div className="space-y-2 text-xs leading-relaxed">
              {formatPosterContent(target.description, isDarkTheme)}
            </div>

            {/* Tasks Section */}
            {target.tasks && target.tasks.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-black/5">
                <p className={`text-[9px] font-black tracking-widest uppercase ${isDarkTheme ? 'text-white/60' : 'text-slate-400'}`}>Checklist</p>
                <div className="space-y-1.5">
                  {target.tasks.map(task => {
                    const isDone = progress[target.id]?.taskStatuses?.[task.id] === 'Completed';
                    return (
                      <div 
                        key={task.id} 
                        onClick={(e) => toggleTask(target.id, task.id, e)}
                        className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all ${
                          isDone 
                            ? isDarkTheme ? 'bg-white/10' : 'bg-emerald-50' 
                            : isDarkTheme ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        {isDone ? (
                          <CheckSquare size={14} className={isDarkTheme ? 'text-emerald-300' : 'text-emerald-600'} />
                        ) : (
                          <div className={`w-3.5 h-3.5 rounded-sm border ${isDarkTheme ? 'border-white/30' : 'border-slate-300'}`} />
                        )}
                        <span className={`flex-1 font-medium ${isDone ? 'line-through opacity-60' : ''}`}>{task.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attachments */}
            {((target.pdfLinks?.length || 0) > 0 || (target.youtubeLinks?.length || 0) > 0 || (target.websiteLinks?.length || 0) > 0) && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-black/5">
                {target.pdfLinks?.map((l, i) => {
                  const handlePdfClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (!userProfile?.isPremium) {
                      e.preventDefault();
                      setIsPremiumModalOpen(true);
                    }
                  };
                  return (
                    <a key={i} href={l} onClick={handlePdfClick} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${isDarkTheme ? 'bg-white/10 hover:bg-white/20' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}>
                      <FileText size={12} /> Resource {i+1}
                    </a>
                  );
                })}
                {target.youtubeLinks?.map((l, i) => (
                  <a key={i} href={l} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${isDarkTheme ? 'bg-white/10 hover:bg-white/20' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>
                    <Youtube size={12} /> Class {i+1}
                  </a>
                ))}
                {target.websiteLinks?.map((l, i) => {
                  const handleLinkClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (!userProfile?.isPremium) {
                      e.preventDefault();
                      setIsPremiumModalOpen(true);
                    }
                  };
                  return (
                    <a key={i} href={l} onClick={handleLinkClick} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${isDarkTheme ? 'bg-white/10 hover:bg-white/20' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                      <ExternalLink size={12} /> Link {i+1}
                    </a>
                  );
                })}
              </div>
            )}

            {/* Interactions Overlay Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-black/5">
              <div className="flex items-center gap-2">
                {['Like', 'Fire', 'Heart'].map((type) => (
                  <button 
                    key={type}
                    onClick={(e) => handleAddReaction(target.id, type as any, e)}
                    className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                      hasReacted(target.id, type as any) 
                        ? 'bg-indigo-500 text-white' 
                        : isDarkTheme ? 'bg-white/5 text-white/60' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span>{type === 'Like' ? '👍' : type === 'Fire' ? '🔥' : '❤️'}</span>
                    <span>{getReactionCount(target.id, type as any)}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={async (e) => { 
                      e.stopPropagation();
                      if (!canMarkDone) {
                        if (!prevMissionSubmitted) {
                          alert(`Please submit the previous day's daily mission proof first!`);
                        } else {
                          alert(`Please submit today's daily mission proof first!`);
                        }
                        return;
                      }
                      
                      if (confirm(isTargetCompleted ? "Your target is already completed. Do you want to update/re-save completion?" : "Confirm Target Completion? Have you completed today's Target?")) {
                        try {
                          const now = new Date();
                          await TargetService.recordProgress({
                            targetId: target.id,
                            studentId: userProfile!.uid,
                            status: 'Completed',
                            taskStatuses: progress[target.id]?.taskStatuses || {},
                            completionPercentage: 100,
                            completedDate: now.toISOString().split('T')[0],
                            completedTime: now.toTimeString().split(' ')[0]
                          });
                          alert("Target marked as completed!");
                        } catch (err) {
                          console.error("Error marking target completed:", err);
                          alert("Failed to mark target as completed.");
                        }
                      }
                    }}
                    className={`text-[9px] font-black uppercase flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all active:scale-95 border ${
                      isTargetCompleted 
                        ? isDarkTheme 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : !canMarkDone
                          ? 'bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed opacity-50'
                          : isDarkTheme 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                    }`}
                    disabled={isTargetCompleted ? false : !canMarkDone}
                  >
                    {isTargetCompleted ? '✓ Completed' : '✓ Mark as Completed'}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate('/app/create-submission', { state: { targetId: target.id } }); }}
                    className={`text-[9px] font-black uppercase flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all active:scale-95 ${
                      isDarkTheme ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
                    }`}
                  >
                    Proof <ArrowRight size={10} />
                  </button>
                </div>
                {!canMarkDone && (
                  <p className={`text-[8px] font-bold mt-0.5 ${isDarkTheme ? 'text-rose-300' : 'text-rose-600'}`}>
                    🔒 Required: {!prevMissionSubmitted ? "previous day's" : "this day's"} mission proof.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <div className="px-2 self-end">
          <p className="text-[8px] font-bold text-slate-400 uppercase">
            {safeDate(target.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  };

  const filteredArchiveTargets = React.useMemo(() => {
    return targets
      .filter(t => {
        const tDay = parseTargetDay(t);
        return tDay !== null && tDay < prepDay;
      })
      .filter(t => t.status === 'published' || t.status === 'archived')
      .filter(t => {
        if (searchQuery) {
          const s = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(s);
          const matchDesc = t.description.toLowerCase().includes(s);
          const matchQuote = ((t as any).motivationalQuote || '').toLowerCase().includes(s);
          
          if (!matchTitle && !matchDesc && !matchQuote) return false;
        }
        
        if (searchDate) {
          const targetDay = safeSplitDate(t.createdAt);
          if (targetDay !== searchDate) return false;
        }

        return true;
      });
  }, [targets, searchQuery, searchDate, prepDay]);

  const bookmarkedTargets = React.useMemo(() => {
    return targets.filter(t => bookmarkedIds.includes(t.id));
  }, [targets, bookmarkedIds]);

  const todayTargets = React.useMemo(() => {
    return targets.filter(t => {
      const tDay = parseTargetDay(t);
      return tDay === prepDay || tDay === prepDay + 1;
    });
  }, [targets, prepDay]);

  return (
    <div 
      className="flex flex-col h-full bg-[#E8F0E8] overflow-y-auto pb-32 select-none relative"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
    >
      {/* Top Header Section with Integrated Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="text-emerald-600 shrink-0" />
            <div className="flex flex-col">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-none">Daily Schedule ({userProfile?.name?.split(' ')[0] || 'Target'})</h2>
              {batches && batches.length > 0 && (
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Batch:</span>
                  <div className="relative inline-block">
                    <select
                      value={currentBatchId || ''}
                      onChange={(e) => onBatchChange?.(e.target.value)}
                      className="appearance-none bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50 rounded-full pl-2.5 pr-6 py-0.5 text-[10px] font-black text-emerald-800 transition-all cursor-pointer outline-none"
                    >
                      {batches.filter(b => b.status === 'active').map(b => (
                        <option key={b.id} value={b.id}>
                          {b.batchName || b.batchCode}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1 w-3 h-3 text-emerald-700 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowNotifications(prev => !prev)}
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-205 text-slate-700 relative"
            >
              <Bell size={18} />
              {notifications.length > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />}
            </button>
          </div>
        </div>

        {/* Top Navigation Tabs */}
        <div className="flex px-4 pb-3 gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'today' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            <Sparkles size={14} />
            <span>Feed</span>
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'archive' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Clock size={14} />
            <span>Archive</span>
          </button>
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'bookmarks' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Bookmark size={14} />
            <span>Saved items</span>
          </button>
        </div>
      </div>

      {/* Dynamic Student Stats Panel */}
      <div className="bg-white border-b border-slate-150 p-4 sm:px-6 shadow-xs shrink-0">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Award size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Current Batch</p>
              <h3 className="text-sm font-black text-slate-900">{currentBatchName}</h3>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:text-right sm:flex-row-reverse">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Preparation Progress</p>
              <h3 className="text-sm font-black text-indigo-700">Day {prepDay} of SSC Preparation</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-6 flex flex-col">
        {/* 1. TODAY'S TARGETS TAB (Feed Style) */}
        {activeTab === 'today' && (
          <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full py-4">
            {todayTargets.length === 0 ? (
              <div className="text-center py-20 bg-white/80 border border-slate-200/50 rounded-[2rem] p-6 shadow-sm">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  <Calendar size={28} />
                </div>
                <h3 className="text-slate-900 font-extrabold mb-1 text-sm sm:text-base">Target Not Released</h3>
                <p className="text-slate-500 text-[11px] sm:text-xs font-semibold max-w-xs mx-auto leading-relaxed">
                  Your Preparation Day {prepDay} Target has not been dispatched yet. Please contact your Mentor or check back later!
                </p>
              </div>
            ) : (
              todayTargets.map((target, idx) => renderTelegramTargetCard(target, idx))
            )}
          </div>
        )}

        {/* Archives & Bookmarks would go here but minimized for a "single feed" feel */}
        {activeTab !== 'today' && (
          <div className="max-w-2xl mx-auto w-full py-4 space-y-4">
            {activeTab === 'archive' && (
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search past targets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                />
              </div>
            )}
            
            {activeTab === 'archive' ? (
              filteredArchiveTargets.length === 0 ? (
                <div className="text-center py-16 bg-white/70 border border-slate-200/50 rounded-[2rem] p-6 shadow-sm">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-450">
                    <Clock size={20} />
                  </div>
                  <h4 className="text-slate-800 font-bold text-xs mb-1">No past targets available</h4>
                  <p className="text-slate-500 text-[10px] font-semibold max-w-xs mx-auto">
                    You don't have any older preparation day targets yet, or none matched your current search criteria.
                  </p>
                </div>
              ) : (
                filteredArchiveTargets.map((target, idx) => renderTelegramTargetCard(target, idx))
              )
            ) : (
              bookmarkedTargets.length === 0 ? (
                <div className="text-center py-16 bg-white/70 border border-slate-200/50 rounded-[2rem] p-6 shadow-sm">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-450">
                    <Bookmark size={20} />
                  </div>
                  <h4 className="text-slate-800 font-bold text-xs mb-1">No saved items</h4>
                  <p className="text-slate-500 text-[10px] font-semibold max-w-xs mx-auto">
                    Bookmark important targets during preparation to see them saved here.
                  </p>
                </div>
              ) : (
                bookmarkedTargets.map((target, idx) => renderTelegramTargetCard(target, idx))
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
