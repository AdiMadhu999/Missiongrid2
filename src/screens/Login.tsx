import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import appLogo from "../assets/images/app_logo_base_1783466372014.jpg";
import { motion, AnimatePresence } from 'motion/react';
import { AuthService } from '../services/auth';
import { useAuth } from '../providers/AuthProvider';
import { Eye, EyeOff, ShieldAlert, ArrowRight } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { userProfile, setUserProfile } = useAuth();

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [clickCount, setClickCount] = useState(0);
  const [showMentorLogin, setShowMentorLogin] = useState(false);

  // Mentor fields
  const [mentorMobile, setMentorMobile] = useState('');
  const [mentorEmail, setMentorEmail] = useState('');
  const [mentorSecret, setMentorSecret] = useState('');
  const [mentorPassword, setMentorPassword] = useState('');
  const [showMentorPassword, setShowMentorPassword] = useState(false);

  // If already logged in, redirect
  if (userProfile) {
    if (userProfile.role === 'mentor' || userProfile.role === 'primary-mentor' || userProfile.role === 'admin' || userProfile.role === 'staff') {
      return <Navigate to="/app/mentor-place" replace />;
    } else if (userProfile.role === 'examiner') {
      return <Navigate to="/app/examiner" replace />;
    }
    return <Navigate to="/app/doubt" replace />;
  }

  const handleLogoClick = () => {
    setClickCount(prev => {
      const next = prev + 1;
      if (next >= 10) {
        setShowMentorLogin(true);
      }
      return next;
    });
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!password || password.length !== 6) {
      setError("Security PIN must be exactly 6 digits");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await AuthService.loginWithMobileAndPassword(mobile, password, 'student', 'pin');
      setUserProfile(user);
      navigate('/app/doubt', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMentorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Exact match requirements per user instruction
    if (
      mentorMobile !== '7407463884' || 
      mentorEmail.trim().toLowerCase() !== 'missionselectionofficial999@gmail.com' ||
      mentorSecret.trim() !== 'Honey' ||
      mentorPassword !== '959312'
    ) {
      setError("Invalid mentor credentials.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use the matched credentials to log in via the backend as mentor
      const user = await AuthService.loginWithMobileAndPassword(mentorMobile, mentorPassword, 'mentor', 'pin');
      setUserProfile(user);
      navigate('/app/mentor-place', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Mentor authentication failed.');
    } finally {
      setLoading(false);
    }
  };

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
          className="flex flex-col items-center mb-6"
        >
          <div 
            onClick={handleLogoClick}
            className="h-16 w-16 rounded-xl overflow-hidden shadow-lg mb-2 border border-white/40 transition-transform active:scale-95 select-none"
          >
            <img 
               src={appLogo} 
               alt="MissionGrid Logo" 
               className="w-full h-full object-cover pointer-events-none" 
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
          className="bg-white/90 p-5 rounded-2xl shadow-xl border border-white/60 relative overflow-hidden"
        >
          {/* Top aesthetic color bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
          
          <AnimatePresence mode="wait">
            {showMentorLogin ? (
              <motion.div
                key="mentor-login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <h2 className="text-sm font-black text-indigo-900">Restricted Portal</h2>
                </div>
                
                <form className="space-y-3" onSubmit={handleMentorLogin}>
                  {error && (
                    <div className="bg-rose-50/90 text-rose-600 text-[10px] font-bold p-2.5 rounded-xl border border-rose-100 flex items-start gap-2">
                      <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={mentorMobile}
                      onChange={(e) => setMentorMobile(e.target.value)}
                      className="block w-full rounded-xl border-indigo-200 bg-white py-2 px-3 text-slate-900 font-medium text-xs border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Enter mobile no"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={mentorEmail}
                      onChange={(e) => setMentorEmail(e.target.value)}
                      className="block w-full rounded-xl border-indigo-200 bg-white py-2 px-3 text-slate-900 font-medium text-xs border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Enter email"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider mb-1">
                      Secret Name
                    </label>
                    <input
                      type="text"
                      required
                      value={mentorSecret}
                      onChange={(e) => setMentorSecret(e.target.value)}
                      className="block w-full rounded-xl border-indigo-200 bg-white py-2 px-3 text-slate-900 font-medium text-xs border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Enter secret name"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showMentorPassword ? "text" : "password"}
                        required
                        value={mentorPassword}
                        onChange={(e) => setMentorPassword(e.target.value)}
                        className="block w-full rounded-xl border-indigo-200 bg-white py-2 px-3 pr-9 text-slate-900 font-medium text-xs border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Enter password"
                      />
                      <button 
                         type="button" 
                         onClick={() => setShowMentorPassword(!showMentorPassword)}
                        className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                      >
                          {showMentorPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-xs font-black text-white shadow-md hover:bg-indigo-700 active:translate-y-0 hover:-translate-y-0.5 transition-all disabled:opacity-75 flex items-center justify-center gap-2"
                    >
                      {loading ? 'Authenticating...' : 'Access Authority'} <ArrowRight size={14} />
                    </button>
                  </div>
                  
                  <div className="text-center mt-2">
                     <button type="button" onClick={() => setShowMentorLogin(false)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800">
                         Back to Student Login
                     </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="student-login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <form className="space-y-4" onSubmit={handleStudentLogin}>
                  {error && (
                    <div className="bg-rose-50/90 text-rose-600 text-[10px] font-bold p-3 rounded-xl border border-rose-100 shadow-sm flex items-start gap-2">
                      <span className="mt-0.5">⚠️</span>
                      <span>{error}</span>
                    </div>
                  )}
                  
                  {/* Mobile Number Field */}
                  <div>
                    <label htmlFor="mobile" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                      Mobile No
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
                        className="block w-full rounded-xl border-slate-200 bg-white py-2.5 pl-10 pr-3 text-slate-900 font-medium text-sm border shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
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
                        maxLength={6} 
                        pattern="\d{6}" 
                        inputMode="numeric"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full rounded-xl border-slate-200 bg-white py-2.5 px-3 text-slate-900 font-medium text-sm border shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        placeholder="Enter 6-digit PIN"
                      />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-black text-white shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                      {loading ? 'Logging in...' : 'Login'}
                    </button>
                  </div>
                  
                  {/* Register Link */}
                  <div className="text-center text-[11px] font-bold text-slate-600 mt-4">
                      New student? <br/>
                      <Link to="/register" className="text-amber-600 hover:text-amber-800 underline">Complete your profile</Link>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
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
