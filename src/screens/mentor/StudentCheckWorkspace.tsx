import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, UserCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import { AuthService } from '../../services/auth';
import { useAuth } from '../../providers/AuthProvider';
import { toast } from 'react-hot-toast';

interface Props {
  onBack: () => void;
}

export default function StudentCheckWorkspace({ onBack }: Props) {
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUserProfile, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleMagicLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await AuthService.magicLogin(mobile);
      // Store the mentor's identity so they can return later if needed? 
      // But for now just override userProfile.
      setUserProfile(user);
      toast.success(`Logged in as ${user.name || 'Student'}`);
      
      // Navigate to student dashboard (or doubt area)
      navigate('/app/doubt', { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Magic login failed. Make sure the student mobile number is correct.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-112px)] w-full bg-slate-50 overflow-y-auto">
      <div className="px-4 sm:px-6 pt-6 sm:pt-10 pb-4 sm:pb-6 bg-white border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Student Check</h1>
            <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mt-0.5">Passwordless Access</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 w-full max-w-md"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
              <UserCheck size={32} />
            </div>
          </div>
          <h2 className="text-center text-xl font-black text-slate-800 mb-2">Check Student Account</h2>
          <p className="text-center text-xs font-medium text-slate-500 mb-8 px-4">
            Enter the student's registered mobile number to instantly access their dashboard and review their progress.
          </p>

          <form onSubmit={handleMagicLogin} className="space-y-4">
            {error && (
              <div className="bg-rose-50 text-rose-600 text-[10px] font-bold p-3 rounded-xl border border-rose-100 flex items-start gap-2">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="mobile" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">
                  +91
                </span>
                <input
                  id="mobile"
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  className="block w-full rounded-2xl border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-slate-900 font-bold text-sm border focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  placeholder="Enter 10-digit number"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 text-sm font-black text-white shadow-lg hover:bg-indigo-700 active:translate-y-0 hover:-translate-y-0.5 transition-all disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {loading ? 'Accessing...' : 'Enter Dashboard'} <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
