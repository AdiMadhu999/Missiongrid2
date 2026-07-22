import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, BookOpen, Trash2, Edit2, RefreshCw, 
  ChevronLeft, CheckSquare, Square, Download, FolderOpen, 
  Archive, Eye, Trash, BarChart2, Check, X, Award, Globe, 
  FileJson, Copy, Star, Sparkles, BookCheck, HelpCircle, 
  Clock, CheckCircle, Percent, Video, FileText, Link2, Image,
  AlertTriangle
} from 'lucide-react';
import { getQuestions, archiveQuestion, deleteQuestion, restoreQuestion } from '../../services/question';
import { TestService } from '../../services/test';
import { Question } from '../../models/question';
import QuestionCreateEdit from './QuestionCreateEdit';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../providers/AuthProvider';
import { formatQuestionText } from '../../lib/utils';

export default function QuestionBankScreen({ onBack }: { onBack: () => void }) {
  const { userProfile } = useAuth();
  const role = (userProfile?.role || '').toLowerCase();
  const isMentor = role === 'mentor' || role === 'primary-mentor' || role === 'staff' || role === 'admin' || role === 'examiner';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  
  // Filtering and Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterExam, setFilterExam] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Expanded preview state
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await getQuestions();
      setQuestions(data);
    } catch (err: any) {
      console.error("Error loading questions:", err);
      toast.error("Failed to load questions from library");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveQuestion(id);
      toast.success("Question archived successfully");
      loadQuestions();
    } catch (err: any) {
      toast.error("Failed to archive question");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this question from the library?")) return;
    try {
      await deleteQuestion(id);
      toast.success("Question deleted permanently");
      loadQuestions();
    } catch (err: any) {
      toast.error("Failed to delete question");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreQuestion(id);
      toast.success("Question restored to verified status");
      loadQuestions();
    } catch (err: any) {
      toast.error("Failed to restore question");
    }
  };

  const handleMigrateScoring = async () => {
    if (!window.confirm("This will update ALL existing tests and student results to the new standard (+2 for correct, -0.5 for wrong). This action is irreversible. Proceed?")) return;
    
    try {
      setLoading(true);
      const res = await TestService.migrateScoringData();
      toast.success(`Migration Successful! Updated ${res.testsUpdated} tests and ${res.attemptsUpdated} student attempts.`);
      loadQuestions();
    } catch (err: any) {
      console.error("Migration error:", err);
      toast.error(err.message || "Scoring migration failed");
    } finally {
      setLoading(false);
    }
  };

  // Bulk actions handlers
  const handleToggleSelectAll = (filteredQuestions: Question[]) => {
    if (selectedIds.length === filteredQuestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map(q => q.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete these ${selectedIds.length} questions from the library?`)) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await deleteQuestion(id);
      }
      toast.success(`Successfully deleted ${selectedIds.length} questions.`);
      setSelectedIds([]);
      loadQuestions();
    } catch (err: any) {
      toast.error("Failed to bulk delete some questions");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await archiveQuestion(id);
      }
      toast.success(`Successfully archived ${selectedIds.length} questions.`);
      setSelectedIds([]);
      loadQuestions();
    } catch (err: any) {
      toast.error("Failed to bulk archive some questions");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await restoreQuestion(id);
      }
      toast.success(`Successfully restored ${selectedIds.length} questions.`);
      setSelectedIds([]);
      loadQuestions();
    } catch (err: any) {
      toast.error("Failed to bulk restore some questions");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = () => {
    if (selectedIds.length === 0) return;
    const exportData = questions.filter(q => selectedIds.includes(q.id));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `missiongrid_questions_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`Exported ${selectedIds.length} questions as JSON file.`);
  };

  // Extract unique filter options from database items
  const subjects = Array.from(new Set(questions.map(q => q.subject || '').filter(Boolean)));
  const exams = Array.from(new Set(questions.map(q => q.exam || q.examCategory || '').filter(Boolean)));
  const languages = Array.from(new Set(questions.map(q => q.language || '').filter(Boolean)));

  // Filter application
  const filteredQuestions = questions.filter(q => {
    // 1. Text & Tags Search Match
    const qText = (q.text || '').toLowerCase();
    const qSub = (q.subject || '').toLowerCase();
    const qCh = (q.chapter || '').toLowerCase();
    const qTop = (q.topic || '').toLowerCase();
    const qSubtop = (q.subtopic || '').toLowerCase();
    const qTags = (q.tags || []).join(' ').toLowerCase();
    const term = searchTerm.toLowerCase();

    const matchesSearch = 
      qText.includes(term) || 
      qSub.includes(term) || 
      qCh.includes(term) || 
      qTop.includes(term) || 
      qSubtop.includes(term) ||
      qTags.includes(term);

    // 2. Filters matches
    const matchesSubject = filterSubject === 'all' || q.subject === filterSubject;
    const matchesDifficulty = filterDifficulty === 'all' || (q.difficulty || '').toLowerCase() === filterDifficulty.toLowerCase();
    const matchesStatus = filterStatus === 'all' || (q.status || 'draft').toLowerCase() === filterStatus.toLowerCase();
    const matchesType = filterType === 'all' || q.type === filterType;
    const matchesExam = filterExam === 'all' || q.exam === filterExam || q.examCategory === filterExam;
    const matchesLanguage = filterLanguage === 'all' || q.language === filterLanguage;

    return matchesSearch && matchesSubject && matchesDifficulty && matchesStatus && matchesType && matchesExam && matchesLanguage;
  });

  const getDifficultyColor = (diff?: string) => {
    switch (String(diff || '').toLowerCase()) {
      case 'easy': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'hard': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (String(status || 'draft').toLowerCase()) {
      case 'verified':
      case 'approved':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-green-50 text-green-700 border border-green-200">Verified</span>;
      case 'published':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">Published</span>;
      case 'archived':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">Archived</span>;
      case 'draft':
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-yellow-50 text-yellow-700 border border-yellow-200">Draft</span>;
    }
  };

  if (!isMentor) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-50">
        <AlertTriangle size={48} className="text-rose-500 mb-3 animate-bounce" />
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">
          Only authorized mentors and administrators have permission to view or manage the MissionGrid Question Library.
        </p>
        <button
          onClick={onBack}
          className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all uppercase tracking-wider"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (isCreating || editingQuestion) {
    return (
      <QuestionCreateEdit 
        question={editingQuestion} 
        onClose={() => { setIsCreating(false); setEditingQuestion(null); }} 
        onSaved={() => { loadQuestions(); setSelectedIds([]); }} 
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      {/* Header section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BookCheck className="w-5 h-5 text-indigo-600" />
              <span>MissionGrid Question Library</span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Centralized Educational Repository</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handleMigrateScoring} 
            disabled={loading}
            className="p-2.5 bg-white text-slate-600 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 disabled:opacity-50 transition-colors"
            title="Sync all tests to +2/-0.5 scoring standard"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
          </button>
          <button 
            onClick={() => setIsCreating(true)} 
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md flex items-center gap-1 font-bold text-xs transition-all"
          >
            <Plus size={16}/>
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Main filter & search workspace */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Search by text, subject, tags..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-colors" 
            />
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-black transition-colors shadow-sm ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <Filter size={14}/>
            <span>Filters</span>
          </button>
        </div>

        {/* Collapsible advanced filters */}
        {showFilters && (
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Subject Filter */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Subject</label>
              <select 
                value={filterSubject} 
                onChange={e => setFilterSubject(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="all">All Subjects</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Difficulty</label>
              <select 
                value={filterDifficulty} 
                onChange={e => setFilterDifficulty(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            {/* Quality Status Filter */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Quality Status</label>
              <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="verified">Verified</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Question Type Filter */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Question Type</label>
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="all">All Types</option>
                <option value="single_mcq">Single Correct MCQ</option>
                <option value="multiple_mcq">Multiple Correct MCQ</option>
                <option value="true_false">True/False</option>
                <option value="assertion_reason">Assertion Reason</option>
                <option value="match_following">Match Following</option>
                <option value="numerical">Numerical / Integer</option>
              </select>
            </div>

            {/* Exam category filter */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Target Exam</label>
              <select 
                value={filterExam} 
                onChange={e => setFilterExam(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="all">All Exams</option>
                {exams.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>

            {/* Language filter */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Language</label>
              <select 
                value={filterLanguage} 
                onChange={e => setFilterLanguage(e.target.value)}
                className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="all">All Languages</option>
                {languages.map(la => <option key={la} value={la}>{la}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl flex items-center justify-between mb-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-indigo-500 rounded-lg text-white font-black text-[10px] uppercase">{selectedIds.length} Selected</span>
            <span className="text-xs text-slate-400 hidden sm:inline">Bulk Actions:</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleBulkExport} 
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
              title="Export Selected"
            >
              <Download size={14} />
              <span className="hidden md:inline">Export</span>
            </button>
            <button 
              onClick={handleBulkArchive} 
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
              title="Archive Selected"
            >
              <Archive size={14} />
              <span className="hidden md:inline">Archive</span>
            </button>
            <button 
              onClick={handleBulkRestore} 
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
              title="Restore Selected"
            >
              <CheckCircle size={14} />
              <span className="hidden md:inline">Restore</span>
            </button>
            <button 
              onClick={handleBulkDelete} 
              className="p-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
              title="Delete Selected"
            >
              <Trash size={14} />
              <span className="hidden md:inline">Delete</span>
            </button>
            <button 
              onClick={() => setSelectedIds([])} 
              className="p-1 text-slate-400 hover:text-white ml-2"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Questions list area */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Question Library...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
            <HelpCircle className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No questions found</p>
            <p className="text-xs text-slate-400 mt-1">Adjust search parameters or filters to expand matching results.</p>
          </div>
        ) : (
          <>
            {/* List header table style */}
            <div className="flex items-center px-4 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <button 
                onClick={() => handleToggleSelectAll(filteredQuestions)}
                className="mr-3 p-1 hover:bg-slate-100 rounded"
              >
                {selectedIds.length === filteredQuestions.length ? (
                  <CheckSquare size={14} className="text-indigo-600" />
                ) : (
                  <Square size={14} />
                )}
              </button>
              <div className="flex-1">Question Details</div>
              <div className="w-32 text-right hidden md:block">Analytics</div>
              <div className="w-24 text-right">Actions</div>
            </div>

            {/* List items */}
            {filteredQuestions.map((q, idx) => {
              const isExpanded = expandedQuestionId === q.id;
              const isSelected = selectedIds.includes(q.id);

              return (
                <div 
                  key={q.id || `q-${idx}`} 
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${isSelected ? 'border-indigo-400 bg-indigo-50/10' : 'border-slate-200/80'}`}
                >
                  <div className="p-4 flex items-start gap-3">
                    {/* Multiselect Checkbox */}
                    <button 
                      onClick={() => handleToggleSelectOne(q.id)}
                      className="mt-1 text-slate-400 hover:text-indigo-600 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare size={16} className="text-indigo-600" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>

                    {/* Left Icon */}
                    <div 
                      onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                      className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 shrink-0 cursor-pointer hover:bg-slate-100"
                    >
                      <BookOpen size={16} />
                    </div>

                    {/* Question summary info */}
                    <div 
                      onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <p className="font-bold text-slate-900 text-xs md:text-sm leading-relaxed line-clamp-2 pr-2">
                        {q.text}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {/* Status badge */}
                        {getStatusBadge(q.status)}

                        {/* Subject Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          {q.subject || 'No Subject'}
                        </span>

                        {/* Chapter / Topic */}
                        {q.chapter && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-indigo-50/50 text-indigo-700">
                            {q.chapter}
                          </span>
                        )}

                        {/* Difficulty Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${getDifficultyColor(q.difficulty)}`}>
                          {q.difficulty || 'Medium'}
                        </span>

                        {/* Exam category badge */}
                        {(q.exam || q.examCategory) && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-violet-50 text-violet-700 border border-violet-100">
                            {q.exam || q.examCategory}
                          </span>
                        )}

                        {/* Language badge */}
                        {q.language && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-50 text-slate-500 border border-slate-100 flex items-center gap-0.5">
                            <Globe size={8} />
                            {q.language}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Simple Analytic Counter (Desktop) */}
                    <div className="w-28 text-right hidden md:flex flex-col justify-center shrink-0 pr-2">
                      <div className="text-xs font-black text-slate-800 flex items-center justify-end gap-1">
                        <Clock size={12} className="text-slate-400" />
                        <span>Used: {q.timesUsed || 0} times</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                        {q.averageAccuracy !== undefined ? `Accuracy: ${q.averageAccuracy}%` : 'No attempts'}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)} 
                        className={`p-1.5 rounded-lg border transition-colors ${isExpanded ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
                        title="Quick View Details"
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        onClick={() => setEditingQuestion(q)} 
                        className="p-1.5 text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="Edit Question"
                      >
                        <Edit2 size={14}/>
                      </button>
                      {q.status === 'archived' ? (
                        <button 
                          onClick={() => handleRestore(q.id)} 
                          className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors"
                          title="Restore Question"
                        >
                          <CheckCircle size={14}/>
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleArchive(q.id)} 
                          className="p-1.5 text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Archive Question"
                        >
                          <Archive size={14}/>
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(q.id)} 
                        className="p-1.5 text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-lg transition-colors"
                        title="Delete Permanently"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Information Drawer */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-4 animate-in fade-in duration-150">
                      {/* Question Content */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 mb-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Question</h4>
                        <p className="text-lg text-slate-900 leading-relaxed font-serif">{formatQuestionText(q.text)}</p>
                        {q.formula_latex && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm font-mono text-slate-700 border border-slate-200 overflow-x-auto">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Formula (LaTeX)</span>
                            {q.formula_latex}
                          </div>
                        )}
                        {q.diagram_svg && (
                          <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 overflow-x-auto">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Diagram</span>
                            <div dangerouslySetInnerHTML={{ __html: q.diagram_svg }} className="mx-auto" />
                          </div>
                        )}
                      </div>

                      {/* Interactive Options Preview */}
                      {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Options & Key</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = opt.isCorrect || q.correctAnswer === String(oIdx);
                              return (
                                <div 
                                  key={oIdx} 
                                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-slate-200 text-slate-700'}`}
                                >
                                  <span>{String.fromCharCode(65 + oIdx)}. {typeof opt === 'object' ? opt.text : opt}</span>
                                  {isCorrect && <CheckCircle size={14} className="text-emerald-600 shrink-0 ml-2" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Explanation Block */}
                      {q.explanation && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Star size={10} className="text-indigo-500" />
                            <span>Stepwise Explanation & Solutions</span>
                          </h4>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{q.explanation}</p>
                        </div>
                      )}

                      {/* Rich Media Displays (Images) */}
                      {(q.imageUrl || q.solutionImageUrl) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {q.imageUrl && (
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Image size={10} className="text-indigo-500" />
                                <span>Question Diagram / Image</span>
                              </h4>
                              <img 
                                src={q.imageUrl} 
                                alt="Question Diagram" 
                                referrerPolicy="no-referrer" 
                                className="max-h-48 rounded-lg object-contain bg-slate-50 border border-slate-100 mx-auto" 
                              />
                            </div>
                          )}
                          {q.solutionImageUrl && (
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Image size={10} className="text-indigo-500" />
                                <span>Solution Steps / Visual</span>
                              </h4>
                              <img 
                                src={q.solutionImageUrl} 
                                alt="Solution Visual" 
                                referrerPolicy="no-referrer" 
                                className="max-h-48 rounded-lg object-contain bg-slate-50 border border-slate-100 mx-auto" 
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Reference Links & Study Attachments */}
                      {(q.youtubeLink || q.pdfLink || q.driveLink || q.websiteLink) && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Link2 size={10} className="text-indigo-500" />
                            <span>Interactive Reference Resources</span>
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {q.youtubeLink && (
                              <a 
                                href={q.youtubeLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors text-xs font-bold flex items-center gap-1.5"
                              >
                                <Video size={12} />
                                <span>Video Explanation</span>
                              </a>
                            )}
                            {q.pdfLink && (
                              <a 
                                href={q.pdfLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors text-xs font-bold flex items-center gap-1.5"
                              >
                                <FileText size={12} />
                                <span>PDF Reference</span>
                              </a>
                            )}
                            {q.driveLink && (
                              <a 
                                href={q.driveLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-bold flex items-center gap-1.5"
                              >
                                <Link2 size={12} />
                                <span>Google Drive Docs</span>
                              </a>
                            )}
                            {q.websiteLink && (
                              <a 
                                href={q.websiteLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors text-xs font-bold flex items-center gap-1.5"
                              >
                                <Globe size={12} />
                                <span>Website Reference</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Extended parameters / analytics grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {/* Topic */}
                        {q.topic && (
                          <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Topic</span>
                            <span className="text-xs font-bold text-slate-800">{q.topic}</span>
                          </div>
                        )}

                        {/* Subtopic */}
                        {q.subtopic && (
                          <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Subtopic</span>
                            <span className="text-xs font-bold text-slate-800">{q.subtopic}</span>
                          </div>
                        )}

                        {/* Source */}
                        {q.source && (
                          <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Source</span>
                            <span className="text-xs font-bold text-slate-800">{q.source}</span>
                          </div>
                        )}

                        {/* Marks */}
                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                          <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Marks Per Question</span>
                          <span className="text-xs font-black text-slate-800">+{q.marks || 2} / -0.5</span>
                        </div>

                        {/* Last Modified */}
                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                          <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Last Modified</span>
                          <span className="text-xs font-bold text-slate-600">{q.updatedAt ? new Date(q.updatedAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>

                      {/* Analytics details */}
                      <div className="bg-indigo-950 text-indigo-100 p-3.5 rounded-2xl border border-indigo-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-900 rounded-xl text-indigo-300">
                            <BarChart2 size={16} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Question Library Performance metrics</h4>
                            <p className="text-[11px] text-indigo-200 mt-0.5">Real-time statistics synchronized across all test attempts</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-sm font-black text-white">{q.timesUsed || 0}</div>
                            <div className="text-[8px] text-indigo-300 uppercase font-bold tracking-wider">Times Used</div>
                          </div>
                          <div>
                            <div className="text-sm font-black text-emerald-400">{q.averageAccuracy !== undefined ? `${q.averageAccuracy}%` : 'N/A'}</div>
                            <div className="text-[8px] text-indigo-300 uppercase font-bold tracking-wider">Avg Accuracy</div>
                          </div>
                          <div>
                            <div className="text-sm font-black text-indigo-200">{q.averageTimeTaken ? `${q.averageTimeTaken}s` : 'N/A'}</div>
                            <div className="text-[8px] text-indigo-300 uppercase font-bold tracking-wider">Avg Time Taken</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
