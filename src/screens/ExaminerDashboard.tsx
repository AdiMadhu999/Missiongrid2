import React, { useState, useEffect } from 'react';
import { BookOpen, Users, UserCheck, Shield, HelpCircle, RefreshCw, Calendar, CheckSquare, LogOut } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { BatchService } from '../services/batch';
import { getUsers } from '../services/users';
import { getStudentCode } from '../utils/privacy';
import { Batch } from '../models/mission';
import { User } from '../models/user';
import { useNavigate } from 'react-router-dom';
import { useCachedQuery } from '../hooks/useCachedQuery';

export default function ExaminerDashboard() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const { data: examinerData, isLoading: loading } = useCachedQuery({
    queryKey: ['examinerDashboardData', userProfile?.id || userProfile?.mobile || ''],
    queryFn: async () => {
      if (!userProfile) return { batches: [], users: [] };
      const bList = await BatchService.getBatches();
      const uList = await getUsers();
      return { batches: bList, users: uList };
    },
    enabled: !!userProfile,
    persistKey: userProfile?.id ? `examiner_dashboard_${userProfile.id}` : undefined
  });

  const batches = examinerData?.batches || [];
  const users = examinerData?.users || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 max-w-sm mx-auto mt-8">
        <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Retrieving supervision orbits...</p>
      </div>
    );
  }

  // Get batches assigned to this examiner
  const examinerId = userProfile?.id || userProfile?.mobile || '';
  const assignedBatches = batches.filter(b => {
    const isAssigned = (b.examinerIds || []).includes(examinerId);
    if (activeTab === 'active') {
      return isAssigned && b.status === 'active';
    } else {
      return isAssigned && (b.status === 'inactive' || b.status === 'archived');
    }
  });

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto">
      
      {/* Welcome & Role */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Supervision Deck</h2>
          <p className="text-xs text-slate-500 mt-0.5">Examiner: <span className="font-semibold text-slate-700">{userProfile?.name}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/app/mentor-place?view=review')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-lg shadow-indigo-100"
          >
            <CheckSquare size={16}/> Review
          </button>
          <button 
            onClick={logout}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded-2xl"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Cohort status selector tabs */}
      <div className="flex bg-slate-200/60 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
            activeTab === 'active' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Active Cohorts
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
            activeTab === 'archived' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Inactive / Archived
        </button>
      </div>

      {/* Batches list */}
      {assignedBatches.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">No Batches Assigned</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            You do not have any {activeTab} batches assigned under your supervision yet. Please contact an administrator to allocate supervisor access coordinates.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignedBatches.map((batch, idx) => {
            // Find students in this batch
            const batchStudents = users.filter(u => u.role === 'student' && u.batchId === batch.id);
            return (
              <div 
                key={`${batch.id || 'b'}-${idx}`} 
                className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3 relative overflow-hidden"
              >
                {/* Batch Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">{batch.batchName}</h4>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-mono mt-0.5 inline-block px-1.5 py-0.5 rounded leading-none">
                        {batch.batchCode}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    batch.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' 
                      : batch.status === 'archived' 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {batch.status}
                  </span>
                </div>

                {/* Batch Description */}
                {batch.description && (
                  <p className="text-xs text-slate-500 font-sans leading-relaxed bg-slate-50 p-2.5 rounded-2xl">
                    {batch.description}
                  </p>
                )}

                {/* Students list */}
                <div className="space-y-2 border-t border-slate-100 pt-2.5 font-sans">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Cohort Fellows ({batchStudents.length})
                  </h5>
                  {batchStudents.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No students assigned to this cohort yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
                      {batchStudents.map((student, sIdx) => (
                        <div key={`${student.id || student.mobile || 'student'}-${sIdx}`} className="flex justify-between items-center py-2 text-xs">
                           <span className="font-semibold text-slate-800">{student.name}</span>
                           <span className="text-[10px] text-slate-500 font-mono tracking-wider">{student.studentCode || getStudentCode(student)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Examiner Action Center */}
      <div className="space-y-4 pt-4">
        <h3 className="font-black text-slate-900 text-xs px-2 uppercase tracking-widest flex items-center gap-2">
          <CheckSquare size={16} className="text-emerald-600 fill-emerald-100" />
          Examiner Action Center
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => navigate('/app/tests')} 
            className="p-4 bg-gradient-to-tr from-emerald-50 to-emerald-100/50 border border-emerald-200/50 text-emerald-950 font-black text-xs rounded-2xl hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 transition-all text-center uppercase tracking-tight flex flex-col items-center justify-center gap-2 shadow-xs"
          >
            <CheckSquare size={20}/>
            <span>Evaluation</span>
          </button>
        </div>
      </div>

    </div>
  );
}
