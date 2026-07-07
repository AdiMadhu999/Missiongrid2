import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AuthService } from '../services/auth';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ShieldCheck } from 'lucide-react';

interface MentorLoginFormProps {
  onSuccess: (user: any) => void;
  error: string;
  setError: (error: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const MentorLoginForm: React.FC<MentorLoginFormProps> = ({ onSuccess, error, setError, loading, setLoading }) => {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState<'sms' | 'pin'>('sms');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [cooldown, setCooldown] = useState(0);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const logAuthAttempt = async (mobile: string, status: string, details?: string) => {
    try {
      await addDoc(collection(db, 'mentor_auth_logs'), {
        mobile,
        status,
        details,
        timestamp: new Date()
      });
    } catch (e) {
      console.error('Failed to log auth attempt', e);
    }
  };

  useEffect(() => {
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    setRecaptchaVerifier(verifier);
    return () => {
      verifier.clear();
    };
  }, []);

  const handleResendOtp = async () => {
    if (loginMethod !== 'sms') return;
    setLoading(true);
    try {
        if (!recaptchaVerifier) return setError('ReCAPTCHA not initialized');
        await AuthService.sendOtp(mobile, recaptchaVerifier);
        setCooldown(60);
        await logAuthAttempt(mobile, 'OTP_RESENT', 'OTP resent successfully');
    } catch (err: any) {
        setError('Failed to resend OTP: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (showOtpInput) {
      try {
        if (loginMethod === 'sms') {
          await AuthService.verifyOnlyOtp(otp, tempUser);
          await logAuthAttempt(mobile, 'SUCCESS', 'SMS OTP verified');
          onSuccess(tempUser);
        } else {
          // Option B: Verify Mentor Security PIN directly
          const user = await AuthService.verifyMentorSecurityPin(mobile, otp, tempUser);
          await logAuthAttempt(mobile, 'SUCCESS', 'Security PIN verified');
          onSuccess(user);
        }
      } catch (err: any) {
        await logAuthAttempt(mobile, 'FAILURE', loginMethod === 'sms' ? 'Invalid SMS OTP' : 'Invalid Security PIN');
        setError(err.message || (loginMethod === 'sms' ? 'Invalid SMS OTP' : 'Invalid Security PIN'));
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const sanitizedPassword = (password || '').trim();
      
      if (mobile !== '7407463884') {
        throw new Error('This form is for authorized mentors only.');
      }

      const user = await AuthService.loginWithMobileAndPassword(mobile, sanitizedPassword, 'mentor', loginMethod);
      setTempUser(user);
      
      if (loginMethod === 'sms') {
        if (!recaptchaVerifier) return setError('ReCAPTCHA not initialized');
        await AuthService.sendOtp(mobile, recaptchaVerifier);
        setCooldown(60);
        await logAuthAttempt(mobile, 'PENDING_OTP', 'Password correct, OTP sent');
      } else {
        await logAuthAttempt(mobile, 'PENDING_PIN', 'Proceeding to Security PIN verification');
      }
      
      setShowOtpInput(true);
    } catch (err: any) {
      await logAuthAttempt(mobile, 'FAILURE', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleLogin}>
      {error && (
        <div className="text-left bg-red-50 text-red-800 p-3 rounded-xl border border-red-200 text-xs space-y-1">
          <p className="font-semibold">{error}</p>
        </div>
      )}
      
      {showOtpInput ? (
        <div>
          <label htmlFor="otp" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
            {loginMethod === 'sms' ? 'Enter Mentor OTP' : 'Enter Mentor Security PIN'}
          </label>
          <input
            id="otp"
            name="otp"
            type="text"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="block w-full rounded-xl border-slate-200 bg-white py-2.5 px-3 text-slate-900 font-medium text-center text-sm border shadow-sm outline-none font-mono tracking-widest"
            placeholder={loginMethod === 'sms' ? "6-digit OTP" : "6-digit PIN"}
          />
          {loginMethod === 'sms' && (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={cooldown > 0 || loading}
              className="w-full mt-1 text-[10px] font-bold text-indigo-700 underline disabled:text-slate-400"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Method Selection */}
          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
              Verification Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLoginMethod('sms')}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                  loginMethod === 'sms'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-[10px] font-extrabold">SMS OTP</span>
              </button>

              <button
                type="button"
                onClick={() => setLoginMethod('pin')}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                  loginMethod === 'pin'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-[10px] font-extrabold">Security PIN</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="mobile" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              Mentor Mobile
            </label>
            <input
              id="mobile"
              name="mobile"
              type="tel"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
              className="block w-full rounded-xl border-slate-200 bg-white py-2.5 px-3 text-slate-900 font-medium text-sm border shadow-sm outline-none"
              placeholder="10-digit number"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              Mentor Password
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
        </>
      )}
      <div id="recaptcha-container" />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-slate-800 to-emerald-700 text-xs font-black text-white shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-75 disabled:pointer-events-none"
      >
        {loading ? 'Processing...' : (showOtpInput ? (loginMethod === 'sms' ? 'Verify OTP' : 'Verify PIN') : 'Access Portal')}
      </button>
    </form>
  );
};
