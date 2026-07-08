import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, UserPlus, Search, Edit2, Ban, CheckCircle, Filter } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { getUsers, updateUserProfile } from '../../services/users';
import { User } from '../../models/user';

export default function ExaminerManagementScreen() {
  const { userProfile } = useAuth();
  const [examiners, setExaminers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadExaminers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setExaminers(data.filter(u => u.role === 'examiner'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.role === 'mentor') {
        loadExaminers();
    }
  }, [userProfile]);

  const updateStatus = async (user: User, status: string) => {
    if (!confirm(`Are you sure you want to mark this examiner as ${status}?`)) return;
    try {
      await updateUserProfile(user.id || user.mobile!, { status: status as User['status'] });
      loadExaminers();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredExaminers = examiners.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.mobile?.includes(searchTerm);
    return matchSearch;
  });

  if (userProfile?.role !== 'mentor') return <div className="p-4">Access Denied</div>;

  return (
    <div className="p-4 bg-slate-50 min-h-screen pb-32">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-900">Examiner Management</h1>
        <button className="bg-indigo-600 text-white p-2 rounded-xl">
          <UserPlus size={20} />
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="Search examiners..." 
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
            <div className="text-center py-8 text-slate-500">Loading examiners...</div>
        ) : filteredExaminers.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No examiners found.</div>
        ) : (
            filteredExaminers.map((u) => (
                <div key={u.id || u.mobile} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                            {u.name?.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-slate-900">{u.name}</p>
                            <p className="text-[10px] text-slate-500">{u.batchId || 'No Batch'} • {u.status || 'active'}</p>
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
