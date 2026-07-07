import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { TestService } from '../services/test';
import { Test, TestAttempt } from '../models/mission';
import { AlertCircle, HelpCircle } from 'lucide-react';

interface Props {
  mentorId?: string;
}

export default function MentorBatchAnalytics({ mentorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [incorrectData, setIncorrectData] = useState<any[]>([]);
  const [skippedData, setSkippedData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tests, attempts] = await Promise.all([
          TestService.getTestsForMentor(mentorId || 'all'), 
          TestService.getAllAttempts()
        ]);

        const questionStats: Record<string, { 
          text: string, 
          wrong: number, 
          skipped: number, 
          total: number, 
          testTitle: string 
        }> = {};

        // Map tests for quick lookup
        const testMap: Record<string, Test> = {};
        tests.forEach(t => {
          testMap[t.id] = t;
        });

        attempts.forEach(attempt => {
          const test = testMap[attempt.testId];
          if (!test) return;

          test.questions.forEach(q => {
            if (!questionStats[q.id]) {
              questionStats[q.id] = { 
                text: q.text.substring(0, 30) + (q.text.length > 30 ? '...' : ''), 
                wrong: 0, 
                skipped: 0, 
                total: 0,
                testTitle: test.title
              };
            }

            questionStats[q.id].total++;
            
            const ans = attempt.answers[q.id];
            if (!ans || !ans.value || (Array.isArray(ans.value) && ans.value.length === 0)) {
              questionStats[q.id].skipped++;
            } else {
              // check if it's evaluated as wrong
              // marksAwarded can be negative or 0 if wrong
              // Note: marksAwarded is 0 for skipped too, so we check existence first
              if (ans.marksAwarded !== undefined && ans.marksAwarded <= 0) {
                 questionStats[q.id].wrong++;
              }
            }
          });
        });

        const statsArray = Object.values(questionStats);
        
        const topIncorrect = statsArray
          .filter(s => s.total > 0)
          .sort((a, b) => b.wrong - a.wrong)
          .slice(0, 5)
          .map(s => ({
            name: s.text,
            count: s.wrong,
            test: s.testTitle,
            fullText: s.text
          }));

        const topSkipped = statsArray
          .filter(s => s.total > 0)
          .sort((a, b) => b.skipped - a.skipped)
          .slice(0, 5)
          .map(s => ({
            name: s.text,
            count: s.skipped,
            test: s.testTitle,
            fullText: s.text
          }));

        setIncorrectData(topIncorrect);
        setSkippedData(topSkipped);
      } catch (err) {
        console.error("Error fetching analytics data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-pulse space-y-4">
        <div className="h-4 w-32 bg-slate-200 rounded"></div>
        <div className="h-64 bg-slate-50 rounded-2xl"></div>
      </div>
    );
  }

  if (incorrectData.length === 0 && skippedData.length === 0) {
    return (
      <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
         <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-slate-300" />
         </div>
         <h4 className="font-bold text-slate-900 mb-1">No Data Available</h4>
         <p className="text-xs text-slate-500">Insights will appear once students complete tests.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.test}</p>
          <p className="text-xs font-bold text-slate-900 mb-2">{payload[0].payload.name}</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            <p className="text-xs font-black text-slate-900">
              {payload[0].value} <span className="text-slate-400 font-bold uppercase text-[9px] ml-1">Responses</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <h3 className="font-black text-slate-900 text-sm px-1 uppercase tracking-widest flex items-center gap-2">
        Test Insights
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Most Incorrect Chart */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
                <AlertCircle size={20}/>
             </div>
             <div>
                <h4 className="font-bold text-slate-900">Most Incorrect</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top 5 Critical Failures</p>
             </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incorrectData} layout="vertical" margin={{ left: 0, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={100}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24}>
                  {incorrectData.map((entry, index) => (
                    <Cell key={`incorrect-cell-${index}`} fill={index === 0 ? '#e11d48' : '#fb7185'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Skipped Chart */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                <HelpCircle size={20}/>
             </div>
             <div>
                <h4 className="font-bold text-slate-900">Most Skipped</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top 5 Unanswered Items</p>
             </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skippedData} layout="vertical" margin={{ left: 0, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={100}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24}>
                  {skippedData.map((entry, index) => (
                    <Cell key={`skipped-cell-${index}`} fill={index === 0 ? '#d97706' : '#fbbf24'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
