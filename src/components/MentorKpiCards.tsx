import React, { useState, useEffect } from 'react';
import { TestService } from '../services/test';
import { TestAttempt, Test } from '../models/mission';
import { TrendingUp, CheckCircle, BarChart3 } from 'lucide-react';

interface Props {
  mentorId?: string;
}

export default function MentorKpiCards({ mentorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    avgScore: 0,
    passRate: 0,
    totalCompleted: 0
  });

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const [tests, attempts] = await Promise.all([
          TestService.getTestsForMentor(mentorId || 'all'),
          TestService.getAllAttempts()
        ]);

        const testMap: Record<string, Test> = {};
        tests.forEach(t => {
          testMap[t.id] = t;
        });

        const relevantAttempts = attempts.filter(att => !!testMap[att.testId]);

        if (relevantAttempts.length === 0) {
          setStats({ avgScore: 0, passRate: 0, totalCompleted: 0 });
          return;
        }

        let totalMarks = 0;
        let passCount = 0;

        relevantAttempts.forEach(att => {
          totalMarks += (att.marks || 0);
          const test = testMap[att.testId];
          if (test && att.marks >= (test.passingMarks || 0)) {
            passCount++;
          }
        });

        setStats({
          avgScore: Number((totalMarks / relevantAttempts.length).toFixed(1)),
          passRate: Math.round((passCount / relevantAttempts.length) * 100),
          totalCompleted: relevantAttempts.length
        });
      } catch (err) {
        console.error("Error fetching KPIs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
  }, [mentorId]);

  const cards = [
    {
      label: 'Average Score',
      value: stats.avgScore,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'bg-indigo-50 text-indigo-600',
      suffix: 'pts'
    },
    {
      label: 'Overall Pass Rate',
      value: `${stats.passRate}%`,
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'bg-emerald-50 text-emerald-600'
    },
    {
      label: 'Total Tests Completed',
      value: stats.totalCompleted,
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'bg-blue-50 text-blue-600'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm animate-pulse">
            <div className="w-10 h-10 bg-slate-100 rounded-2xl mb-4"></div>
            <div className="h-4 w-24 bg-slate-100 rounded mb-2"></div>
            <div className="h-8 w-16 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className={`w-12 h-12 ${card.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
            {card.icon}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{card.label}</p>
          <div className="flex items-baseline gap-1">
            <h4 className="text-3xl font-black text-slate-900 tracking-tight">{card.value}</h4>
            {card.suffix && <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{card.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
