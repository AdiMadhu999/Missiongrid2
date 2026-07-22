import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import appLogo from "../assets/images/app_logo_final_1783550479368.jpg";
import { motion, AnimatePresence } from 'motion/react';
import { AuthService } from '../services/auth';
import { useAuth } from '../providers/AuthProvider';
import { Eye, EyeOff, User, ShieldAlert, ArrowRight, Phone, Lock, Trophy, Sparkles, Mail, Shield, CheckCircle2 } from 'lucide-react';

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
    <div className="flex h-screen w-screen flex-col items-center justify-center relative overflow-hidden bg-slate-900 text-slate-100 p-6 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Dynamic Fluid Cosmic Ambient Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-indigo-600/30 via-purple-600/20 to-transparent blur-[100px] pointer-events-none animate-[pulse_6s_infinite]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-pink-600/20 via-indigo-600/25 to-transparent blur-[120px] pointer-events-none animate-[pulse_8s_infinite_1s]" />
      <div className="absolute top-[25%] left-[15%] w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[90px] pointer-events-none" />

      {/* Grid overlay to give a crisp high-tech administrative portal design */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:20px_20px] opacity-60 pointer-events-none" />

      <div className="relative w-full max-w-sm flex flex-col justify-center z-10 space-y-6">
        
        {/* Hub Indicator Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto flex items-center gap-2 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 px-3.5 py-1.5 rounded-full shadow-lg"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <Trophy size={12} className="text-indigo-400" />
          <span className="text-[10px] font-black tracking-widest text-indigo-300 uppercase">
            Govt Selection Hub
          </span>
        </motion.div>

        {/* Logo & Decorative Title Block */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="flex flex-col items-center text-center"
        >
          {/* Easter-egg Logo Frame */}
          <div className="relative group mb-3">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogoClick}
              className="h-16 w-16 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(99,102,241,0.25)] border-2 border-indigo-500/50 p-1 bg-gradient-to-b from-slate-800 to-slate-950 cursor-pointer select-none transition-all duration-300"
            >
              <img 
                 src={appLogo} 
                 alt="MissionGrid Logo" 
                 className="w-full h-full object-cover rounded-xl pointer-events-none filter brightness-110" 
                 referrerPolicy="no-referrer"
              />
            </motion.div>
            
            {/* Visual indicator for interactive click status */}
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
            </span>
          </div>
          
          <h1 className="text-3xl font-black tracking-tight leading-none">
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              MissionGrid
            </span>
          </h1>
          <p className="text-[9px] font-black text-indigo-300/60 uppercase tracking-[0.35em] mt-1.5">
            Decide • Commit • Overcome
          </p>
        </motion.div>

        {/* Main Interface Terminal Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-slate-950/80 backdrop-blur-2xl p-6 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.5),0_0_1px_1px_rgba(255,255,255,0.08)] border border-slate-800/80 relative overflow-hidden"
        >
          {/* Radiant decorative top glow strip */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <AnimatePresence mode="wait">
            {showMentorLogin ? (
              <motion.div
                key="mentor-login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 justify-center mb-1">
                  <Shield size={16} className="text-indigo-400 animate-pulse" />
                  <h2 className="text-[11px] font-black text-indigo-200 uppercase tracking-widest">Mentor Administration</h2>
                </div>
                
                <form className="space-y-3" onSubmit={handleMentorLogin}>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-rose-950/50 text-rose-300 text-xs font-semibold p-3 rounded-2xl border border-rose-900/50 flex items-center gap-2"
                    >
                      <ShieldAlert size={14} className="shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  {/* Mentor Mobile */}
                  <div className="relative group">
                    <span className="absolute left-3.5 top-3 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <Phone size={14} />
                    </span>
                    <input
                      type="tel"
                      required
                      value={mentorMobile}
                      onChange={(e) => setMentorMobile(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-xs font-bold text-slate-100 placeholder-slate-500 outline-none focus:bg-slate-950 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-950/40 transition-all"
                      placeholder="Mentor Mobile"
                    />
                  </div>

                  {/* Mentor Email */}
                  <div className="relative group">
                    <span className="absolute left-3.5 top-3 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <Mail size={14} />
                    </span>
                    <input
                      type="email"
                      required
                      value={mentorEmail}
                      onChange={(e) => setMentorEmail(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-xs font-bold text-slate-100 placeholder-slate-500 outline-none focus:bg-slate-950 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-950/40 transition-all"
                      placeholder="Mentor Email"
                    />
                  </div>

                  {/* Mentor Secret */}
                  <div className="relative group">
                    <span className="absolute left-3.5 top-3 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <Sparkles size={14} />
                    </span>
                    <input
                      type="text"
                      required
                      value={mentorSecret}
                      onChange={(e) => setMentorSecret(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-xs font-bold text-slate-100 placeholder-slate-500 outline-none focus:bg-slate-950 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-950/40 transition-all"
                      placeholder="Secret Passphrase"
                    />
                  </div>

                  {/* Mentor PIN */}
                  <div className="relative group">
                    <span className="absolute left-3.5 top-3 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <Lock size={14} />
                    </span>
                    <input
                      type={showMentorPassword ? "text" : "password"}
                      required
                      value={mentorPassword}
                      onChange={(e) => setMentorPassword(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-11 text-xs font-bold text-slate-100 placeholder-slate-500 outline-none focus:bg-slate-950 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-950/40 transition-all"
                      placeholder="Security PIN"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMentorPassword(!showMentorPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showMentorPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-black text-white shadow-lg shadow-indigo-950/50 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Authorizing Session...' : 'Enter System Console'} <ArrowRight size={14} />
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={() => setShowMentorLogin(false)} 
                    className="w-full text-[9px] font-black text-slate-500 hover:text-indigo-400 transition-colors py-2 uppercase tracking-widest mt-1 text-center"
                  >
                    ← Cancel Administrative Entry
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="student-login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1.5 text-indigo-400 mb-1">
                    <User size={16} className="animate-pulse" />
                    <h2 className="text-[11px] font-black uppercase tracking-widest">Candidate Entrance</h2>
                  </div>
                  <p className="text-slate-400 text-xs font-semibold">Enter registered phone & security credentials</p>
                </div>

                <form className="space-y-3.5" onSubmit={handleStudentLogin}>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-rose-950/50 text-rose-300 text-xs font-semibold p-3 rounded-2xl border border-rose-900/50 flex items-start gap-2"
                    >
                      <ShieldAlert size={14} className="shrink-0 text-rose-400 mt-0.5" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                  
                  {/* Mobile Number Field */}
                  <div className="relative group">
                    <span className="absolute left-3.5 top-3 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <Phone size={14} />
                    </span>
                    <span className="absolute left-10.5 top-3.5 text-indigo-400 font-black text-[11px] pointer-events-none select-none">
                      +91
                    </span>
                    <input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                      className="block w-full rounded-2xl border border-slate-800 bg-slate-900/60 py-3.5 pl-18 pr-4 text-slate-100 font-extrabold text-xs outline-none focus:bg-slate-950 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-950/40 transition-all placeholder-slate-550"
                      placeholder="Registered Mobile"
                    />
                  </div>

                  {/* Security PIN Field */}
                  <div className="relative group">
                    <span className="absolute left-3.5 top-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <Lock size={14} />
                    </span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"} 
                      inputMode="numeric"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
                      className="block w-full rounded-2xl border border-slate-800 bg-slate-900/60 py-3.5 pl-11 pr-11 text-slate-100 font-extrabold text-xs outline-none focus:bg-slate-950 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-950/40 transition-all placeholder-slate-550"
                      placeholder="Security PIN"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  {/* Custom Forgot PIN Link */}
                  <div className="text-right">
                    <Link 
                      to="/app/forgot-pin" 
                      className="text-[10px] font-black text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest"
                    >
                      Forgot PIN?
                    </Link>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-black text-white uppercase tracking-widest shadow-lg shadow-indigo-950/50 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-75 flex items-center justify-center gap-2 cursor-pointer duration-200 animate-in fade-in duration-300"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Establishing Link...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to Missions</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>


                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
 
        {/* Footer info message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center space-y-1 py-2"
        >
          <p className="text-[10px] font-black text-indigo-400/50 uppercase tracking-[0.25em]">
            Secured Command Portal
          </p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
            AES 256 LIVE ENCRYPTED CONNECTION
          </p>
        </motion.div>
      </div>
    </div>
  );
}

