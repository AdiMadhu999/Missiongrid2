import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

interface Props {
  message: string;
  title?: string;
}

export default function PendingApprovalScreen({ message, title = "Account Status" }: Props) {
  const { logout } = useAuth();
  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-amber-200">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-3">{title}</h2>
      <p className="text-slate-600 mb-8 max-w-sm leading-relaxed">{message}</p>
      
      <button 
        onClick={handleLogout}
        className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm"
      >
        <LogOut className="w-5 h-5" />
        <span>Sign Out</span>
      </button>
    </div>
  );
}
