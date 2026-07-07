import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, BookOpen, Users, Edit2, Trash2, CheckCircle, 
  Archive, ToggleLeft, ToggleRight, X, UserCheck, AlertTriangle, 
  SlidersHorizontal, RefreshCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../providers/AuthProvider';
import { BatchService } from '../../services/batch';
import { getUsers } from '../../services/users';
import { Batch } from '../../models/mission';
import { User } from '../../models/user';

export default function BatchManagementScreen() {
  const { userProfile } = useAuth();
  
  // States
  const [batches, setBatches] = useState<Batch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatusTab, setActiveStatusTab] = useState<'active' | 'inactive' | 'archived'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [selectedMentorFilter, setSelectedMentorFilter] = useState<string>('all');
  const [selectedExaminerFilter, setSelectedExaminerFilter] = useState<string>('all');
  
  // Modals & Action States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [studentsModalBatch, setStudentsModalBatch] = useState<Batch | null>(null);
  const [examinersModalBatch, setExaminersModalBatch] = useState<Batch | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedExaminers, setSelectedExaminers] = useState<string[]>([]);

  // Form Fields
  const [formFields, setFormFields] = useState({
    batchName: '',
    batchCode: '',
    description: '',
  });

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    try {
      let bList = await BatchService.getBatches();
      const uList = await getUsers();

      const seedBatches = [
        { name: 'Mission Selection', code: 'MISSION_SEL', desc: 'Primary selection process cohort.' },
        { name: 'Mission Selection final fighters', code: 'MS_FF', desc: 'Elite league final fighters squad.' },
        { name: 'Ssc CGL warriors', code: 'SSC_CGL', desc: 'Dedicated SSC CGL target mapping cohort.' }
      ];

      let seeded = false;
      for (const item of seedBatches) {
        const exists = bList.some(b => b.batchCode?.toUpperCase() === item.code || b.batchName?.toLowerCase() === item.name.toLowerCase());
        if (!exists) {
          await BatchService.createBatch({
            batchName: item.name,
            batchCode: item.code,
            description: item.desc,
            mentorId: userProfile?.id || userProfile?.mobile || '7407463884',
            examinerIds: [],
            studentIds: [],
            status: 'active',
            createdBy: 'System Preseed'
          });
          seeded = true;
        }
      }

      if (seeded) {
        bList = await BatchService.getBatches();
      }

      setBatches(bList);
      setUsers(uList);
    } catch (err) {
      console.error("Error loading batch management data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Form handler
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormFields({
      ...formFields,
      [e.target.name]: e.target.value
    });
  };

  // Open creation modal
  const openCreateModal = () => {
    setFormFields({ batchName: '', batchCode: '', description: '' });
    setEditingBatch(null);
    setShowCreateModal(true);
  };

  // Open edit modal
  const openEditModal = (batch: Batch) => {
    setEditingBatch(batch);
    setFormFields({
      batchName: batch.batchName || '',
      batchCode: batch.batchCode || '',
      description: batch.description || '',
    });
    setShowCreateModal(true);
  };

  // Save Batch (Create or Edit)
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFields.batchName.trim() || !formFields.batchCode.trim()) {
      alert("Name and unique code are required!");
      return;
    }

    try {
      if (editingBatch && editingBatch.id) {
        // Edit flow
        await BatchService.updateBatch(editingBatch.id, {
          batchName: formFields.batchName.trim(),
          batchCode: formFields.batchCode.trim().toUpperCase(),
          description: formFields.description.trim(),
        });
        alert("Batch updated successfully!");
      } else {
        // Create flow
        await BatchService.createBatch({
          batchName: formFields.batchName.trim(),
          batchCode: formFields.batchCode.trim().toUpperCase(),
          description: formFields.description.trim(),
          mentorId: userProfile?.id || userProfile?.mobile || 'unknown',
          examinerIds: [],
          studentIds: [],
          status: 'active',
          createdBy: userProfile?.name || userProfile?.email || 'System'
        });
        alert("Batch created successfully!");
      }
      setShowCreateModal(false);
      setEditingBatch(null);
      loadData();
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    }
  };

  // Toggle status of Batch
  const handleUpdateStatus = async (batch: Batch, newStatus: 'active' | 'inactive' | 'archived') => {
    if (!batch.id) return;
    try {
      await BatchService.updateBatch(batch.id, { status: newStatus });
      alert(`Batch set to ${newStatus}`);
      loadData();
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  // Delete empty batch
  const handleDeleteBatch = async (batch: Batch) => {
    if (!batch.id) return;
    if (batch.studentIds && batch.studentIds.length > 0) {
      alert("You cannot delete this batch. It has assigned students. Please transfer or remove them first.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the empty batch "${batch.batchName}"?`)) {
      return;
    }
    try {
      await BatchService.deleteBatch(batch.id, []);
      alert("Batch deleted successfully");
      loadData();
    } catch (err: any) {
      alert("Error deleting batch: " + err.message);
    }
  };

  // Open Students Assignment Dialog
  const openStudentsModal = (batch: Batch) => {
    setStudentsModalBatch(batch);
    setSelectedStudents(batch.studentIds || []);
  };

  // Save Student Assignments
  const handleSaveStudents = async () => {
    if (!studentsModalBatch || !studentsModalBatch.id) return;
    try {
      await BatchService.assignStudentsToBatch(
        studentsModalBatch.id,
        selectedStudents,
        users
      );
      alert("Student assignments updated seamlessly!");
      setStudentsModalBatch(null);
      loadData();
    } catch (err: any) {
      alert("Error assigning students: " + err.message);
    }
  };

  // Toggle selected student checkbox
  const toggleStudent = (sId: string) => {
    if (selectedStudents.includes(sId)) {
      setSelectedStudents(selectedStudents.filter(id => id !== sId));
    } else {
      setSelectedStudents([...selectedStudents, sId]);
    }
  };

  // Open Examiners Assignment Dialog
  const openExaminersModal = (batch: Batch) => {
    setExaminersModalBatch(batch);
    setSelectedExaminers(batch.examinerIds || []);
  };

  // Save Examiner Assignments
  const handleSaveExaminers = async () => {
    if (!examinersModalBatch || !examinersModalBatch.id) return;
    try {
      await BatchService.assignExaminersToBatch(examinersModalBatch.id, selectedExaminers);
      alert("Examiner assignments updated successfully!");
      setExaminersModalBatch(null);
      loadData();
    } catch (err: any) {
      alert("Error assigning examiners: " + err.message);
    }
  };

  // Toggle selected examiner checkbox
  const toggleExaminer = (eId: string) => {
    if (selectedExaminers.includes(eId)) {
      setSelectedExaminers(selectedExaminers.filter(id => id !== eId));
    } else {
      setSelectedExaminers([...selectedExaminers, eId]);
    }
  };

  // Extract mentors & examiners lists for filtering dropdowns
  const mentorsList = users.filter(u => u.role === 'mentor');
  const examinersList = users.filter(u => u.role === 'examiner');
  
  // Filter batches based on inputs
  const filteredBatches = batches.filter(b => {
    const matchStatus = b.status === activeStatusTab;
    const matchSearch = 
      b.batchName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.batchCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchMentor = selectedMentorFilter === 'all' || b.mentorId === selectedMentorFilter;
    const matchExaminer = selectedExaminerFilter === 'all' || (b.examinerIds || []).includes(selectedExaminerFilter);

    return matchStatus && matchSearch && matchMentor && matchExaminer;
  });

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-10">
      
      {/* Search and Main Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search batches by name or code..."
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-sans"
            id="batch-search-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-slate-500 font-medium mb-1">Mentor Ref</label>
            <select
              value={selectedMentorFilter || 'all'}
              onChange={(e) => setSelectedMentorFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-none text-xs"
              id="mentor-filter-select"
            >
              <option value="all">All Mentors</option>
              {mentorsList.map(m => (
                <option key={m.id || m.mobile} value={m.id || m.mobile}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-500 font-medium mb-1">Examiner Supervision</label>
            <select
              value={selectedExaminerFilter || 'all'}
              onChange={(e) => setSelectedExaminerFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-none text-xs"
              id="examiner-filter-select"
            >
              <option value="all">All Examiners</option>
              {examinersList.map(x => (
                <option key={x.id || x.mobile} value={x.id || x.mobile}>{x.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Batch status) & Creation CTA */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-slate-200/60 p-1 rounded-xl flex-1 max-w-[280px]">
          {(['active', 'inactive', 'archived'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveStatusTab(tab)}
              className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                activeStatusTab === tab 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id={`tab-${tab}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          id="btn-create-batch"
        >
          <Plus className="w-4 h-4" />
          Create Batch
        </button>
      </div>

      {/* list loader */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <RefreshCw className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Synchronizing batches...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBatches.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">No batches match filters</p>
              <p className="text-xs text-slate-400 mt-1">Try relaxing filters or search keywords</p>
            </div>
          ) : (
            filteredBatches.map((batch) => {
              const assignedStudentsNum = (batch.studentIds || []).length;
              const assignedExaminersNum = (batch.examinerIds || []).length;
              return (
                <div 
                  key={batch.id} 
                  className="bg-white p-4 rounded-2xl border border-slate-250 hover:border-slate-300 shadow-sm transition-all relative flex flex-col gap-3"
                  id={`batch-card-${batch.id}`}
                >
                  {/* Batch Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-sm">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm leading-tight">{batch.batchName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {batch.batchCode}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Created by {batch.createdBy || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions panel */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                      <button 
                        onClick={() => openEditModal(batch)}
                        className="p-1 px-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded transition"
                        title="Edit Batch metadata"
                        id={`btn-edit-${batch.id}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteBatch(batch)}
                        className="p-1 px-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded transition"
                        title="Delete empty batch"
                        id={`btn-delete-${batch.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Batch Description */}
                  {batch.description && (
                    <p className="text-xs text-slate-500 leading-relaxed bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 font-sans">
                      {batch.description}
                    </p>
                  )}

                  {/* Batch stats & details */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/40 p-2.5 rounded-xl border border-dotted border-slate-200">
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Students</div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        {assignedStudentsNum} students assigned
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Supervision</div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        {assignedExaminersNum} examiners active
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons to Manage Batch contents */}
                  <div className="flex items-center gap-2 mt-1 pt-1 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => openStudentsModal(batch)}
                      className="flex-1 text-center py-2 bg-slate-100 text-slate-700 hover:bg-primary-50 hover:text-primary-600 font-semibold rounded-lg transition-colors border border-slate-200/50"
                      id={`btn-students-${batch.id}`}
                    >
                      Assign Students
                    </button>
                    <button
                      onClick={() => openExaminersModal(batch)}
                      className="flex-1 text-center py-2 bg-slate-100 text-slate-700 hover:bg-primary-50 hover:text-primary-600 font-semibold rounded-lg transition-colors border border-slate-200/50"
                      id={`btn-examiners-${batch.id}`}
                    >
                      Assign Examiners
                    </button>
                  </div>

                  {/* Move/Archive status transitions */}
                  <div className="flex items-center justify-end gap-2 text-[11px] font-sans">
                    {batch.status === 'active' ? (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(batch, 'inactive')}
                          className="text-slate-500 hover:text-orange-600 font-semibold flex items-center gap-1"
                        >
                          <ToggleRight className="w-3.5 h-3.5 text-slate-400" /> Deactivate
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(batch, 'archived')}
                          className="text-slate-500 hover:text-purple-650 font-semibold flex items-center gap-1"
                        >
                          <Archive className="w-3.5 h-3.5 text-slate-400" /> Archive
                        </button>
                      </>
                    ) : batch.status === 'inactive' ? (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(batch, 'active')}
                          className="text-slate-500 hover:text-emerald-600 font-semibold flex items-center gap-1"
                        >
                          <ToggleLeft className="w-3.5 h-3.5 text-slate-400" /> Activate
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(batch, 'archived')}
                          className="text-slate-500 hover:text-purple-650 font-semibold flex items-center gap-1"
                        >
                          <Archive className="w-3.5 h-3.5 text-slate-400" /> Archive
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => handleUpdateStatus(batch, 'active')}
                        className="text-slate-500 hover:text-emerald-650 font-semibold flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-slate-400" /> Restore to Active
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 1. Modal: Create / Edit Batch metadata */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
              id="create-batch-modal"
            >
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-sm">
                  {editingBatch ? 'Modify Batch Context' : 'Incept New Batch'}
                </h3>
                <button 
                  onClick={() => { setShowCreateModal(false); setEditingBatch(null); }}
                  className="p-1 hover:bg-white/10 rounded-full transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveBatch} className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Batch Name
                  </label>
                  <input 
                    required
                    type="text" 
                    name="batchName"
                    value={formFields.batchName || ''}
                    onChange={handleFormChange}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-sans" 
                    placeholder="e.g. Mission Alpha"
                    id="input-batch-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Batch Code (Unique Identifier)
                  </label>
                  <input 
                    required
                    type="text" 
                    name="batchCode"
                    value={formFields.batchCode || ''}
                    onChange={handleFormChange}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono" 
                    placeholder="ALPHA_01"
                    id="input-batch-code"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Converts to uppercase immediately e.g. ALPHA_2026</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Description
                  </label>
                  <textarea 
                    name="description"
                    value={formFields.description || ''}
                    onChange={handleFormChange}
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-sans" 
                    placeholder="Description of the cohort or objective..."
                    id="input-batch-desc"
                  />
                </div>

                <div className="flex gap-2 pt-2 text-xs">
                  <button 
                    type="button"
                    onClick={() => { setShowCreateModal(false); setEditingBatch(null); }}
                    className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 font-bold rounded-xl text-slate-600 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition"
                    id="btn-save-batch-form"
                  >
                    Save Batch
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Modal: Assign Students */}
      <AnimatePresence>
        {studentsModalBatch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
              id="assign-students-modal"
            >
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm">Assign Students</h3>
                  <p className="text-[10px] text-white/70">Batch: {studentsModalBatch.batchName}</p>
                </div>
                <button onClick={() => setStudentsModalBatch(null)} className="p-1 hover:bg-white/10 rounded-full transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Instruction message */}
              <div className="bg-amber-50 p-3 border-b border-amber-100 flex gap-2 text-slate-700 text-[11px]">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p>
                  One student belongs to <b>one batch</b> only. Selecting a student will transfer them to this batch immediately.
                </p>
              </div>

              {/* Student checkboxes list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {users.filter(u => u.role === 'student').length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">No enrolled students in directory.</p>
                ) : (
                  users.filter(u => u.role === 'student').map((student) => {
                    const studentId = student.id || student.mobile || 'unknown_id';
                    const isChecked = selectedStudents.includes(studentId);
                    
                    // Find batch code of their current assignment
                    const currentAssignedBatch = batches.find(b => b.id === student.batchId);
                    
                    return (
                      <label 
                        key={studentId} 
                        className={`flex items-start justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-primary-50/50 border-primary-200' 
                            : 'border-slate-150 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 select-none">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => toggleStudent(studentId)}
                            className="mt-1 h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-tight">{student.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{student.mobile || 'No Mobile'}</p>
                          </div>
                        </div>
                        
                        {/* Currently assigned indicator */}
                        {student.batchId && student.batchId !== studentsModalBatch.id ? (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                            Active in: {currentAssignedBatch?.batchCode || 'Other'}
                          </span>
                        ) : student.batchId === studentsModalBatch.id ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                            This batch
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium italic whitespace-nowrap">
                            No batch
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              <div className="bg-slate-50 border-t border-slate-150 p-3 flex gap-2 text-xs">
                <button 
                  onClick={() => setStudentsModalBatch(null)}
                  className="flex-1 py-2 font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveStudents}
                  className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition"
                  id="btn-confirm-save-students"
                >
                  Save Assignments
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Modal: Assign Examiners */}
      <AnimatePresence>
        {examinersModalBatch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
              id="assign-examiners-modal"
            >
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center font-sans">
                <div>
                  <h3 className="font-bold text-sm">Assign Examiners</h3>
                  <p className="text-[10px] text-white/70">Batch: {examinersModalBatch.batchName}</p>
                </div>
                <button onClick={() => setExaminersModalBatch(null)} className="p-1 hover:bg-white/10 rounded-full transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Examiner checklist instructions */}
              <div className="bg-sky-50 p-3 border-b border-sky-100 flex gap-2 text-slate-800 text-[11.5px]">
                <UserCheck className="w-4 h-4 text-sky-500 shrink-0" />
                <p>
                  Examiners supervise multiple cohorts. You can specify multiple supervisors for this batch.
                </p>
              </div>

              {/* Examiner checklist */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {users.filter(u => u.role === 'examiner').length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">No examiners found in directory.</p>
                ) : (
                  users.filter(u => u.role === 'examiner').map((examiner) => {
                    const eId = examiner.id || examiner.mobile || 'unknown_id';
                    const isChecked = selectedExaminers.includes(eId);
                    
                    // Find count of other batches supervised by this examiner
                    const supervisesCount = batches.filter(b => (b.examinerIds || []).includes(eId)).length;
                    
                    return (
                      <label 
                        key={eId} 
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-primary-50/50 border-primary-200' 
                            : 'border-slate-150 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 select-none">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => toggleExaminer(eId)}
                            className="h-4 w-4 text-slate-900 border-slate-300 rounded focus:ring-primary-500 cursor-pointer"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-tight">{examiner.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{examiner.mobile || 'No Mobile'}</p>
                          </div>
                        </div>

                        <span className="text-[10px] bg-sky-50 text-sky-700 font-semibold px-2 py-0.5 rounded-full">
                          Supervises {supervisesCount} {supervisesCount === 1 ? 'batch' : 'batches'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="bg-slate-50 border-t border-slate-150 p-3 flex gap-2 text-xs">
                <button 
                  onClick={() => setExaminersModalBatch(null)}
                  className="flex-1 py-2 font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveExaminers}
                  className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition"
                  id="btn-confirm-save-examiners"
                >
                  Save Assignments
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
