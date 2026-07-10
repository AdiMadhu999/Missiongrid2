import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import appLogo from "../assets/images/app_logo_final_1783550479368.jpg";
import { motion, AnimatePresence } from 'motion/react';
import { AuthService } from '../services/auth';
import { useAuth } from '../providers/AuthProvider';
import { Eye, EyeOff, ShieldAlert, ArrowRight, Phone, Lock, Trophy, Sparkles, Users, CheckCircle2, Star, Flame, Mail, Shield } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { userProfile, setUserProfile } = useAuth();

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    return <Navigate to="/app/home" replace />;
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
    if (!password || !/^\d+$/.test(password)) {
      setError("Security PIN must be a number");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await AuthService.loginWithMobileAndPassword(mobile, password, 'student', 'pin');
      setUserProfile(user);
      navigate('/app/home', { replace: true });
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
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-y-auto bg-slate-50 p-4 font-sans selection:bg-indigo-200 selection:text-slate-900">
      
      {/* Immersive background glow elements */}
      <div className="absolute top-[-10%] left-[-20%] w-[600px] h-[600px] rounded-full bg-indigo-300/40 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[600px] h-[600px] rounded-full bg-sky-300/40 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-fuchsia-300/30 blur-[100px] pointer-events-none" />

      {/* Grid Overlay for high-tech aesthetic */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <div className="relative w-full max-w-md py-8">
        
        {/* Top Floating Trust Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-6 flex items-center justify-center gap-1.5 bg-white/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200 shadow-xl w-fit"
        >
          <Trophy size={14} className="text-indigo-600 animate-pulse" />
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            Govt Selection Command Center
          </span>
        </motion.div>

        {/* Logo and Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="relative">
            <div 
              onClick={handleLogoClick}
              className="h-20 w-20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(79,70,229,0.15)] mb-4 border-2 border-violet-500/30 transition-all active:scale-95 select-none cursor-pointer hover:border-violet-400/60 duration-300"
            >
              <img 
                 src={appLogo} 
                 alt="MissionGrid Logo" 
                 className="w-full h-full object-cover pointer-events-none" 
                 referrerPolicy="no-referrer"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
            </span>
          </div>
          
          <h1 className="text-center text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-900 via-indigo-700 to-indigo-500 tracking-tight drop-shadow-md">
            MissionGrid
          </h1>
          <p className="text-center text-[10px] font-black text-violet-400 uppercase tracking-[0.25em] mt-1.5">
            Decide. Commit. Overcome.
          </p>
        </motion.div>

        {/* Glassmorphic Interactive Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-200 relative overflow-hidden"
        >
          {/* Subtle inner corner glow */}
          <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
          
          <AnimatePresence mode="wait">
            {showMentorLogin ? (
              <motion.div
                key="mentor-login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center gap-2 justify-center mb-6">
                  <Shield size={18} className="text-indigo-400" />
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">Mentor Validation</h2>
                </div>
                
                <form className="space-y-4" onSubmit={handleMentorLogin}>
                  {error && (
                    <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-2xl border border-rose-900/50 flex items-center gap-2">
                      <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Mentor Phone */}
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400">
                      <Phone size={16} />
                    </span>
                    <input
                      type="tel"
                      required
                      value={mentorMobile}
                      onChange={(e) => setMentorMobile(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      placeholder="Mentor Mobile"
                    />
                  </div>

                  {/* Mentor Email */}
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400">
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      required
                      value={mentorEmail}
                      onChange={(e) => setMentorEmail(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      placeholder="Mentor Email"
                    />
                  </div>

                  {/* Mentor Secret */}
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400">
                      <Sparkles size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      value={mentorSecret}
                      onChange={(e) => setMentorSecret(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      placeholder="Secret Key"
                    />
                  </div>

                  {/* Mentor Password */}
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400">
                      <Lock size={16} />
                    </span>
                    <input
                      type={showMentorPassword ? "text" : "password"}
                      required
                      value={mentorPassword}
                      onChange={(e) => setMentorPassword(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-12 pr-12 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      placeholder="Secret PIN"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMentorPassword(!showMentorPassword)}
                      className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-900 transition-colors"
                    >
                      {showMentorPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-black text-white shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Validating Authorities...' : 'Enter Mentor Domain'} <ArrowRight size={16} />
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={() => setShowMentorLogin(false)} 
                    className="w-full text-xs font-black text-slate-400 hover:text-slate-350 transition-colors py-2 uppercase tracking-widest mt-1"
                  >
                    ← Back to Student Login
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="student-login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                

                <form className="space-y-5" onSubmit={handleStudentLogin}>
                  {error && (
                    <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3.5 rounded-2xl border border-rose-900/50 flex items-start gap-2.5">
                      <ShieldAlert size={16} className="shrink-0 text-rose-400 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  
                  {/* Mobile Number Field */}
                  <div className="relative group">
                    <span className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                      <Phone size={18} />
                    </span>
                    <span className="absolute left-11 top-4.5 text-slate-400 font-black text-xs pointer-events-none select-none">
                      +91
                    </span>
                    <input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-4 pl-20 pr-4 text-slate-900 font-extrabold text-base shadow-inner outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-400"
                      placeholder="Mobile Number"
                    />
                  </div>

                  {/* Password */}
                  <div className="relative group">
                    <span className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                      <Lock size={18} />
                    </span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"} 
                      inputMode="numeric"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-4 pl-12 pr-12 text-slate-900 font-extrabold text-base shadow-inner outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-400"
                      placeholder="Security PIN"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-4 text-slate-400 hover:text-slate-900 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-sm font-black text-white uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-75"
                  >
                    {loading ? 'Establishing Link...' : 'Sign In to Missions'}
                  </button>
                  
                  {/* Register Link */}
                  <div className="text-center text-xs font-semibold text-slate-400 pt-2 border-t border-slate-200">
                      New candidate ready for selection? <br/>
                      <Link to="/register" className="text-indigo-600 font-extrabold hover:text-indigo-700 underline inline-block mt-1.5 transition-colors">
                        Build your Selection Profile →
                      </Link>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer info/trust markers */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-8"
        >
          Secured with Real-Time Encrypted Check-ins
        </motion.p>
      </div>
    </div>
  );
}
