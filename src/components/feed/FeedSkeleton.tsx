import React from 'react';
import { Card } from '../ui/Card';

export const FeedSkeleton = () => {
  return (
    <div className="space-y-4 px-2 pt-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 border-b border-slate-100 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-6 bg-slate-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        </div>
      ))}
    </div>
  );
};
