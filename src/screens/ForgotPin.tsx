import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AuthService } from '../services/auth';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function ForgotPin() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'send-otp' | 'verify-otp' | 'set-password'>('send-otp');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    setRecaptchaVerifier(verifier);
    return () => {
      verifier.clear();
    };
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await AuthService.sendOtp(mobile, recaptchaVerifier);
      setStep('verify-otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Use verifyOnlyOtp to just verify the OTP and authenticate the mobile number,
      // without creating a new user profile or modifying existing ones.
      await AuthService.verifyOnlyOtp(otp);
      setStep('set-password');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Need a resetPassword method
      await AuthService.resetPassword(mobile, newPassword);
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
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
          className="bg-white/85 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50"
        >
          <h2 className="text-2xl font-black text-indigo-950 mb-6">Forgot Password</h2>
          <form className="space-y-6" onSubmit={step === 'send-otp' ? handleSendOtp : step === 'verify-otp' ? handleVerifyOtp : handleSetPassword}>
            {error && (
              <div className="text-left bg-red-50 text-red-800 p-4 rounded-2xl border border-red-200 text-sm space-y-2">
                <p className="font-semibold">{error}</p>
                {(error.toLowerCase().includes('unauthorized-domain') || 
                  error.toLowerCase().includes('recaptcha') || 
                  error.toLowerCase().includes('captcha') || 
                  error.toLowerCase().includes('not authorized') ||
                  error.toLowerCase().includes('app-not-authorized')) && (
                  <div className="mt-2 text-xs text-red-700 bg-white p-3 rounded-xl border border-red-100 space-y-1">
                    <p className="font-extrabold text-red-900">🔒 Domain Setup Required</p>
                    <p>The current domain <strong className="underline">{window.location.hostname}</strong> is not added to your Firebase project's authorized domains.</p>
                    <ol className="list-decimal pl-4 space-y-1 mt-1 font-medium">
                      <li>Go to the <strong>Firebase Console</strong>.</li>
                      <li>Navigate to <strong>Authentication &gt; Settings &gt; Authorized Domains</strong>.</li>
                      <li>Add <strong>{window.location.hostname}</strong> to the list.</li>
                      <li>Refresh this page and try again!</li>
                    </ol>
                    <p className="mt-2 text-[10px] text-gray-500 italic">Note: In the Google AI Studio preview frame, you can also click "Open in New Tab" at the top right to run the application directly.</p>
                  </div>
                )}
              </div>
            )}
            
            {step === 'send-otp' && (
                <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Mobile Number</label>
                    <input type="tel" required value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} className="block w-full rounded-2xl border-slate-200 bg-white/60 py-3.5 px-4" placeholder="Enter 10-digit mobile" />
                </div>
            )}
            
            {step === 'verify-otp' && (
                <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Enter OTP</label>
                    <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value)} className="block w-full rounded-2xl border-slate-200 bg-white/60 py-3.5 px-4" placeholder="Enter OTP" />
                </div>
            )}
            
            {step === 'set-password' && (
                <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">New Password</label>
                    <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="block w-full rounded-2xl border-slate-200 bg-white/60 py-3.5 px-4" placeholder="Enter new password" />
                </div>
            )}
            
            <div id="recaptcha-container"></div>
            
            <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black">
                {loading ? 'Processing...' : (step === 'send-otp' ? 'Send OTP' : step === 'verify-otp' ? 'Verify OTP' : 'Set New Password')}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
