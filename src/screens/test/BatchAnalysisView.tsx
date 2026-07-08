import React, { useState, useEffect } from 'react';
import { ChevronLeft, BarChart2, TrendingUp, Award, AlertCircle, BookOpen, Users, CheckCircle2 } from 'lucide-react';
import { TestService } from '../../services/test';
import { TestAttempt } from '../../models/mission';

interface TestSummary {
  testId: string;
  testTitle: string;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  attemptsCount: number;
}

export default function BatchAnalysisView({ batchId, onBack }: { batchId: string, onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [stats, setStats] = useState({
    avg: 0,
    highest: 0,
    lowest: 0,
    totalAttempts: 0,
  });
  const [testBreakdown, setTestBreakdown] = useState<TestSummary[]>([]);

  useEffect(() => {
    const fetchBatchData = async () => {
      setLoading(true);
      try {
        const allAttempts = await TestService.getAllAttempts();
        // Filter attempts that match this batchId
        const batchAttempts = allAttempts.filter(att => att.batchId === batchId);
        setAttempts(batchAttempts);

        if (batchAttempts.length > 0) {
          const percentages = batchAttempts.map(att => att.percentage || 0);
          const totalPct = percentages.reduce((sum, p) => sum + p, 0);
          const avg = parseFloat((totalPct / batchAttempts.length).toFixed(1));
          const highest = Math.max(...percentages);
          const lowest = Math.min(...percentages);

          setStats({
            avg,
            highest,
            lowest,
            totalAttempts: batchAttempts.length,
          });

          // Perform breakdown per test
          const grouped: Record<string, { title: string; scores: number[] }> = {};
          batchAttempts.forEach(att => {
            const tId = att.testId;
            if (!grouped[tId]) {
              grouped[tId] = {
                title: att.testTitle || 'Untitled Assessment',
                scores: [],
              };
            }
            grouped[tId].scores.push(att.percentage || 0);
          });

          const summary: TestSummary[] = Object.entries(grouped).map(([testId, data]) => {
            const sumScores = data.scores.reduce((s, val) => s + val, 0);
            return {
              testId,
              testTitle: data.title,
              avgScore: parseFloat((sumScores / data.scores.length).toFixed(1)),
              highestScore: Math.max(...data.scores),
              lowestScore: Math.min(...data.scores),
              attemptsCount: data.scores.length,
            };
          });

          setTestBreakdown(summary);
        } else {
          setStats({ avg: 0, highest: 0, lowest: 0, totalAttempts: 0 });
          setTestBreakdown([]);
        }
      } catch (err) {
        console.error("Error calculating batch analysis metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    if (batchId) {
      fetchBatchData();
    }
  }, [batchId]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto" id="batch-analysis-view-root">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack} 
          className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          id="batch-analysis-back-btn"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-black text-slate-900 leading-tight">Batch Performance Analysis</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Group Identification: {batchId}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-3" id="batch-analysis-loading">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-600/30 border-t-indigo-600 animate-spin"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider animate-pulse">Recalculating batch statistics...</p>
        </div>
      ) : attempts.length === 0 ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm text-center max-w-md mx-auto my-12" id="batch-analysis-empty">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-indigo-600">
            <BarChart2 className="w-7 h-7" />
          </div>
          <h4 className="font-extrabold text-slate-900 mb-1.5 text-base">No Class Metrics Yet</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Students assigned to this batch have not submitted any test outcomes yet. Once assessments are accomplished, reports will render in this panel.
          </p>
        </div>
      ) : (
        <div className="space-y-6" id="batch-analysis-content">
          {/* Main Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-all" id="stat-card-avg">
              <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
                <BarChart2 size={16} />
              </div>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Avg Accuracy</p>
              <p className="text-xl font-black text-slate-900 mt-1">{stats.avg}%</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-all" id="stat-card-highest">
              <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                <Award size={16} />
              </div>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Peak Score</p>
              <p className="text-xl font-black text-slate-900 mt-1">{stats.highest}%</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-all" id="stat-card-lowest">
              <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3">
                <AlertCircle size={16} />
              </div>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Lowest Score</p>
              <p className="text-xl font-black text-slate-900 mt-1">{stats.lowest}%</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-all" id="stat-card-attempts">
              <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-3">
                <Users size={16} />
              </div>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Total Attempts</p>
              <p className="text-xl font-black text-slate-900 mt-1">{stats.totalAttempts}</p>
            </div>
          </div>

          {/* Breakdown List */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 shadow-sm" id="batch-analysis-breakdown">
            <h3 className="font-extrabold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-600" />
              Test-by-Test Breakouts
            </h3>

            <div className="divide-y divide-slate-100">
              {testBreakdown.map((tBreak, idx) => (
                <div key={tBreak.testId} className={`py-4 ${idx === 0 ? 'pt-0' : ''} ${idx === testBreakdown.length - 1 ? 'pb-0' : ''} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-extrabold text-slate-900 text-sm">{tBreak.testTitle}</h4>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>{tBreak.attemptsCount} student submissions</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider">Avg Accuracy</p>
                      <p className={`text-md font-black tracking-tight ${tBreak.avgScore >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {tBreak.avgScore}%
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider font-mono">Range</p>
                      <p className="text-xs font-bold text-slate-700">
                        {tBreak.lowestScore}% - {tBreak.highestScore}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
