import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const FeedSkeleton = () => {
  return (
    <div className="space-y-4 px-2 pt-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
          <Skeleton className="h-5 w-full mb-3" />
          <Skeleton className="h-4 w-3/4 mb-4" />
          <div className="flex gap-2 pt-2 border-t border-slate-50">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};
