import React, { useState, useEffect } from 'react';
import { Search, Plus, UserCircle, Shield, BookOpen, MoreVertical, Loader2, AlertTriangle, History, Layers, LogOut, Smartphone, Star, Trophy } from 'lucide-react';
import { getUsers, updateUserProfile, incrementPoints, deleteUserProfile, searchUsers } from '../../services/users';
import { User } from '../../models/user';
import { getStudentCode } from '../../utils/privacy';
import UserCreateEditModal from './UserCreateEditModal';
import WarningCreateModal from './WarningCreateModal';
import WarningListScreen from './WarningListScreen';
import AuthorityControlModal from './AuthorityControlModal';
import { useAuth } from '../../providers/AuthProvider';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function UserListScreen() {
    const { userProfile, logout } = useAuth();
    const navigate = useNavigate();
    const isMentor = userProfile?.role === 'mentor' || userProfile?.role === 'primary-mentor';
    
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    
    // Warning & Points management
    const [showWarningCreate, setShowWarningCreate] = useState<User | null>(null);
    const [showWarningList, setShowWarningList] = useState<User | null>(null);
    const [adjustingPoints, setAdjustingPoints] = useState<User | null>(null);
    const [pointValue, setPointValue] = useState(0);
    const [showAuthorityModal, setShowAuthorityModal] = useState<User | null>(null);

    const toggleUserSelection = (userId: string) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedUsers.size} users?`)) return;
        
        setLoading(true);
        try {
            await Promise.all(Array.from(selectedUsers).map(id => deleteUserProfile(id)));
            setSelectedUsers(new Set());
            await loadUsers();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!search.trim()) {
            loadUsers();
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setLoading(true);
            try {
                const searchResults = await searchUsers(search);
                setUsers(searchResults);
            } catch (e) {
                console.error("Database search failed:", e);
            } finally {
                setLoading(false);
            }
        }, 400); // 400ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [search]);

    const handleAdjustPoints = async () => {
        if (!adjustingPoints || !isMentor) return;
        try {
            await incrementPoints(adjustingPoints.id || adjustingPoints.mobile!, pointValue, 0);
            loadUsers();
            setAdjustingPoints(null);
            setPointValue(0);
        } catch (e) {
            console.error(e);
        }
    };

    const handleResetDevice = async (user: User) => {
        const studentId = user.id || user.mobile!;
        if (!confirm(`Are you sure you want to reset the device lock for ${user.name}? This will allow them to login from any different mobile device ID.`)) {
            return;
        }

        const toastId = toast.loading(`Resetting device lock for ${user.name}...`);
        try {
            const token = localStorage.getItem('missiongrid_token') || '';
            const res = await fetch('/api/admin/reset-device', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ studentId })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Device lock reset successfully for ${user.name}.`, { id: toastId });
                loadUsers();
            } else {
                toast.error(`Failed to reset device lock: ${data.error || 'Unknown error'}`, { id: toastId });
            }
        } catch (err: any) {
            console.error('Error resetting device lock:', err);
            toast.error(`Error resetting device lock: ${err.message || err}`, { id: toastId });
        }
    };

    const filteredUsers = search.trim() ? users : users.filter(u => {
        const term = search.toLowerCase();
        const matchName = u.name?.toLowerCase().includes(term);
        const code = u.studentCode || getStudentCode(u);
        const matchStudentId = code.toLowerCase().includes(term);
        const matchBatch = (u.batchId || '').toLowerCase().includes(term);
        const matchRank = (String(u.currentRank || '')).toLowerCase().includes(term);
        const matchMobilePrivate = isMentor && (u.mobile || '').includes(search);
        return matchName || matchStudentId || matchBatch || matchRank || matchMobilePrivate;
    });

     if (showWarningList) {
        return <WarningListScreen studentId={showWarningList.id || showWarningList.mobile!} onBack={() => setShowWarningList(null)} />;
     }

     return (
        <div className="p-4 bg-slate-50 min-h-screen pb-32">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Mentor Place</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Command Center</p>
                </div>
                <div className="flex gap-2">
                    {selectedUsers.size > 0 && (
                        <button onClick={handleBulkDelete} className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-200 font-bold text-xs">
                            Delete Selected ({selectedUsers.size})
                        </button>
                    )}
                    {isMentor && (
                        <>
                            <button onClick={() => navigate('/app/batches')} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl shadow-sm">
                                <Layers size={20}/>
                            </button>
                            <button onClick={() => { setSelectedUser(undefined); setShowModal(true); }} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                                <Plus size={20}/>
                            </button>
                        </>
                    )}
                    <button onClick={() => logout()} className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                        <LogOut size={20}/>
                    </button>
                </div>
            </div>
            
            <div className="flex gap-2 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400"/>
                  <input 
                      className="w-full pl-10 p-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      placeholder="Search users by name or mobile..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                  />
                </div>
            </div>

            {loading ? <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-600 w-10 h-10"/></div> : (
                <div className="space-y-4">
                    {filteredUsers.map((user, idx) => (
                        <div key={`${user.id || user.mobile || 'user'}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 content-visibility-auto gpu-accelerated">
                            <div className="flex items-center gap-4">
                                <input 
                                    type="checkbox" 
                                    checked={selectedUsers.has(user.id || user.mobile!)}
                                    onChange={() => toggleUserSelection(user.id || user.mobile!)}
                                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="relative">
                                    <img src={user.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} className="w-14 h-14 rounded-2xl object-cover bg-slate-100 border border-slate-100" />
                                    {user.role === 'mentor' && <div className="absolute -top-1 -right-1 bg-amber-500 p-0.5 rounded-full border-2 border-white"><Shield className="w-3 h-3 text-white fill-white"/></div>}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-slate-900">{user.name}</p>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{user.status}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 uppercase tracking-tighter">
                                        {user.role} {user.role === 'student' && `• ${user.batchId || 'Awaiting Batch'}`}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono uppercase tracking-wider">
                                        {isMentor ? user.mobile : (user.studentCode || getStudentCode(user))}
                                    </p>
                                    
                                    <div className="flex flex-wrap gap-1 mt-1.5 pt-1">
                                        {user.category && (
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                                user.category === 'Elite' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                                                user.category === 'Review Category' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                                'bg-slate-50 border-slate-200 text-slate-700'
                                            }`}>
                                                {user.category === 'Review Category' ? 'Surveillance / Review' : user.category}
                                            </span>
                                        )}
                                        {user.restrictedFromSubmitting && (
                                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border bg-rose-50 border-rose-100 text-rose-600">
                                                🚫 Submissions Ban
                                            </span>
                                        )}
                                        {user.restrictedFromPosting && (
                                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border bg-rose-50 border-rose-100 text-rose-600">
                                                🚫 Feed Post Ban
                                            </span>
                                        )}
                                        {user.restrictedFromInteractions && (
                                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border bg-rose-50 border-rose-100 text-rose-600">
                                                🚫 Interactions Ban
                                            </span>
                                        )}
                                        {user.exemptFromPenalty && (
                                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border bg-emerald-50 border-emerald-100 text-emerald-600">
                                                ⭐ Penalty Waiver
                                            </span>
                                        )}
                                        {user.excusedFromAttendance && (
                                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border bg-blue-50 border-blue-100 text-blue-600">
                                                🩹 Leave/Medical Waiver
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <button onClick={() => { setSelectedUser(user); setShowModal(true); }} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><MoreVertical/></button>
                                    {user.role === 'student' && (
                                        <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                            <Trophy size={10} className="text-amber-500"/>
                                            <span className="text-[10px] font-black text-slate-700">{user.missionPoints || 0}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isMentor && user.role === 'student' && (
                                <div className="grid grid-cols-2 lg:flex gap-2 pt-3 border-t border-slate-50">
                                    {/* Point Adjustment Modal, now disabled */}
                                    {/* <button 
                                        onClick={() => setAdjustingPoints(user)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
                                    >
                                        <Star size={14}/>
                                        Modify Points
                                    </button> */}
                                    <button 
                                        onClick={() => setShowWarningCreate(user)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors"
                                    >
                                        <AlertTriangle size={14}/>
                                        Issue Warning
                                    </button>
                                    <button 
                                        onClick={() => setShowWarningList(user)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                                    >
                                        <History size={14}/>
                                        Warning History
                                    </button>
                                    <button 
                                        onClick={() => setShowAuthorityModal(user)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                                    >
                                        <Shield size={14}/>
                                        Authority
                                    </button>
                                    <button 
                                        onClick={() => handleResetDevice(user)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors"
                                    >
                                        <Smartphone size={14}/>
                                        Reset Device
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {filteredUsers.length === 0 && <p className="text-center text-slate-400 py-10 font-medium">No users found for "{search}"</p>}
                </div>
            )}

            {showModal && <UserCreateEditModal user={selectedUser} onClose={() => { setShowModal(false); loadUsers(); }} />}
            {showWarningCreate && (
                <WarningCreateModal 
                    studentId={showWarningCreate.id || showWarningCreate.mobile!} 
                    studentName={showWarningCreate.name} 
                    onClose={() => setShowWarningCreate(null)}
                    onSaved={() => loadUsers()}
                />
            )}
            {showAuthorityModal && (
                <AuthorityControlModal 
                    user={showAuthorityModal} 
                    onClose={() => setShowAuthorityModal(null)} 
                    onSaved={() => loadUsers()} 
                />
            )}

            {/* Point Adjustment Modal */}
            {adjustingPoints && (
                <div className="fixed inset-0 bg-black/50 p-4 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="font-bold text-lg text-slate-900">Manage Points</h2>
                                <p className="text-xs text-slate-500">Student: {adjustingPoints.name}</p>
                            </div>
                            <button onClick={() => setAdjustingPoints(null)} className="p-2 bg-slate-100 rounded-full"><Plus className="rotate-45" size={20}/></button>
                        </div>
                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <input 
                                type="number" 
                                className="w-full bg-transparent text-3xl font-black text-indigo-600 outline-none" 
                                value={pointValue}
                                onChange={e => setPointValue(parseInt(e.target.value) || 0)}
                             />
                             <div className="flex flex-col gap-1">
                                <button onClick={() => setPointValue(prev => prev + 10)} className="bg-white p-1 rounded-lg border border-slate-200 text-[10px] font-black">+10</button>
                                <button onClick={() => setPointValue(prev => prev - 10)} className="bg-white p-1 rounded-lg border border-slate-200 text-[10px] font-black">-10</button>
                             </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setPointValue(prev => prev * -1)} className="flex-1 py-3 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold">Negative</button>
                             <button onClick={() => setPointValue(prev => Math.abs(prev))} className="flex-1 py-3 rounded-xl border border-emerald-200 text-emerald-600 text-xs font-bold">Positive</button>
                        </div>
                        <button onClick={handleAdjustPoints} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black shadow-lg shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all">Apply Modification</button>
                    </div>
                </div>
            )}
        </div>
    );
}
