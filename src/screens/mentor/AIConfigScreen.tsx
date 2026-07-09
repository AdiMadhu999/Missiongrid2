import React from 'react';
import { AIConfiguration } from '../../components/AIConfiguration';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AIConfigScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Back to Dashboard
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Authorized
          </div>
        </div>

        <AIConfiguration />
      </div>
    </div>
  );
}
