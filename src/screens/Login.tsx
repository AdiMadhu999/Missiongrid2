import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { APP_VERSION, GIT_COMMIT, BUILD_TIMESTAMP } from "../version";
import { Download } from 'lucide-react';
import { AuthService } from '../services/auth';
import { useAuth } from '../providers/AuthProvider';
import { updateUserProfile } from '../services/users';
import { PremiumService } from '../services/premium';
import { MentorLoginForm } from '../components/MentorLoginForm';

export default function Login() {
  const navigate = useNavigate();
  const { userProfile, setUserProfile } = useAuth();
  
  const isDevEnvironment = 
    import.meta.env.DEV || 
    window.location.hostname.includes('localhost') || 
    window.location.hostname.includes('-dev-') || 
    window.location.hostname.includes('ais-dev') || 
    window.location.search.includes('dev=true');

  const [role, setRole] = useState<'student' | 'mentor' | 'examiner'>('student');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  if (userProfile) {
    const redirectUrl = sessionStorage.getItem('redirect_url');
    if (redirectUrl) {
      sessionStorage.removeItem('redirect_url');
      return <Navigate to={redirectUrl} replace />;
    }
    return <Navigate to="/app" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const sanitizedPassword = (password || '').trim();
      const user = await AuthService.loginWithMobileAndPassword(mobile, sanitizedPassword, role);
      
      setUserProfile(user);
      
      // Track login on backend for security history & IP audit if student
      if (user.role === 'student' || role === 'student') {
        try {
          await PremiumService.trackLoginOnBackend();
        } catch (trackErr) {
          console.error("Failed to track student login:", trackErr);
        }
      }

      if (!user.isProfileCompleted) {
        navigate('/complete-profile', { replace: true });
      } else {
        const redirectUrl = sessionStorage.getItem('redirect_url');
        if (redirectUrl) {
          sessionStorage.removeItem('redirect_url');
          navigate(redirectUrl, { replace: true });
        } else {
          const userRole = (user.role || '').toLowerCase();
          const isMentor = userRole === 'mentor' || userRole === 'primary-mentor' || userRole === 'staff' || userRole === 'admin' || userRole === 'examiner';
          navigate(isMentor ? '/app/home' : '/app/doubt', { replace: true });
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRoleTheme = () => {
    switch(role) {
      case 'student':
        return {
          activeClass: 'bg-amber-500 text-white shadow-md shadow-amber-500/20',
          focusRing: 'focus:ring-amber-500',
          accentColor: 'text-amber-600',
          btnGradient: 'from-amber-500 via-orange-500 to-amber-600',
          btnShadow: 'shadow-amber-500/30'
        };
      case 'mentor':
        return {
          activeClass: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20',
          focusRing: 'focus:ring-indigo-600',
          accentColor: 'text-indigo-600',
          btnGradient: 'from-indigo-600 via-violet-600 to-indigo-700',
          btnShadow: 'shadow-indigo-600/30'
        };
      case 'examiner':
        return {
          activeClass: 'bg-rose-600 text-white shadow-md shadow-rose-600/20',
          focusRing: 'focus:ring-rose-600',
          accentColor: 'text-rose-600',
          btnGradient: 'from-rose-600 via-pink-600 to-rose-700',
          btnShadow: 'shadow-rose-600/30'
        };
    }
  };

  const theme = getRoleTheme();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden bg-gradient-to-tr from-sky-400 via-indigo-200 to-amber-100 p-2 sm:p-4">
      {/* Dynamic colorful blur spheres behind the form */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40" />
      <div className="absolute -bottom-40 -right-4 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40" />

      <div className="relative w-full max-w-sm">
        {/* Logo and Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center mb-4"
        >
          <div 
            className="h-16 w-16 rounded-xl overflow-hidden shadow-lg mb-2 border border-white/40 transition-transform"
          >
            <img 
              src="/app_logo.jpg?v=1" 
              alt="MissionGrid Logo" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-center text-2xl font-black leading-tight tracking-tight text-indigo-950">
            MissionGrid
          </h1>
          <p className="text-center text-[9px] font-black text-indigo-700/80 uppercase tracking-[0.2em] mt-0.5">
            By Adi Madhu • Daily Mission for Selection
          </p>
        </motion.div>

        {/* Elegant Glassmorphic Card Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white/90 backdrop-blur-xl p-4 sm:p-5 rounded-2xl shadow-xl border border-white/60 relative overflow-hidden"
        >
          {/* Top aesthetic color bar reflecting active role */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.btnGradient}`} />

          <div className={`grid grid-cols-3 gap-2 mb-8`}>
            <button
                type="button"
                className={`py-2 text-[10px] font-bold rounded-xl transition-all duration-300 ${role === 'student' ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
                onClick={() => { setRole('student'); }}
            >
                Student
            </button>
            <button
              type="button"
              className={`py-2 text-[10px] font-bold rounded-xl transition-all duration-300 ${role === 'mentor' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
              onClick={() => { setRole('mentor'); }}
            >
              Mentor
            </button>
            <button
              type="button"
              className={`py-2 text-[10px] font-bold rounded-xl transition-all duration-300 ${role === 'examiner' ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
              onClick={() => { setRole('examiner'); }}
            >
              Examiner
            </button>
          </div>


          {role === 'mentor' && (
            <div className="text-center mb-6 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <h2 className="text-xl font-black text-indigo-900">Mentor Access Portal</h2>
                <p className="text-xs text-indigo-700 font-bold mt-1">Authorized Mentors Only</p>
            </div>
          )}
          
          {role === 'mentor' ? (
              <MentorLoginForm 
                onSuccess={(user) => {
                  setUserProfile(user);
                  navigate('/app/mentor-place', { replace: true });
                }}
                error={error}
                setError={setError}
                loading={loading}
                setLoading={setLoading}
              />
          ) : (
            <form className="space-y-4" onSubmit={handleLogin}>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-rose-50/90 text-rose-600 text-[10px] font-bold p-3 rounded-xl border border-rose-100 shadow-sm flex items-start gap-2"
                >
                  <span className="mt-0.5">⚠️</span>
                  <span>{error}</span>
                </motion.div>
              )}
              
              {/* Mobile Number Field */}
              <div>
                <label htmlFor="mobile" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">
                    +91
                  </span>
                  <input
                    id="mobile"
                    name="mobile"
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="block w-full rounded-xl border-slate-200 bg-white py-2.5 pl-10 pr-3 text-slate-900 font-medium text-sm border shadow-sm outline-none"
                    placeholder="10-digit number"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                  <label htmlFor="password" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border-slate-200 bg-white py-2.5 px-3 text-slate-900 font-medium text-sm border shadow-sm outline-none"
                    placeholder="Enter password"
                  />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-xl bg-gradient-to-r ${theme.btnGradient} text-xs font-black text-white shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2`}
                >
                  {loading ? 'Unlocking...' : '🚀 Access Dashboard'}
                </button>
              </div>
              
              <div className="text-center text-[10px] font-bold text-slate-600 mt-2">
                <Link to="/forgot-pin" className="text-rose-600 hover:text-rose-800 underline">Forgot Password?</Link>
              </div>
              
              {/* Register Link */}
              <div className="text-center text-[10px] font-bold text-slate-600">
                  New student? <Link to="/register" className="text-indigo-600 hover:text-indigo-800 underline">Register with OTP</Link>
              </div>
            </form>
          )}

        </motion.div>

        
        {/* Motivation Section */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 p-3 text-center flex flex-col items-center gap-1"
        >
          <p className="text-sm font-black text-indigo-950 tracking-tight">
            Dreams, Work Hard, Achieve
          </p>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            SSC, Railways, WB Exams, POLICE
          </p>
        </motion.div>

        {/* Dynamic decorative branding subtitle */}

        <div className="flex flex-col items-center gap-4 mt-6">
          <p className="text-center text-[10px] font-bold text-slate-500/80 drop-shadow-sm">
            Secure biometric-level validation protecting your SSC roadmap.
          </p>
        </div>
      </div>

    </div>
  );
}
