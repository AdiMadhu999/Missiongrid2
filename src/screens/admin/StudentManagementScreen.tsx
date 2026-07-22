import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, Search, Edit2, Ban, CheckCircle, Trash2, Phone, Filter, X, CreditCard, Sparkles, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { getUsers, createUserProfile, updateUserProfile, deleteUserProfile } from '../../services/users';
import { resetUserPin } from '../../services/mentors';
import { User } from '../../models/user';
import { apiFetch } from '../../utils/api';
import toast from 'react-hot-toast';

export default function StudentManagementScreen() {
  const { userProfile } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PREMIUM' | 'FREE' | 'EXPIRED' | 'EXPIRING_SOON'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setStudents(data.filter(u => u.role === 'student'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.role === 'mentor' || userProfile?.role === 'admin') {
        loadStudents();
    }
  }, [userProfile]);

  const handlePremiumUpdate = async (data: any) => {
    if (!selectedStudent) return;
    
    const token = localStorage.getItem('token');
    
    await apiFetch('/api/admin/premium/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        studentId: selectedStudent.id,
        studentData: {
          ...selectedStudent,
          premiumStatus: data.newStatus,
          isPremium: data.newStatus === 'PREMIUM',
          premiumExpiryDate: new Date(data.newExpiry).toISOString(),
          lastPremiumChangeDate: new Date().toISOString(),
          premiumChangedBy: userProfile?.id
        },
        action: 'MANUAL_OVERRIDE',
        reason: data.reason,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        previousExpiry: data.previousExpiry,
        newExpiry: new Date(data.newExpiry).toISOString()
      })
    });
    loadStudents();
  };

  const updateStatus = async (user: User, status: string) => {
    if (!confirm(`Are you sure you want to mark this student as ${status}?`)) return;
    try {
      await updateUserProfile(user.id || user.mobile!, { status: status as User['status'] });
      loadStudents();
    } catch (e) {
      console.error(e);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserMobile, setNewUserMobile] = useState('');
  const [newUserBatch, setNewUserBatch] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserMobile) return;
    setSaveLoading(true);
    try {
      await createUserProfile({
        name: newUserName,
        mobile: newUserMobile,
        batchId: newUserBatch,
        role: 'student',
        status: 'active',
        pin: '123456'
      });
      setShowAddModal(false);
      setNewUserName('');
      setNewUserMobile('');
      setNewUserBatch('');
      loadStudents();
    } catch (err: any) {
      alert(err.message || "Failed to create student");
    } finally {
      setSaveLoading(false);
    }
  };

  const filteredStudents = (students || []).filter(u => {
    const nameStr = u.name || '';
    const mobileStr = u.mobile || '';
    const premiumStr = u.premiumStatus || 'FREE';
    const search = searchTerm.toLowerCase();
    
    let matchesSearch = nameStr.toLowerCase().includes(search) || 
                        mobileStr.includes(search) || 
                        premiumStr.toLowerCase().includes(search);
                        
    let matchesFilter = true;
    const now = Date.now();
    const expiry = u.premiumExpiryDate ? new Date(u.premiumExpiryDate).getTime() : 0;
    const isExpired = u.isPremium && expiry < now;
    const isExpiringSoon = u.isPremium && expiry > now && expiry < now + 7 * 24 * 60 * 60 * 1000;
    
    const hasActivePremium = u.premiumStatus === 'PREMIUM' || u.premiumStatus === 'active';
    if (filter === 'PREMIUM') matchesFilter = hasActivePremium;
    else if (filter === 'FREE') matchesFilter = !hasActivePremium;
    else if (filter === 'EXPIRED') matchesFilter = isExpired;
    else if (filter === 'EXPIRING_SOON') matchesFilter = isExpiringSoon;
    
    return matchesSearch && matchesFilter;
  });

  const studentsMissingRegDate = (students || []).filter(u => !u.registrationDate && !u.createdAt);

  if (userProfile?.role !== 'mentor' && userProfile?.role !== 'admin') return <div className="p-4">Access Denied</div>;

  return (
    <div className="p-4 bg-slate-50 min-h-screen pb-32 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-900">Student Management</h1>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 text-white p-2 rounded-xl"
        >
          <UserPlus size={20} />
        </button>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Add New Student</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-100 rounded-full">
                   <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile Number</label>
                  <input 
                    type="tel" 
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={newUserMobile}
                    onChange={e => setNewUserMobile(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch ID (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={newUserBatch}
                    onChange={e => setNewUserBatch(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={saveLoading}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  {saveLoading ? 'Enrolling...' : 'Enroll Student'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {studentsMissingRegDate.length > 0 && (
        <div className="mb-6 p-5 bg-amber-50/80 border border-amber-200/60 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-600 shrink-0 mt-0.5">
              <AlertTriangle size={18} className="animate-bounce-slow" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-950 uppercase tracking-wider">Candidate Data Diagnostics Alert</p>
              <p className="text-[11px] font-bold text-amber-800 mt-1 leading-relaxed">
                Found {studentsMissingRegDate.length} existing student profile(s) missing registration tracking parameters. Run repair to backfill them instantly so they can access the 20-day premium trial benefit correctly.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const toastId = toast.loading('Repairing legacy student records...');
              try {
                let repairedCount = 0;
                for (const student of studentsMissingRegDate) {
                  const fallbackDate = new Date().toISOString();
                  const targetId = student.id || student.mobile;
                  if (targetId) {
                    await updateUserProfile(targetId, {
                      registrationDate: fallbackDate,
                      createdAt: fallbackDate,
                      updatedAt: fallbackDate
                    });
                    repairedCount++;
                  }
                }
                toast.success(`Successfully repaired ${repairedCount} student profile(s)!`, { id: toastId });
                loadStudents();
              } catch (err: any) {
                console.error("Auto-repair error:", err);
                toast.error("Failed to auto-repair data.", { id: toastId });
              }
            }}
            className="self-start sm:self-center bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest px-4.5 py-2.5 rounded-xl transition-all shadow-xs shrink-0 active:scale-95 cursor-pointer"
          >
            ⚡ Run Auto-Repair
          </button>
        </div>
      )}



      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="Search students..." 
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
        </div>
        <button className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <Filter size={20} className="text-slate-600"/>
        </button>
      </div>
      


      <div className="space-y-3">
        {loading ? (
            <div className="text-center py-8 text-slate-500">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No students found.</div>
        ) : (
            filteredStudents.map((u) => (
                <div key={u.id || u.mobile} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                            {u.name?.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-slate-900">{u.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {u.batchId || 'No Batch'} • {u.status || 'active'}
                            </p>
                            <div className="text-[10px] text-slate-600 mt-1">
                              <p>Reg: {u.registrationDate || u.createdAt || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {u.status === 'active' ? (
                            <button onClick={() => updateStatus(u, 'suspended')} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                                <Ban size={18} />
                            </button>
                        ) : (
                            <button onClick={() => updateStatus(u, 'active')} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                <CheckCircle size={18} />
                            </button>
                        )}
                        <button className="text-slate-400 p-2 hover:bg-slate-50 rounded-lg">
                            <Edit2 size={18} />
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>

    </div>
  );
}
