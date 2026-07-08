import React, { useState, useEffect } from 'react';
import { Test, TestAttempt } from '../../models/mission';
import { TestService } from '../../services/test';
import { ChevronLeft, Clock, BarChart2, Calendar, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { formatIST } from '../../utils/date';

interface Props {
  testId: string;
  studentId: string;
  onBack: () => void;
  onViewResult: (attemptId: string) => void;
}

export default function AttemptHistoryView({ testId, studentId, onBack, onViewResult }: Props) {
  const [test, setTest] = useState<Test | null>(null);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [testId, studentId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [t, atts] = await Promise.all([
        TestService.getTest(testId),
        TestService.getAttemptsForStudent(studentId)
      ]);
      console.log('Attempts fetched:', atts);
      setTest(t);
      setAttempts(atts.filter(a => a.testId === testId).sort((a, b) => b.attemptNumber - a.attemptNumber));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading history...</div>;
  if (!test) return <div className="p-8 text-center text-red-500">Test not found.</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative p-4 overflow-y-auto">
      <div className="flex items-center space-x-3 mb-6">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm border border-slate-200">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">Attempt History</h2>
          <p className="text-sm text-slate-500 truncate max-w-[200px]">{test.title}</p>
        </div>
      </div>

      <div className="space-y-4">
        {attempts.map((att, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={att.id} 
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"
          >
            <div className="flex justify-between items-start mb-3">
               <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Attempt #{att.attemptNumber}</span>
                  <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full inline-block ${
                    att.status === 'evaluated' ? 'bg-green-50 text-green-600' :
                    att.status === 'submitted' ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {att.status}
                  </div>
               </div>
               {att.status === 'evaluated' && (
                 <div className="text-right">
                    <div className="text-2xl font-black text-slate-900">{att.marks}<span className="text-xs text-slate-400 font-bold ml-1">/{test.maximumMarks}</span></div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{att.percentage?.toFixed(1)}% Score</div>
                 </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
               <div className="flex items-center space-x-2 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{att.submittedAt ? formatIST(att.submittedAt) : 'N/A'}</span>
               </div>
               <div className="flex items-center space-x-2 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{Math.floor((att.timeTaken || 0) / 60)}m {(att.timeTaken || 0) % 60}s</span>
               </div>
            </div>

            {att.status === 'evaluated' && (
              <button 
                onClick={() => onViewResult(att.id)}
                className="w-full bg-primary-50 text-primary-600 font-bold py-2 rounded-xl text-sm hover:bg-primary-100 transition-colors"
              >
                View Detailed Report
              </button>
            )}

            {att.status === 'in_progress' && (
              <div className="text-center py-2 text-xs font-bold text-amber-500 bg-amber-50 rounded-xl uppercase tracking-tighter">
                 In Progress
              </div>
            )}
          </motion.div>
        ))}

        {attempts.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500">No attempts found for this test.</p>
          </div>
        )}
      </div>
    </div>
  );
}
