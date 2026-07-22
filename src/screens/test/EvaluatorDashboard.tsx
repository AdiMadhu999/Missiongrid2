import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Test, TestAttempt } from '../../models/mission';
import { TestService } from '../../services/test';
import { ArrowLeft, CheckCircle2, ChevronRight, Search, FileText } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface Props {
  onBack: () => void;
}

import TestEvaluationModal from './TestEvaluationModal';

export default function EvaluatorDashboard({ onBack }: Props) {
  const { userProfile, currentUser } = useAuth();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluatingAttempt, setEvaluatingAttempt] = useState<any>(null);
  const [tests, setTests] = useState<Record<string, Test>>({});

  useEffect(() => {
    loadPendingAttempts();
  }, []);

  const loadPendingAttempts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'test_attempts'), where('status', '==', 'submitted'), limit(50));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(50)));
        const userMap = new Map<string, any>();
        usersSnap.forEach(uDoc => {
          userMap.set(uDoc.id, uDoc.data());
        });

        data.forEach((att: any) => {
          let uData = userMap.get(att.userId);
          if (!uData) {
            for (const [key, val] of userMap.entries()) {
              if (val.uid === att.userId) {
                uData = val;
                break;
              }
            }
          }
          if (uData) {
            att.userName = uData.name || uData.displayName || att.userName || 'Student';
          }
        });
      } catch (err) {
        console.error("Error enriching pending attempts with user names:", err);
      }

      setAttempts(data);

      // Fetch test details for these attempts
      const testIds = Array.from(new Set(data.map((a: any) => a.testId as string)));
      const testMap: Record<string, Test> = {};
      for (const tId of testIds) {
        const t = await TestService.getTest(tId);
        if (t) testMap[tId] = t;
      }
      setTests(testMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  
  if (evaluatingAttempt && tests[evaluatingAttempt.testId]) {
    return (
      <TestEvaluationModal 
        attempt={evaluatingAttempt}
        test={tests[evaluatingAttempt.testId]}
        onClose={() => setEvaluatingAttempt(null)}
        onSaved={loadPendingAttempts}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative p-4 overflow-y-auto">
      <div className="flex items-center space-x-3 mb-6">
         <button onClick={onBack} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50">
           <ArrowLeft className="w-5 h-5 text-slate-600" />
         </button>
         <h2 className="text-xl font-bold text-slate-900">Manual Evaluation</h2>
      </div>

      <div className="space-y-3">
        {loading ? <div className="text-center p-8">Loading attempts...</div> : attempts.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-3xl border border-slate-100 italic text-slate-400">
            No pending subjective evaluations.
          </div>
        ) : (
          attempts.map(att => (
            <div key={att.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">{att.userName || 'Student'}</h4>
                <p className="text-[10px] text-slate-500 uppercase font-black">Test: {tests[att.testId]?.title || att.testId}</p>
              </div>
              <button 
                onClick={() => setEvaluatingAttempt(att)}
                className="bg-primary-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                Mark Now
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
