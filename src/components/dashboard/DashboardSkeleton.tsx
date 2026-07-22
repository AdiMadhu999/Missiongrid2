import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const DashboardSkeleton = () => {
  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-24 rounded-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={`skeleton-dash-grid-${i}`} className="bg-white p-4 rounded-3xl border border-slate-100 flex flex-col items-center space-y-2 shadow-sm">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="w-10 h-2" />
            <Skeleton className="w-16 h-4" />
          </div>
        ))}
      </div>

      {/* Action Logger */}
      <div className="bg-white h-20 rounded-[2.5rem] border border-slate-100 flex items-center justify-between p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="w-32 h-3.5" />
            <Skeleton className="w-48 h-2" />
          </div>
        </div>
        <Skeleton className="w-20 h-10 rounded-2xl" />
      </div>

      {/* Progress */}
      <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 space-y-3 shadow-sm">
        <Skeleton className="w-32 h-3.5" />
        <Skeleton className="w-full h-3 rounded-full" />
        <Skeleton className="w-56 h-2" />
      </div>

      {/* Leaderboard */}
      <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 space-y-3 shadow-sm">
        <Skeleton className="w-40 h-3.5" />
        {[1, 2, 3].map(i => (
          <div key={`skeleton-leaderboard-${i}`} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="flex gap-2 items-center">
              <Skeleton className="w-6 h-6 rounded-lg" />
              <Skeleton className="w-24 h-3" />
            </div>
            <Skeleton className="w-10 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
};
