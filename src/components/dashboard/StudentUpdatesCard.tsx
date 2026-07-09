import React, { useEffect, useState } from 'react';
import { 
  Bell,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Trophy,
  BookOpen,
  Star,
  CalendarCheck2,
  CalendarX2,
  FileCheck,
  MessageSquare,
  Target,
  Megaphone
} from 'lucide-react';
import { StudentUpdatesService, StudentUpdate } from '../../services/studentUpdates';
import { motion, AnimatePresence } from 'motion/react';

interface StudentUpdatesCardProps {
  studentId: string; // The DocId (userId)
  authUid?: string; // The Firebase Auth UID
  refreshTrigger?: number; // Optional force refresh trigger
}

export const StudentUpdatesCard: React.FC<StudentUpdatesCardProps> = ({ studentId, authUid, refreshTrigger }) => {
  const [updates, setUpdates] = useState<StudentUpdate[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;

    setLoading(true);
    const idsToQuery = [studentId];
    if (authUid && authUid !== studentId) {
      idsToQuery.push(authUid);
    }

    const unsubscribe = StudentUpdatesService.subscribeLatestUpdates(
      idsToQuery,
      (newUpdates) => {
        setUpdates(newUpdates);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to student updates:', err);
        setError('Failed to fetch updates in real-time');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [studentId, authUid, refreshTrigger]);

  const handleLoadMore = () => {
    setVisibleLimit(prev => prev + 10);
  };

  const getUpdateConfig = (type: string) => {
    switch (type) {
      case 'target_approved':
        return {
          emoji: '✅',
          icon: CheckCircle2,
          color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
          title: 'Target Approved'
        };
      case 'target_rejected':
        return {
          emoji: '❌',
          icon: XCircle,
          color: 'text-rose-600 bg-rose-50 border-rose-100',
          title: 'Target Rejected'
        };
      case 'rank_updated':
        return {
          emoji: '🏆',
          icon: Trophy,
          color: 'text-amber-500 bg-amber-50 border-amber-100',
          title: 'Rank Updated'
        };
      case 'test_evaluated':
        return {
          emoji: '📚',
          icon: BookOpen,
          color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
          title: 'Test Evaluated'
        };
      case 'premium_activated':
        return {
          emoji: '⭐',
          icon: Star,
          color: 'text-purple-600 bg-purple-50 border-purple-100',
          title: 'Premium Activated'
        };
      case 'premium_expired':
        return {
          emoji: '⭐',
          icon: Star,
          color: 'text-slate-500 bg-slate-50 border-slate-100',
          title: 'Premium Expired'
        };
      case 'leave_approved':
        return {
          emoji: '🚨',
          icon: CalendarCheck2,
          color: 'text-teal-600 bg-teal-50 border-teal-100',
          title: 'Leave Approved'
        };
      case 'leave_rejected':
        return {
          emoji: '🚨',
          icon: CalendarX2,
          color: 'text-red-700 bg-red-50 border-red-100',
          title: 'Leave Rejected'
        };
      case 'leave_cancelled':
        return {
          emoji: '🚨',
          icon: CalendarX2,
          color: 'text-slate-500 bg-slate-50 border-slate-100',
          title: 'Leave Cancelled'
        };
      case 'submission_reviewed':
        return {
          emoji: '📝',
          icon: FileCheck,
          color: 'text-violet-600 bg-violet-50 border-violet-100',
          title: 'Submission Reviewed'
        };
      case 'feedback_added':
        return {
          emoji: '💬',
          icon: MessageSquare,
          color: 'text-blue-600 bg-blue-50 border-blue-100',
          title: 'Mentor Feedback Added'
        };
      case 'new_assignment':
        return {
          emoji: '🎯',
          icon: Target,
          color: 'text-orange-600 bg-orange-50 border-orange-100',
          title: 'New Assignment'
        };
      case 'mentor_update':
      default:
        return {
          emoji: '📢',
          icon: Megaphone,
          color: 'text-pink-600 bg-pink-50 border-pink-100',
          title: 'Important Mentor Update'
        };
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      
      const isToday = d.getDate() === now.getDate() && 
                      d.getMonth() === now.getMonth() && 
                      d.getFullYear() === now.getFullYear();

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.getDate() === yesterday.getDate() && 
                          d.getMonth() === yesterday.getMonth() && 
                          d.getFullYear() === yesterday.getFullYear();

      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

      if (isToday) {
        return `Today • ${timeStr}`;
      } else if (isYesterday) {
        return `Yesterday • ${timeStr}`;
      } else {
        const dateOption = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        return `${dateOption} • ${timeStr}`;
      }
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="bg-white/80 p-6 rounded-[2rem] border border-slate-100 shadow-xs flex flex-col items-center justify-center py-10 min-h-[200px]">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-xs text-slate-400 mt-2 font-black uppercase tracking-widest">Checking live feed updates...</p>
      </div>
    );
  }

  const displayedUpdates = updates.slice(0, visibleLimit);
  const hasMore = updates.length > visibleLimit;

  return (
    <div id="student_updates_card" className="bg-white p-6 rounded-[2.5rem] border border-slate-200/80 shadow-xs">
      {/* Feed Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
          <Bell size={24} className="fill-blue-600/10" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>📢 Mentor Updates</span>
          </h2>
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Real-time Mentor Log</p>
        </div>
      </div>

      {updates.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-150 rounded-3xl">
          <p className="text-slate-400 text-sm font-black uppercase tracking-widest text-xs">All quiet here!</p>
          <p className="text-slate-400 text-[11px] mt-1">Status changes and mentor updates will appear here instantly as they happen.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {displayedUpdates.map((update, index) => {
              const config = getUpdateConfig(update.type);
              
              return (
                <motion.div 
                  key={`${update.id || 'update'}-${index}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.4) }}
                  className="p-4 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-all duration-200"
                >
                  <div className="flex items-start gap-4">
                    {/* Status Icon with Emoji */}
                    <div className="text-2xl leading-none select-none p-1 shrink-0 bg-white shadow-xs rounded-xl border border-slate-150/40 w-10 h-10 flex items-center justify-center">
                      {config.emoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <p className="font-black text-sm text-slate-900 leading-tight">
                          {update.title || config.title}
                        </p>
                        <span className="text-[10px] text-slate-400 font-bold shrink-0">
                          {formatRelativeTime(update.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs mt-1.5 leading-relaxed font-medium">
                        {update.description}
                      </p>
                      
                      {update.remark && (
                        <div className="mt-3 p-3 rounded-2xl bg-white border border-slate-150/60 text-xs text-slate-600 font-medium">
                          <span className="font-black text-[9px] text-slate-400 block uppercase tracking-widest mb-1">Mentor Remark:</span>
                          <p className="italic leading-relaxed">"{update.remark}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Load More Trigger */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          className="w-full mt-4 py-3.5 bg-slate-950 hover:bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-3xl flex items-center justify-center gap-1.5 active:scale-98 shadow-md transition-all duration-200"
        >
          <ChevronDown size={14} />
          Load More Updates
        </button>
      )}
    </div>
  );
};
