import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BatchService } from '../../services/batch';
import { getUsers } from '../../services/users';
import { Batch } from '../../models/mission';
import { User } from '../../models/user';
import { ArrowLeft, Users, Shield, BookOpen, Save, Trash2, UserPlus, Loader2, BarChart2 } from 'lucide-react';
import BatchAnalysisView from '../test/BatchAnalysisView';

export default function BatchDetailScreen() {
    const { batchId } = useParams<{ batchId: string }>();
    const navigate = useNavigate();
    const [batch, setBatch] = useState<Batch | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [batchName, setBatchName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    
    // Selection state
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [selectedExaminers, setSelectedExaminers] = useState<string[]>([]);
    const [communityLink, setCommunityLink] = useState('');
    const [showAnalysis, setShowAnalysis] = useState(false);

    useEffect(() => {
        if (batchId) loadData();
    }, [batchId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [b, users] = await Promise.all([
                BatchService.getBatchById(batchId!),
                getUsers()
            ]);
            if (b) {
                setBatch(b);
                setBatchName(b.batchName);
                setSelectedStudents(b.studentIds || []);
                setSelectedExaminers(b.examinerIds || []);
                setCommunityLink(b.communityLink || '');
            }
            setAllUsers(users);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!batchId) return;
        setSaving(true);
        try {
            const tasks: Promise<any>[] = [
                BatchService.assignStudentsToBatch(batchId, selectedStudents, allUsers),
                BatchService.assignExaminersToBatch(batchId, selectedExaminers),
                BatchService.updateBatch(batchId, { communityLink })
            ];
            if (batchName !== batch?.batchName) {
                tasks.push(BatchService.renameBatch(batchId, batchName));
            }
            await Promise.all(tasks);
            setIsRenaming(false);
            setBatch(prev => prev ? {...prev, batchName} : null);
            alert('Batch updated successfully.');
        } catch (e) {
            console.error(e);
            alert('Failed to update assignments.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!batchId || !confirm('Are you sure you want to delete this batch? This will remove all student enrollments from this batch.')) return;
        setSaving(true);
        try {
            await BatchService.deleteBatch(batchId, allUsers);
            alert('Batch deleted successfully.');
            navigate('/app/batches');
        } catch (e) {
            console.error(e);
            alert('Failed to delete batch.');
        } finally {
            setSaving(false);
        }
    };

    const toggleStudent = (id: string) => {
        setSelectedStudents(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleExaminer = (id: string) => {
        setSelectedExaminers(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;
    if (!batch) return <div className="p-10 text-center">Batch not found.</div>;

    if (showAnalysis) {
        return <BatchAnalysisView batchId={batchId!} onBack={() => setShowAnalysis(false)} />;
    }

    const students = allUsers.filter(u => u.role === 'student');
    const examiners = allUsers.filter(u => u.role === 'examiner');

    return (
        <div className="p-4 bg-slate-50 min-h-screen pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                <button onClick={() => navigate('/app/batches')} className="p-2 bg-white rounded-full"><ArrowLeft/></button>
                <div className="flex-1 w-full">
                    {isRenaming ? (
                        <input 
                            className="text-xl font-black text-slate-900 w-full p-2 border rounded-xl"
                            value={batchName}
                            autoFocus
                            onBlur={() => setIsRenaming(false)}
                            onChange={e => {
                                setBatchName(e.target.value);
                                if(e.target.value !== batch?.batchName) setIsRenaming(true);
                            }}
                            onKeyDown={e => e.key === 'Enter' && setIsRenaming(false)}
                        />
                    ) : (
                        <h1 className="text-xl font-black text-slate-900 cursor-pointer hover:text-indigo-600 transition" onClick={() => setIsRenaming(true)}>{batchName} <span className="text-xs text-slate-400 font-normal">(Click to rename)</span></h1>
                    )}
                    <p className="text-xs text-slate-500 uppercase font-bold">{batch.batchCode} • {batch.status}</p>
                    <input className="w-full mt-2 p-2 border rounded-xl text-xs" placeholder="Telegram/Community Link" value={communityLink} onChange={e => setCommunityLink(e.target.value)}/>
                </div>
                <div className="flex flex-wrap gap-2 w-full justify-between sm:justify-end sm:w-auto">
                    <button 
                       onClick={handleDelete}
                       className="bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1 transition"
                    >
                        <Trash2 size={12}/>
                        Delete
                    </button>
                    <button 
                       onClick={() => setShowAnalysis(true)} 
                       className="bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1 transition"
                       id="batch-view-analytics-btn"
                    >
                        <BarChart2 size={12}/>
                        Analytics
                    </button>
                    <button 
                       onClick={handleSave} 
                       disabled={saving}
                       className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={12}/> : <Save size={12}/>}
                        Save
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {/* Examiners Selection */}
                <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800"><Shield size={18} className="text-amber-500"/> Supervision (Examiners)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                        {examiners.map(ex => {
                            const id = ex.id || ex.mobile!;
                            const isSelected = selectedExaminers.includes(id);
                            return (
                                <button 
                                    key={id}
                                    onClick={() => toggleExaminer(id)}
                                    className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${isSelected ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-100' : 'bg-slate-50 border-slate-100'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-xs uppercase border border-slate-100">
                                        {ex.name.substring(0, 2)}
                                    </div>
                                    <span className={`text-xs font-bold ${isSelected ? 'text-amber-900' : 'text-slate-600'}`}>{ex.name}</span>
                                </button>
                            );
                        })}
                        {examiners.length === 0 && <p className="text-xs text-slate-400 italic py-4">No examiners created yet.</p>}
                    </div>
                </div>

                {/* Students Selection */}
                <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800"><Users size={18} className="text-indigo-500"/> Cohort Candidates (Students)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-2">
                        {students.map(st => {
                            const id = st.id || st.mobile!;
                            const isSelected = selectedStudents.includes(id);
                            const otherBatch = st.batchId && st.batchId !== batchId;
                            
                            return (
                                <button 
                                    key={id}
                                    onClick={() => toggleStudent(id)}
                                    className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100' : 'bg-slate-50 border-slate-100'}`}
                                >
                                    <div className="relative">
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-xs uppercase border border-slate-100">
                                            {st.name.substring(0, 2)}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-600'}`}>{st.name}</p>
                                        {otherBatch && <p className="text-[9px] text-rose-500 font-bold uppercase tracking-tighter">In other batch</p>}
                                    </div>
                                </button>
                            );
                        })}
                        {students.length === 0 && <p className="text-xs text-slate-400 italic py-4">No students created yet.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
