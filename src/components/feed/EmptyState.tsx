import React from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({ message }: { message: string }) => {
  return (
    <div className="text-center py-12 text-slate-500 font-medium">
        <Inbox className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <p>{message}</p>
    </div>
  );
};
