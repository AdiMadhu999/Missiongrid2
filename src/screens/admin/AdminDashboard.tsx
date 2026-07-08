import React, { useState, useEffect } from 'react';
import { Users, BookOpen, Target, ShieldCheck, ClipboardList, Activity, Clock, UserPlus, FileText, Bell, Search, Filter, X, Smartphone, Key, User as UserIcon, ShieldAlert } from 'lucide-react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { createUserProfile } from '../../services/users';
import { BatchService } from '../../services/batch';
import { Batch } from '../../models/mission';
import DatabaseResetTool from './DatabaseResetTool';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    students: 0,
    examiners: 0,
    mentors: 0,
    batches: 0,
    pendingReviews: 12,
    activeUsersToday: 45
  });

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [enrollData, setEnrollData] = useState({ name: '', mobile: '', role: 'student', batchId: '' });
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(50)));
        const b = await BatchService.getBatches();
        setBatches(b);

        let st = 0, ex = 0, me = 0;
        usersSnap.forEach(doc => {
          const role = doc.data().role;
          if (role === 'student') st++;
          if (role === 'examiner') ex++;
          if (role === 'mentor' || role === 'primary-mentor') me++;
        });

        setStats({
          students: st,
          examiners: ex,
          mentors: me,
          batches: b.length,
          pendingReviews: 12,
          activeUsersToday: 45
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const handleEnroll = async () => {
      if (!enrollData.name || !enrollData.mobile) return;
      setEnrollLoading(true);
      setEnrollMsg('');
      try {
          await createUserProfile({
              name: enrollData.name,
              mobile: enrollData.mobile,
              role: enrollData.role as any,
              batchId: enrollData.batchId,
              pin: '123456', // Default PIN as per requirements
              status: 'active'
          });
          setEnrollMsg('Successful enrollment of operational asset.');
          setEnrollData({ name: '', mobile: '', role: 'student', batchId: '' });
          setTimeout(() => setShowEnrollModal(false), 2000);
      } catch (e: any) {
          setEnrollMsg('Enrollment failure: ' + e.message);
      } finally {
          setEnrollLoading(false);
      }
  };

  if (loading) {
     return <div className="p-8 flex justify-center text-slate-400">Loading metrics...</div>;
  }

  const statCards = [
    { label: 'Students', value: stats.students, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Examiners', value: stats.examiners, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Mentors', value: stats.mentors, icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Active Batches', value: stats.batches, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const recentActivities = [
    { type: 'Student Joined', title: 'New Enrollment', time: 'Just now', color: 'text-emerald-600' },
    { type: 'Submission', title: 'Pending Review', time: '2 mins ago', color: 'text-amber-600' },
    { type: 'Batch', title: 'Status Update', time: '1 hour ago', color: 'text-indigo-600' },
  ];

  return (
    <div className="space-y-6">
       {/* Search & Filter */}
       <div className="flex gap-2">
          <div className="relative flex-1">
            <input type="text" placeholder="Search system..." className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm" />
            <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
          </div>
          <button className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <Filter size={20} className="text-slate-600"/>
          </button>
       </div>

       {/* Summary Cards */}
       <div className="grid grid-cols-2 gap-3">
         {statCards.map((stat, i) => (
           <div key={`${stat.label}-${i}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-slate-900">{stat.value}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
           </div>
         ))}
       </div>

       {/* Quick Actions Panel */}
       <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-3 text-sm">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-2">
             <button onClick={() => setShowEnrollModal(true)} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50 group">
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                  <UserPlus size={20} className="text-indigo-600"/>
                </div>
                <span className="text-[9px] font-bold text-slate-700">Enroll</span>
             </button>
             {auth.currentUser?.phoneNumber === '+917407463884' && (
               <button onClick={() => setShowResetModal(true)} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-red-50 group">
                  <div className="p-2 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors">
                    <ShieldAlert size={20} className="text-red-600"/>
                  </div>
                  <span className="text-[9px] font-bold text-red-700">Reset DB</span>
               </button>
             )}
             {/* Other buttons placeholder */}
          </div>
       </div>

       {/* Enrollment Modal */}
       {showEnrollModal && (
           <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
               <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-6 space-y-5 animate-in slide-in-from-bottom-5 duration-300">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-black text-xl text-slate-900">Enroll Assets</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Access Configuration</p>
                        </div>
                        <button onClick={() => setShowEnrollModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                    </div>

                    {enrollMsg && <p className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-600">{enrollMsg}</p>}

                    <div className="space-y-4">
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Candidate Name" 
                                value={enrollData.name} 
                                onChange={e => setEnrollData({...enrollData, name: e.target.value})}
                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                        <div className="relative">
                            <Smartphone className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                            <input 
                                type="tel" 
                                placeholder="Mobile Number" 
                                value={enrollData.mobile} 
                                onChange={e => setEnrollData({...enrollData, mobile: e.target.value.replace(/\D/g, '')})}
                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>

                        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                            {['student', 'examiner', 'mentor'].map(r => (
                                <button 
                                    key={r}
                                    onClick={() => setEnrollData({...enrollData, role: r})}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${enrollData.role === r ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Assignment Batch</label>
                            <select 
                                value={enrollData.batchId} 
                                onChange={e => setEnrollData({...enrollData, batchId: e.target.value})}
                                className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm focus:bg-white transition-all outline-none"
                            >
                                <option value="">No Batch Assigned</option>
                                {batches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
                            </select>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                <Key size={14}/>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Security Protocol</span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">Default biometric security PIN: <span className="text-indigo-600">123456</span>. Forced password reset on first access.</p>
                        </div>
                    </div>

                    <button 
                        onClick={handleEnroll}
                        disabled={enrollLoading || !enrollData.name || !enrollData.mobile}
                        className="w-full py-4 bg-slate-900 text-white rounded-[1.5rem] font-bold text-sm hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                        {enrollLoading ? 'Processing Authorization...' : 'Complete Enrollment'}
                    </button>
               </div>
           </div>
       )}

       {showResetModal && <DatabaseResetTool onClose={() => setShowResetModal(false)} />}

       {/* Activity Timeline */}
       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
            <Activity className="w-4 h-4 mr-2 text-primary-500" />
            Live System Activity
          </h3>
          <div className="space-y-4">
            {recentActivities.map((act, i) => (
              <div key={`${act.type}-${i}`} className="flex items-start gap-3">
                 <div className={`mt-1 w-2 h-2 rounded-full ${act.color.replace('text', 'bg')}`} />
                 <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900">{act.type}</p>
                    <p className="text-[10px] text-slate-500">{act.title}</p>
                 </div>
                 <p className="text-[10px] font-medium text-slate-400">{act.time}</p>
              </div>
            ))}
          </div>
       </div>
    </div>
  );
}
