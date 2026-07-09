import React, { useState, useEffect } from 'react';
import { TestService } from '../../services/test';
import { Test, TestAttempt } from '../../models/mission';
import { safeDate } from '../../utils/date';
import { Monitor, User, Clock, Activity, Target, ChevronLeft, RefreshCw } from 'lucide-react';

export default function LiveMonitorScreen({ test, onBack }: { test: Test, onBack: () => void }) {
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttempts();
    const int = setInterval(loadAttempts, 15000); // 15s refresh for live monitor
    return () => clearInterval(int);
  }, []);

  const loadAttempts = async () => {
    try {
      const data = await TestService.getAttemptsForTest(test.id);
      setAttempts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string, lastHeartbeat?: string) => {
    if (status !== 'in_progress') return 'text-slate-400 bg-slate-100';
    
    const isActive = lastHeartbeat && (Date.now() - new Date(lastHeartbeat).getTime()) < 60000;
    return isActive ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50';
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 pt-[env(safe-area-inset-top)] overflow-hidden">
      <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-2 bg-slate-100 rounded-lg text-slate-600">
            <ChevronLeft className="w-5 h-5"/>
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Live Monitor</h1>
            <p className="text-xs text-slate-500 font-medium truncate max-w-[200px]">{test.title}</p>
          </div>
        </div>
        <button onClick={loadAttempts} className="p-2 bg-primary-50 text-primary-600 rounded-lg">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attempts.map((a, idx) => {
            const lastHeartbeat = a.lastHeartbeatAt ? new Date(a.lastHeartbeatAt) : null;
            const isOnline = lastHeartbeat && (Date.now() - lastHeartbeat.getTime()) < 60000;
            const answeredCount = Object.keys(a.answers).filter(k => {
              const v = a.answers[k]?.value;
              return v && (Array.isArray(v) ? v.length > 0 : v !== '');
            }).length;

            return (
              <div key={`${a.id || 'att'}-${idx}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-primary-200 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-tight">Student {a.userId.substring(0, 5)}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attempt #{a.attemptNumber}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusColor(a.status, a.lastHeartbeatAt)}`}>
                    {a.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 mr-1.5" /> Session Time
                    </div>
                    <span className="font-bold text-slate-700">{Math.floor((Date.now() - safeDate(a.startedAt).getTime()) / 60000)} mins elapsed</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-slate-500 font-medium">
                      <Activity className="w-3.5 h-3.5 mr-1.5" /> Last Heartbeat
                    </div>
                    <span className={`font-bold ${isOnline ? 'text-green-600' : 'text-amber-600'}`}>
                      {isOnline ? 'Online now' : lastHeartbeat ? `${Math.floor((Date.now() - lastHeartbeat.getTime()) / 60000)}m ago` : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-50">
                    <div className="flex items-center text-slate-500 font-medium">
                      <Target className="w-3.5 h-3.5 mr-1.5" /> Progress
                    </div>
                    <span className="font-bold text-primary-600">{answeredCount} / {test.questions.length} Answered</span>
                  </div>
                </div>

                {/* Question progress bar */}
                <div className="mt-4 flex h-2 bg-slate-100 rounded-full overflow-hidden">
                   {test.questions.map((q, idx) => {
                      const isAnswered = a.answers[q.id]?.value !== undefined && a.answers[q.id].value !== '';
                      const isAt = (a.lastQuestionIdx || 0) === idx;
                      return (
                        <div key={idx} className={`flex-1 ${isAt ? 'bg-primary-500' : isAnswered ? 'bg-emerald-400' : 'bg-slate-200'} ${idx > 0 ? 'ml-[1px]' : ''}`} />
                      );
                   })}
                </div>
              </div>
            );
          })}
        </div>

        {attempts.length === 0 && !loading && (
          <div className="text-center py-20 px-6">
            <Monitor className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-slate-900 font-bold mb-1">No Active Attempts</h3>
            <p className="text-slate-500 text-sm">Waiting for students to begin this test.</p>
          </div>
        )}
      </div>
    </div>
  );
}
