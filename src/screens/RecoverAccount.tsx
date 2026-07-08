import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AuthService } from '../services/auth';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Shield, ArrowLeft, CheckCircle2, Phone, Key, Lock, UserCheck } from 'lucide-react';

export default function RecoverAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'send-otp' | 'verify-otp' | 'show-identity' | 'set-password' | 'success'>('send-otp');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [studentDetails, setStudentDetails] = useState<{ uid: string; studentCode: string; name: string } | null>(null);

    useEffect(() => {
    // Pre-fill mobile from query string if available
    const mobileParam = searchParams.get('mobile');
    if (mobileParam) {
      setMobile(mobileParam.replace(/\D/g, ''));
    }
  }, [searchParams]);

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
      const exists = await AuthService.checkMobileExists(mobile);
      if (!exists) {
        setError("No account was found with this mobile number. Please register first.");
        setLoading(false);
        return;
      }

      await AuthService.sendOtp(mobile, recaptchaVerifier);
      setStep('verify-otp');
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await AuthService.verifyOnlyOtp(otp);
      
      // OTP verified successfully! Now retrieve the account's permanent identifiers
      const sanitizedMobile = mobile.replace(/\D/g, '');
      const privateRef = collection(db, 'users_private');
      const qPrivate = query(privateRef, where('mobile', '==', sanitizedMobile));
      const privateSnap = await getDocs(qPrivate);
      
      if (!privateSnap.empty) {
        const pDoc = privateSnap.docs[0];
        const userId = pDoc.id;
        const pData = pDoc.data();
        
        const publicSnap = await getDoc(doc(db, 'users', userId));
        const publicData = publicSnap.exists() ? publicSnap.data() : {};
        
        setStudentDetails({
          uid: pData.uid || userId,
          studentCode: publicData.studentCode || 'N/A',
          name: publicData.name || 'Student'
        });
        
        setStep('show-identity');
      } else {
        throw new Error("Unable to locate profile details.");
      }
    } catch (err: any) {
      setError(err.message || "OTP verification failed. Please check the code.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (newPassword.length < 4) {
        throw new Error("Password must be at least 4 characters.");
      }
      await AuthService.resetPassword(mobile, newPassword);
      setStep('success');
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden bg-gradient-to-tr from-sky-400 via-indigo-200 to-amber-100 p-4">
      {/* Background decoration */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40" />
      <div className="absolute -bottom-40 -right-4 w-96 h-96 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40" />

      <div className="relative w-full max-w-md">
        <Link to="/login" className="absolute -top-12 left-0 flex items-center gap-1.5 text-xs font-black text-indigo-950/70 hover:text-indigo-950 transition-all">
          <ArrowLeft size={16} /> Back to Login
        </Link>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/85  p-8 rounded-3xl shadow-2xl border border-white/50 space-y-6"
        >
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl">
              <Shield size={28} />
            </div>
            <h2 className="text-2xl font-black text-indigo-950">Account Recovery</h2>
            <p className="text-xs text-slate-500 font-medium max-w-xs">
              Recover your registered MissionGrid account and secure your identity.
            </p>
          </div>

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
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Verified Mobile Number
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="block w-full rounded-2xl border-slate-200 bg-white/60 py-3.5 pl-11 pr-4 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Enter 10-digit mobile number"
                  />
                </div>
              </div>
              
              <div id="recaptcha-container"></div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/25 transition-all text-sm"
              >
                {loading ? 'Processing...' : 'Send Recovery OTP'}
              </button>
            </form>
          )}

          {step === 'verify-otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Enter One-Time Password (OTP)
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="block w-full rounded-2xl border-slate-200 bg-white/60 py-3.5 pl-11 pr-4 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Enter OTP sent to your phone"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/25 transition-all text-sm"
              >
                {loading ? 'Verifying...' : 'Verify Identity'}
              </button>
            </form>
          )}

          {step === 'show-identity' && studentDetails && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <UserCheck size={18} />
                  <span>Permanent Identity Verified</span>
                </div>
                
                <div className="text-xs space-y-2 font-medium text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Candidate Name</span>
                    <span className="text-slate-900 font-bold text-sm">{studentDetails.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Verified Mobile</span>
                    <span className="text-slate-900 font-bold">{mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Student Code</span>
                    <span className="text-indigo-600 font-mono font-bold text-sm bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100 inline-block">{studentDetails.studentCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Permanent Firebase UID</span>
                    <span className="text-slate-500 font-mono text-[10px] break-all block bg-slate-100 p-2 rounded border border-slate-200">{studentDetails.uid}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep('set-password')}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/25 transition-all text-sm"
              >
                Proceed to Reset Password/PIN
              </button>
            </div>
          )}

          {step === 'set-password' && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Choose New Password/PIN
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-2xl border-slate-200 bg-white/60 py-3.5 pl-11 pr-4 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Enter new recovery password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/25 transition-all text-sm"
              >
                {loading ? 'Saving...' : 'Set Password & Complete Recovery'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex p-3 bg-emerald-100 text-emerald-600 rounded-full">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Account Recovered!</h3>
              <p className="text-xs text-slate-500 font-medium">
                Your password has been successfully reset. You can now log in using your new credentials.
              </p>
              
              <button
                onClick={() => navigate(`/login?mobile=${mobile}`)}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/25 transition-all text-sm"
              >
                Login Now
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
