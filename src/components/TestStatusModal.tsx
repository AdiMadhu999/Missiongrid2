import React from 'react';
import { X } from 'lucide-react';

interface TestStatusModalProps {
  testId: string;
  onClose: () => void;
  onUpdateStatus: (testId: string, status: any) => void;
  onSchedule: (testId: string) => void;
  onAddToFolder: (testId: string) => void;
  onAssignBatch: (testId: string) => void;
  onDelete: (testId: string) => void;
}

export const TestStatusModal: React.FC<TestStatusModalProps> = ({ 
  testId, onClose, onUpdateStatus, onSchedule, onAddToFolder, onAssignBatch, onDelete 
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-900 flex justify-between items-center">
          Test Management Options
          <button onClick={onClose}>
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        <div className="p-2 space-y-1">
          <button onClick={() => onUpdateStatus(testId, 'draft')} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg">Draft</button>
          <button onClick={() => onUpdateStatus(testId, 'published')} className="w-full text-left px-4 py-3 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg">Publish</button>
          <button onClick={() => onUpdateStatus(testId, 'live')} className="w-full text-left px-4 py-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg">Go Live</button>
          <button onClick={() => onSchedule(testId)} className="w-full text-left px-4 py-3 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg">Schedule</button>
          <button onClick={() => onUpdateStatus(testId, 'completed')} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg">Complete</button>
          <button onClick={() => onAddToFolder(testId)} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg">Add to Folder</button>
          <button onClick={() => onAssignBatch(testId)} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg">Assign Batch</button>
          <button onClick={() => onDelete(testId)} className="w-full text-left px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg">Delete</button>
        </div>
      </div>
    </div>
  );
};
