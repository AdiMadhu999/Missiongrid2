import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";
import { TestService } from "../../services/test";
import { Test, TestAttempt } from "../../models/mission";
import { motion } from "motion/react";
import { 
  Clock, FileText, Award, Calendar, Lock, Play, 
  CheckCircle, AlertCircle, RefreshCw, Key, ShieldAlert, Info
} from "lucide-react";

export default function PublicLiveTestLanding() {
  const { shareableId } = useParams<{ shareableId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  
  // Attempts matching
  const [existingAttempt, setExistingAttempt] = useState<TestAttempt | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // in seconds

  useEffect(() => {
    if (!shareableId) return;
    
    setLoading(true);
    TestService.getTestByShareableId(shareableId)
      .then(async (t) => {
        if (!t) {
          setError("Test not found or link has expired.");
          setLoading(false);
          return;
        }
        if (!t.isPublic) {
          setError("This test is no longer publicly accessible.");
          setLoading(false);
          return;
        }
        setTest(t);
        if (t.batchId) {
          sessionStorage.setItem('public_test_batch_id', t.batchId);
          sessionStorage.setItem('public_test_batch_name', t.batchName || '');
        }
        
        // Track analytics view
        try {
          await TestService.incrementTestAnalytics(t.id, 'views');
        } catch (analyticsError) {
          console.warn("Analytics increment failed:", analyticsError);
        }

        // Check attempts if logged in
        if (userProfile?.uid) {
          try {
            const atts = await TestService.getAttemptsForTestAndStudent(t.id, userProfile.uid);
            if (atts && atts.length > 0) {
              setAttemptCount(atts.length);
              // Find first finished attempt or latest one
              const finished = atts.find(a => a.status === 'completed' || a.status === 'submitted' || a.status === 'evaluated');
              setExistingAttempt(finished || atts[0]);
            }
          } catch (e) {
            console.error("Failed to load attempts for student", e);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        setError("An error occurred while loading test details.");
        setLoading(false);
      });
  }, [shareableId, userProfile]);

  // Countdown clock effect
  useEffect(() => {
    if (!test || !test.scheduledFor) return;
    const start = new Date(test.scheduledFor).getTime();
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = Math.floor((start - now) / 1000);
      if (diff > 0) {
        setTimeRemaining(diff);
      } else {
        setTimeRemaining(null);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [test]);

  const handleStart = async () => {
    if (!test) return;

    // Check Password Protection
    if (test.passwordProtected) {
      if (passwordInput !== test.testPassword) {
        setPasswordError("Incorrect test password. Please verify and try again.");
        return;
      }
    }

    // Set redirect url just in case
    sessionStorage.removeItem('redirect_url');

    // Navigation
    try {
      setLoading(true);
      // Track analytics start
      try {
        await TestService.incrementTestAnalytics(test.id, 'started');
      } catch (analyticsError) {
        console.warn("Analytics increment failed:", analyticsError);
      }
      navigate(`/app/tests/attempt/${test.id}`);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleRegisterRedirect = async () => {
    if (shareableId) {
      sessionStorage.setItem('redirect_url', `/live/${shareableId}`);
      // Track analytics registration conversion trigger
      if (test) {
        try {
          await TestService.incrementTestAnalytics(test.id, 'registrations');
        } catch (analyticsError) {
          console.warn("Analytics increment failed:", analyticsError);
        }
      }
    }
    navigate('/register');
  };

  const handleLoginRedirect = () => {
    if (shareableId) {
      sessionStorage.setItem('redirect_url', `/live/${shareableId}`);
    }
    navigate('/login');
  };

  const formatCountdown = (secs: number) => {
    const d = Math.floor(secs / (3600*24));
    const h = Math.floor((secs % (3600*24)) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Live Test Details...</p>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-400 max-w-md leading-relaxed font-semibold mb-6">
          {error || "The requested live test link is invalid, inactive, or has been removed."}
        </p>
        <Link to="/" className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-95">
          Go To MissionGrid Home
        </Link>
      </div>
    );
  }

  const isScheduledInFuture = timeRemaining !== null;
  const isExpired = test.expiryDate ? new Date() > new Date(test.expiryDate) : false;
  
  // Check attempt limit reach
  const maxAttemptsVal = test.maxAttempts || (test.oneAttemptOnly ? 1 : 9999);
  const isAttemptLimitReached = attemptCount >= maxAttemptsVal;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden p-4 sm:p-6 md:p-12">
      {/* Visual Ambience Lights */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl overflow-hidden border border-white/20 shadow-md">
            <img 
              src="/src/assets/images/clean_modern_app_icon_1782861953116.jpg" 
              alt="MissionGrid" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback image source in case path isn't fully matched in all execution environments
                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80";
              }}
            />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white block">MissionGrid</span>
            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block -mt-1">Public Hub</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-right">Visibility</span>
          <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider mt-0.5">
            Public Shareable
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-stretch justify-center gap-8 max-w-6xl mx-auto w-full">
        {/* Left Column: Test Overview */}
        <div className="flex-1 flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <span className="inline-block bg-indigo-600/25 border border-indigo-500/35 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-300">
              {test.subject || "Mission Live Test"}
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              {test.title}
            </h1>
            <p className="text-sm text-slate-400 font-semibold max-w-xl leading-relaxed">
              {test.description || "Take this live test curated by expert MissionGrid mentors to analyze your current SSC and competitive exam preparation."}
            </p>
          </div>

          {/* Core Metrics Cards Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <Clock className="w-5 h-5 text-indigo-400 mx-auto mb-1.5" />
              <span className="text-[9px] font-black uppercase text-slate-500 block">Duration</span>
              <span className="text-lg font-black text-white block mt-0.5">{test.duration} Min</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <FileText className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
              <span className="text-[9px] font-black uppercase text-slate-500 block">Questions</span>
              <span className="text-lg font-black text-white block mt-0.5">{test.questions?.length || 0} Qs</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <Award className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
              <span className="text-[9px] font-black uppercase text-slate-500 block">Max Marks</span>
              <span className="text-lg font-black text-white block mt-0.5">{test.maximumMarks} Pts</span>
            </div>
          </div>

          {/* Test Instructions */}
          {test.instructions && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" /> General Instructions
              </h3>
              <div className="text-xs text-slate-400 leading-relaxed space-y-1 font-semibold whitespace-pre-line">
                {test.instructions}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Card */}
        <div className="w-full lg:w-[400px] flex flex-col justify-center">
          <div className="bg-slate-900/60 border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
            {/* Countdown Banner if scheduled */}
            {isScheduledInFuture && (
              <div className="absolute top-0 left-0 right-0 bg-amber-500/20 text-amber-400 border-b border-amber-500/35 text-center py-2.5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 animate-pulse">
                <Calendar className="w-4 h-4" /> Live Test Starts in: {formatCountdown(timeRemaining)}
              </div>
            )}

            <div className={isScheduledInFuture ? "pt-8 space-y-6" : "space-y-6"}>
              <div>
                <h3 className="text-lg font-black text-white">Participation Desk</h3>
                <p className="text-xs text-slate-400 mt-1 font-semibold">
                  {userProfile ? `Logged in as ${userProfile.name}` : "Connect your registered account to participate in this mock test."}
                </p>
              </div>

              {/* Condition 1: Not Authenticated / Logged in */}
              {!userProfile ? (
                <div className="space-y-4">
                  <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-indigo-300 font-bold">
                      Registration is strictly required to process and store your evaluation, leaderboards, and detailed analytics.
                    </p>
                  </div>
                  <button
                    onClick={handleRegisterRedirect}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer"
                  >
                    Register with OTP 🇮🇳
                  </button>
                  <button
                    onClick={handleLoginRedirect}
                    className="w-full py-4 bg-white/5 border border-white/15 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
                  >
                    Already Registered? Login
                  </button>
                </div>
              ) : (
                /* Condition 2: Logged in candidate */
                <div className="space-y-6">
                  {/* Scenario A: Attempt limit reached */}
                  {isAttemptLimitReached ? (
                    <div className="space-y-4">
                      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-center space-y-2">
                        <p className="text-xs text-rose-300 font-bold">
                          You have completed the maximum allowable attempts ({maxAttemptsVal} of {maxAttemptsVal}) for this test.
                        </p>
                      </div>
                      {existingAttempt && (
                        <button
                          onClick={() => navigate(`/app/tests/result/${existingAttempt.id}`)}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all cursor-pointer"
                        >
                          View Your Evaluation
                        </button>
                      )}
                    </div>
                  ) : isScheduledInFuture ? (
                    /* Scenario B: Scheduled for the future */
                    <div className="space-y-4 text-center p-6 bg-slate-950/45 rounded-2xl border border-white/5">
                      <Lock className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Test Locked</p>
                      <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                        This live test is scheduled for a future release date. The start button will automatically unlock once the countdown completes.
                      </p>
                    </div>
                  ) : isExpired ? (
                    /* Scenario C: Test has expired */
                    <div className="space-y-4 text-center p-6 bg-slate-950/45 rounded-2xl border border-white/5">
                      <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                      <p className="text-xs text-rose-300 font-bold uppercase tracking-wider">Live Test Ended</p>
                      <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                        Participation period has ended. Only registered candidates with prior completed attempts can access results.
                      </p>
                    </div>
                  ) : (
                    /* Scenario D: Live and ready to start! */
                    <div className="space-y-4">
                      {/* Password protect entry field */}
                      {test.passwordProtected && (
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Required Test Password
                          </label>
                          <div className="relative">
                            <Key className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                            <input
                              type="password"
                              value={passwordInput}
                              onChange={(e) => {
                                setPasswordInput(e.target.value);
                                setPasswordError("");
                              }}
                              placeholder="Enter access key"
                              className="w-full bg-slate-950/80 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-600 font-medium"
                            />
                          </div>
                          {passwordError && (
                            <p className="text-[10px] font-bold text-rose-400 leading-tight">{passwordError}</p>
                          )}
                        </div>
                      )}

                      <button
                        onClick={handleStart}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-white" /> Start Live Test
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer stamp inside card */}
            <div className="border-t border-white/5 pt-4 mt-6 text-center text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
              Protected by MissionGrid Active Shield
            </div>
          </div>
        </div>
      </div>

      {/* Footer copyright and links */}
      <div className="relative z-10 text-center text-[10px] font-bold text-slate-600 mt-12 border-t border-white/10 pt-6">
        <p>© 2026 MissionGrid. Active curation of roadmap for SSC Aspirants.</p>
      </div>
    </div>
  );
}
