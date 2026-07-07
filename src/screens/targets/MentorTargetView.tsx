import React, { useState } from 'react';
import { DailyTarget } from '../../models/mission';
import { 
  Plus, Search, Filter, Calendar as CalendarIcon, Clock, 
  Paperclip, GripVertical, CheckCircle, Circle, Pin, 
  FolderLock, RefreshCw, Layout, ToggleLeft, ToggleRight,
  Sparkles, ListCollapse, BookOpen, Trash, Mic, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TargetFormModal from './TargetFormModal';
import { TargetService } from '../../services/target';
import { safeDate } from '../../utils/date';

interface Props {
  targets: DailyTarget[];
}

export default function MentorTargetView({ targets }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<DailyTarget | null>(null);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<'all' | 'published' | 'draft' | 'scheduled' | 'archived'>('all');

  const filteredTargets = React.useMemo(() => targets.filter(t => {
    const term = search.toLowerCase();
    const matchTerm = t.title.toLowerCase().includes(term) || 
                      (t.specialNotice && t.specialNotice.toLowerCase().includes(term)) ||
                      ((t as any).missionDay && (t as any).missionDay.toLowerCase().includes(term));
    
    if (!matchTerm) return false;

    if (filterState === 'all') return true;
    return t.status === filterState;
  }), [targets, search, filterState]);

  // Aggregated Stat metrics
  const stats = React.useMemo(() => ({
    totalCount: targets.length,
    publishedCount: targets.filter(t => t.status === 'published').length,
    draftCount: targets.filter(t => t.status === 'draft').length,
    scheduledCount: targets.filter(t => t.status === 'scheduled').length,
    archivedCount: targets.filter(t => t.status === 'archived').length,
  }), [targets]);

  const handleQuickUnpublish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Would you like to draft this coordinate? It will become invisible to students.")) {
      try {
        await TargetService.updateTarget(id, { status: 'draft' });
      } catch (err) {
        alert("Action restriction block.");
      }
    }
  };

  const handleQuickPublish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Authorize publishing now? This makes training targets live in class!")) {
      try {
        await TargetService.updateTarget(id, { status: 'published' });
      } catch (err) {
        alert("Action restriction block.");
      }
    }
  };

  const handleQuickRestore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Restore this archived coordinate back into active coordinates?")) {
      try {
        await TargetService.updateTarget(id, { status: 'published' });
      } catch (err) {
        alert("Failed to restore target");
      }
    }
  };

  const handleDuplicateTarget = async (target: DailyTarget, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Duplicate target "${target.title}"?`)) {
      try {
        const { id, createdAt, updatedAt, ...rest } = target as any;
        const payload = {
          ...rest,
          title: `${target.title} (Copy)`,
          status: 'draft',
          isPinned: false
        };
        await TargetService.createTarget(payload);
        alert("Target duplicated successfully as draft!");
      } catch (err) {
        console.error("Duplicate target failed:", err);
        alert("Failed to duplicate target.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative select-none">
      <div className="p-4 flex-1 overflow-y-auto pb-32">
        
        {/* Mentor Header Title */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-black text-slate-900 leading-none">Classroom Coordinator Hub</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Dispatched Academic Units</p>
          </div>
          
          <button 
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs p-3 px-5 rounded-2xl transition-all shadow-md active:scale-95 shadow-indigo-100"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Draft Mission Coords</span>
          </button>
        </div>

        {/* SECTION A: STATS CARD ROW */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-5">
          <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100/80 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total Targets</span>
            <span className="text-base font-black text-slate-950 mt-1">{stats.totalCount} decks</span>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100/80 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Active Live</span>
            <span className="text-base font-black text-emerald-700 mt-1">{stats.publishedCount} units</span>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100/80 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase text-amber-500 tracking-wider">Drafts</span>
            <span className="text-base font-black text-amber-600 mt-1">{stats.draftCount} hold</span>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100/80 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Scheduled</span>
            <span className="text-base font-black text-indigo-600 mt-1">{stats.scheduledCount} fut</span>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100/80 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Archived</span>
            <span className="text-base font-black text-slate-700 mt-1">{stats.archivedCount} saved</span>
          </div>
        </div>

        {/* SECTION B: SELECTABLE DESTRUCTIVE FILTERS */}
        <div className="mb-4 flex overflow-x-auto pb-1.5 scrollbar-none sm:flex-wrap gap-1 bg-white p-1 rounded-2xl border border-slate-200/55 max-w-xl">
          <button 
            type="button"
            onClick={() => setFilterState('all')} 
            className={`px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap shrink-0 ${filterState === 'all' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            All Decks
          </button>
          
          <button 
            type="button"
            onClick={() => setFilterState('published')} 
            className={`px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap shrink-0 ${filterState === 'published' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Live ({stats.publishedCount})
          </button>
          
          <button 
            type="button"
            onClick={() => setFilterState('draft')} 
            className={`px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap shrink-0 ${filterState === 'draft' ? 'bg-amber-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Drafts ({stats.draftCount})
          </button>

          <button 
            type="button"
            onClick={() => setFilterState('scheduled')} 
            className={`px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap shrink-0 ${filterState === 'scheduled' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Scheduled ({stats.scheduledCount})
          </button>

          <button 
            type="button"
            onClick={() => setFilterState('archived')} 
            className={`px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap shrink-0 ${filterState === 'archived' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Archives ({stats.archivedCount})
          </button>
        </div>

        {/* DECK SEARCH ENGINE */}
        <div className="flex items-center space-x-3 mb-6 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search target themes, day numbers, notices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>
          
          <button 
            type="button"
            className="p-3 bg-white border border-slate-200/80 rounded-2xl hover:bg-slate-50 text-slate-500 active:scale-95 transition-all text-xs font-bold"
          >
            Refresh List
          </button>
        </div>

        {/* MASTER CARDS CONTAINER */}
        <div className="grid grid-cols-1 gap-4">
          {filteredTargets.map((target) => {
            const taskCount = target.tasks?.length || 0;
            const pdfCount = target.pdfLinks?.length || 0;
            const videoCount = target.youtubeLinks?.length || 0;
            const linkCount = target.websiteLinks?.length || 0;
            const totalResources = pdfCount + videoCount + linkCount;

            return (
              <div 
                key={target.id}
                onClick={() => setEditTarget(target)}
                className="bg-white p-5 rounded-[2.2rem] shadow-sm border border-slate-100 hover:border-slate-300 transition-all duration-200 cursor-pointer flex flex-col justify-between relative group"
              >
                {/* Pin element top-left indicator */}
                {target.isPinned && (
                  <div className="absolute top-0 left-6 -translate-y-1/2 bg-indigo-650 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                    <Pin size={8} className="fill-white"/>
                    Sticky Notice PIN
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                          {(target as any).missionDay || `MISSION DAY ${target.id.substring(0,3).toUpperCase()}`}
                        </span>
                        {(target as any).targetDay !== undefined && (target as any).targetDay !== null && (
                          <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-lg">
                            Target Day {(target as any).targetDay}
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-slate-900 text-sm tracking-tight mt-1 group-hover:text-indigo-600 transition-colors leading-snug">
                        {target.title}
                      </h3>
                    </div>
                    
                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full ${
                      target.status === 'published' ? 'bg-indigo-50 text-indigo-650 border border-indigo-100' :
                      target.status === 'scheduled' ? 'bg-blue-50 text-blue-650 border border-blue-105' :
                      target.status === 'draft' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-slate-100 text-slate-650 border border-slate-200'
                    }`}>
                      {target.status}
                    </span>
                  </div>
                  
                  {/* Unified resources info badging */}
                  <div className="flex flex-wrap gap-1 mb-3 pt-1">
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border bg-indigo-50 text-indigo-600 border-indigo-100">
                      {taskCount} Tasks Checklist
                    </span>
                    {target.voiceUrl && (
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1">
                        <Mic size={8} /> Voice Ready
                      </span>
                    )}
                    {totalResources > 0 && (
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border bg-amber-50 text-amber-600 border-amber-100">
                        {totalResources} Material Links
                      </span>
                    )}
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border bg-slate-50 text-slate-500 border-slate-100">
                      Visibility: {target.visibility}
                    </span>
                  </div>

                  {target.specialNotice && (
                    <div className="text-[9px] font-black text-amber-600 mb-3 py-1 px-2.5 bg-amber-50 rounded-xl inline-block self-start border border-amber-100">
                      公告 notice: {target.specialNotice}
                    </div>
                  )}

                  {/* Motivations block quote */}
                  {(target as any).motivationalQuote && (
                    <p className="text-slate-400 italic text-[10px] leading-relaxed mb-4 line-clamp-2">
                      “{(target as any).motivationalQuote}”
                    </p>
                  )}

                  {/* Scheduled clock indicator */}
                  {target.status === 'scheduled' && (target as any).scheduledFor && (
                    <div className="text-[9px] font-bold text-blue-600 flex items-center gap-1.5 mb-4 p-2 bg-blue-50 rounded-xl border border-blue-100 self-start">
                      <Clock size={10} />
                      <span>Clock scheduled: {safeDate((target as any).scheduledFor).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Card footer details & interactive controls */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-auto pt-3 border-t border-slate-100/60" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center space-x-3">
                    <span className="capitalize font-bold text-slate-500">{target.visibility}</span>
                    <span>By {(target as any).mentorName || target.creatorName || 'Mentor'}</span>
                  </div>
                  
                  {/* Rapid action toggle triggers */}
                  <div className="flex items-center gap-1.5">
                    <button 
                      type="button"
                      onClick={(e) => handleDuplicateTarget(target, e)}
                      className="text-[9px] font-black uppercase text-slate-600 hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-205 bg-white flex items-center gap-1"
                      title="Duplicate this target"
                    >
                      <Copy size={10} />
                      <span>Copy</span>
                    </button>

                    {target.status === 'published' && (
                      <button 
                        type="button"
                        onClick={(e) => handleQuickUnpublish(target.id, e)}
                        className="text-[9px] font-black uppercase text-amber-600 hover:bg-amber-50 px-2 py-0.5 rounded border border-amber-100 bg-white"
                        title="Change status to Draft"
                      >
                        Unpublish
                      </button>
                    )}
                    {target.status === 'draft' && (
                      <button 
                        type="button"
                        onClick={(e) => handleQuickPublish(target.id, e)}
                        className="text-[9px] font-black uppercase text-indigo-650 hover:bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 bg-white"
                        title="Publish target to class"
                      >
                        Publish Target
                      </button>
                    )}
                    {target.status === 'archived' && (
                      <button 
                        type="button"
                        onClick={(e) => handleQuickRestore(target.id, e)}
                        className="text-[9px] font-black uppercase text-emerald-600 hover:bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 bg-white"
                        title="Restore archived coordinate"
                      >
                        Restore Deck
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredTargets.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white rounded-[2.2rem] border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layout className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-slate-900 font-extrabold mb-1">Radar Clear of Matches</h3>
              <p className="text-slate-500 text-xs font-semibold">No target coordinates found in this filters quadrant.</p>
              <button 
                type="button"
                onClick={() => { setSearch(''); setFilterState('all'); }} 
                className="bg-indigo-50 text-indigo-600 font-bold hover:underline px-4 py-2 mt-4 text-xs rounded-xl"
              >
                Clear Coordinates Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <TargetFormModal 
            onClose={() => setShowCreate(false)} 
          />
        )}
        {editTarget && (
          <TargetFormModal 
            target={editTarget} 
            onClose={() => setEditTarget(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
