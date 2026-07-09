import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, UserPlus, Search, Edit2, Shield, Ban, CheckCircle, Trash2, Mail, Phone, BookOpen, GraduationCap, Activity } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { getUsers, createUserProfile, updateUserProfile, deleteUserProfile } from '../../services/users';
import { resetUserPin } from '../../services/mentors';
import { User } from '../../models/user';

export default function UserManagementScreen() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    role: 'student',
    category: 'Regular',
    currentRank: 1,
    batchId: '',
    status: 'active'
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.role === 'mentor') {
        loadUsers();
    }
  }, [userProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<User> = {
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email,
        role: formData.role as User['role'],
        category: formData.category as User['category'],
        currentRank: Number(formData.currentRank) || 1,
        batchId: formData.batchId,
        status: formData.status as User['status']
      };

      if (editingUser) {
        await updateUserProfile(editingUser.id || editingUser.mobile!, payload);
      } else {
        await createUserProfile(payload);
      }
      setShowAddForm(false);
      setEditingUser(null);
      setFormData({ name: '', mobile: '', email: '', role: 'student', category: 'Base', currentRank: 1, batchId: '', status: 'active' });
      loadUsers();
    } catch (err: any) {
      alert("Error saving: " + err.message);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      mobile: user.mobile || user.id || '',
      email: user.email || '',
      role: user.role || 'student',
      category: user.category || 'Regular',
      currentRank: user.currentRank || 1,
      batchId: user.batchId || '',
      status: user.status || 'active'
    });
    setShowAddForm(true);
  };

  const updateStatus = async (user: User, status: string) => {
    if (!confirm(`Are you sure you want to mark this user as ${status}?`)) return;
    try {
      await updateUserProfile(user.id || user.mobile!, { status: status as User['status'] });
      loadUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const removeUser = async (user: User) => {
    if (!confirm(`Are you sure you want to permanently strictly delete this user?`)) return;
    try {
      console.log('Attempting to delete user:', user.id || user.mobile);
      await deleteUserProfile(user.id || user.mobile!);
      loadUsers();
    } catch (e) {
      console.error('Remove user failed:', e);
      alert('Failed to remove user: ' + e);
    }
  }

  const handleResetPin = async (user: User) => {
    const newPin = prompt("Enter new Security PIN (Number) for " + user.name);
    if (!newPin || !/^\d+$/.test(newPin)) {
        alert("Please enter a valid numeric PIN");
        return;
    }
    try {
        await resetUserPin(user.id || user.mobile!, newPin);
        alert("PIN updated successfully");
    } catch (e) {
        console.error(e);
        alert("Failed to update PIN");
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.mobile?.includes(searchTerm);
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  if (userProfile?.role !== 'mentor') {
      return (
          <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-slate-100">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Access Denied</h3>
            <p className="text-slate-500 mt-2">Only mentors can access user management.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Ecosystem Users</h2>
          <p className="text-slate-500 text-sm mt-1">Manage enrolled learners and examiners.</p>
        </div>
        <button
          onClick={() => {
              setEditingUser(null);
              setFormData({ name: '', mobile: '', email: '', role: 'student', category: 'Regular', currentRank: 1, batchId: '', status: 'active' });
              setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-500 active:bg-primary-700 transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Enroll New User
        </button>
      </div>

      {showAddForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">{editingUser ? 'Edit User' : 'Enroll User'}</h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border-slate-300 text-sm" placeholder="Applicant Name" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number (Key ID)</label>
                <input required disabled={!!editingUser} type="tel" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value.replace(/\D/g, '')})} className="w-full rounded-xl border-slate-300 text-sm disabled:bg-slate-100" placeholder="10-digit mobile" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-slate-400 font-normal">(Optional)</span></label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full rounded-xl border-slate-300 text-sm" placeholder="contact@example.com" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full rounded-xl border-slate-300 text-sm">
                    <option value="student">Student</option>
                    <option value="examiner">Examiner</option>
                    <option value="mentor">Mentor</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Batch ID</label>
                <input type="text" value={formData.batchId} onChange={e => setFormData({...formData, batchId: e.target.value})} className="w-full rounded-xl border-slate-300 text-sm" placeholder="e.g., Batch-2026" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full rounded-xl border-slate-300 text-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending</option>
                    <option value="blocked">Blocked</option>
                </select>
            </div>
            <div className="flex items-end gap-3 col-span-1 sm:col-span-2 md:col-span-3">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-500 transition-colors">{editingUser ? 'Save Changes' : 'Confirm Enrollment'}</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between bg-slate-50/50">
              <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                      type="text" 
                      placeholder="Search by name or mobile..." 
                      className="w-full pl-9 pr-4 py-2 text-sm border-slate-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 bg-white"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                  <button onClick={() => setFilterRole('all')} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterRole === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>All</button>
                  <button onClick={() => setFilterRole('student')} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterRole === 'student' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Students</button>
                  <button onClick={() => setFilterRole('examiner')} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterRole === 'examiner' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Examiners</button>
              </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Security ID</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                    {loading ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading ecosystem users...</td></tr>
                    ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                            <Users className="w-10 h-10 text-slate-300 mb-3" />
                            No users found.
                        </td></tr>
                    ) : (
                        filteredUsers.map((u, idx) => (
                            <tr key={u.id || u.mobile || `user-${idx}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-900">{u.name}</div>
                                    <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3"/> {u.mobile}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                        u.role === 'mentor' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                        u.role === 'examiner' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                        'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}>
                                        {u.role === 'mentor' ? 'Mentor' : u.role === 'examiner' ? 'Examiner' : 'Student'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                                        u.status === 'active' ? 'text-emerald-600' :
                                        u.status === 'suspended' ? 'text-rose-600' : 
                                        u.status === 'blocked' ? 'text-slate-600' : 'text-amber-600'
                                    }`}>
                                        {u.status === 'active' ? <CheckCircle className="w-3.5 h-3.5"/> : u.status === 'suspended' ? <Ban className="w-3.5 h-3.5"/> : <span className="w-2 h-2 rounded-full bg-amber-500"/>}
                                        <span className="capitalize">{u.status || 'Active'}</span>
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-slate-400">
                                    {u.uid ? <span title={u.uid}>{u.uid.substring(0, 8)}...</span> : 'Unlinked'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleEdit(u)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit Profile">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleResetPin(u)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Reset PIN">
                                            <Shield className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => alert(u.loginHistory ? u.loginHistory.map((h: any) => `${h.timestamp}: ${h.type}`).join('\n') : 'No history')} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View History">
                                            <Activity className="w-4 h-4" />
                                        </button>
                                        {u.status === 'active' ? (
                                            <button onClick={() => updateStatus(u, 'suspended')} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Suspend Access">
                                                <Ban className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button onClick={() => updateStatus(u, 'active')} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Activate Access">
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button onClick={() => removeUser(u)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Remove User completely">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
