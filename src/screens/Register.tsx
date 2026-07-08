import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AuthService } from '../services/auth';
import { useAuth } from '../providers/AuthProvider';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ShieldCheck, UserPlus, Phone, Lock, User, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export default function Register() {
  const navigate = useNavigate();
  const { setUserProfile } = useAuth();
  
  const isNative = Capacitor.isNativePlatform();
  const [useDirectReg, setUseDirectReg] = useState(isNative);
  
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpAttemptCount, setOtpAttemptCount] = useState(0);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (useDirectReg) {
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {
          // Ignore
        }
        setRecaptchaVerifier(null);
      }
      return;
    }

    try {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
      setRecaptchaVerifier(verifier);
      return () => {
        try {
          verifier.clear();
        } catch (e) {
          // Ignore
        }
      };
    } catch (e: any) {
      console.warn("Failed to initialize RecaptchaVerifier:", e);
    }
  }, [useDirectReg]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const exists = await AuthService.checkMobileExists(mobile);
      if (exists) {
        setError("An account already exists with this mobile number. Please login instead.");
        setLoading(false);
        return;
      }

      if (!recaptchaVerifier) return setError('ReCAPTCHA not initialized. Please try Direct Registration if this persists.');
      await AuthService.sendOtp(mobile, recaptchaVerifier);
      setShowOtpInput(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { user, isNew } = await AuthService.verifyOtp(otp, mobile);
      if (isNew) {
        setUserProfile(user);
        navigate('/complete-profile', { replace: true });
      } else {
        setError("An account already exists with this mobile number.");
        setShowOtpInput(false); 
      }
    } catch (err: any) {
      setOtpAttemptCount(prev => prev + 1);
      setError(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const sanitizedMobile = mobile.replace(/\D/g, '');
    if (sanitizedMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError('Name is required.');
      setLoading(false);
      return;
    }

    if (!password || password.length < 4) {
      setError('Password/PIN must be at least 4 characters.');
      setLoading(false);
      return;
    }

    try {
      const exists = await AuthService.checkMobileExists(mobile);
      if (exists) {
        setError("An account already exists with this mobile number. Please login instead.");
        setLoading(false);
        return;
      }

      const user = await AuthService.registerWithMobileAndPassword(mobile, password, name);
      setUserProfile(user);
      navigate('/complete-profile', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Direct registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden bg-gradient-to-tr from-sky-400 via-indigo-200 to-amber-100 p-4">
      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/85 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50 text-center space-y-6"
        >
          <div className="flex items-center justify-between">
            <Link to="/login" className="text-indigo-950 hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h2 className="text-2xl font-black text-indigo-950">Register Account</h2>
            <div className="w-6 h-6"></div>
          </div>

          <div id="recaptcha-container"></div>

          {/* Toggle registration mode */}
          <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/50 flex items-center justify-between text-xs font-semibold text-indigo-950">
            <span className="flex items-center gap-1.5 text-left leading-tight">
              {useDirectReg ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">Password Registration</p>
                    <p className="text-[10px] text-gray-500 font-normal">Offline-safe, no SMS needed</p>
                  </div>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <p className="font-bold">SMS OTP Registration</p>
                    <p className="text-[10px] text-gray-500 font-normal">Standard network verification</p>
                  </div>
                </>
              )}
            </span>
            <button
              onClick={() => {
                setError('');
                setUseDirectReg(!useDirectReg);
              }}
              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-none"
            >
              <span className="text-[10px]">Switch</span>
              {useDirectReg ? (
                <ToggleRight className="w-6 h-6 text-emerald-600" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-indigo-400" />
              )}
            </button>
          </div>
          
          {useDirectReg ? (
            /* Direct Registration Form */
            <form onSubmit={handleDirectRegister} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-indigo-950 block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-indigo-900/40" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter Full Name"
                    className="w-full pl-9 p-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-indigo-950 block">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 h-4 w-4 text-indigo-900/40" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Enter 10-digit Mobile Number"
                    className="w-full pl-9 p-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-indigo-950 block">Set Password / PIN</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-indigo-900/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 4 characters"
                    className="w-full pl-9 p-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors mt-2"
              >
                {loading ? 'Creating Account...' : 'Register Directly'}
              </button>
            </form>
          ) : (
            /* OTP Verification Flow */
            !showOtpInput ? (
              <form onSubmit={handleSendOtp} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-indigo-950 block">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-indigo-900/40" />
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="Enter Mobile Number"
                      className="w-full pl-9 p-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-indigo-950 block">Verification Code</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-3.5 h-4 w-4 text-indigo-900/40" />
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className="w-full pl-9 p-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
            )
          )}

          {error && (
            <div className="text-left bg-red-50 text-red-800 p-4 rounded-2xl border border-red-200 text-sm space-y-2">
              <p className="font-semibold">{error}</p>
              {!useDirectReg && (
                <div className="mt-2 text-xs text-red-700 bg-white p-3 rounded-xl border border-red-100 space-y-1">
                  <p className="font-bold text-red-900">💡 Tip: Try Direct Registration</p>
                  <p>In native mobile apps or isolated environments, standard SMS OTP flows might be unavailable. Try switching to <strong>Password Registration</strong> above to register instantly without SMS.</p>
                </div>
              )}
            </div>
          )}
          
          {error.includes("already exists") && (
            <div className="flex flex-col gap-3 pt-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 text-left">
              <p className="text-xs text-indigo-950 font-semibold mb-1 text-center">Select an option to proceed:</p>
              <Link to="/login" className="w-full bg-white hover:bg-slate-50 text-indigo-600 font-bold py-2.5 px-4 rounded-xl border border-indigo-200 shadow-sm transition-all text-xs text-center block">
                Login
              </Link>
              <Link to="/forgot-pin" className="w-full bg-white hover:bg-slate-50 text-indigo-600 font-bold py-2.5 px-4 rounded-xl border border-indigo-200 shadow-sm transition-all text-xs text-center block">
                Forgot Password
              </Link>
              <Link to={`/recover-account?mobile=${mobile}`} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all text-xs text-center block">
                Recover Account
              </Link>
            </div>
          )}
          
          <div className="text-xs text-slate-500 pt-2">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:underline font-bold">
              Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
