import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AuthService } from '../services/auth';
import { useAuth } from '../providers/AuthProvider';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ShieldCheck, User, Key, Mail, Users, Phone, ArrowLeft, Camera, Eye, EyeOff } from 'lucide-react';
import { updateUserProfile } from '../services/users';
import { uploadProfileImage } from '../services/storage';
import { BatchService } from '../services/batch';
import { Batch } from '../models/mission';
import toast from 'react-hot-toast';

export default function UnifiedRegistration() {
  const navigate = useNavigate();
  const { setUserProfile } = useAuth();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    let strength = 0;
    if (val.length > 5) strength += 25;
    if (/[A-Z]/.test(val)) strength += 25;
    if (/[0-9]/.test(val)) strength += 25;
    if (/[^A-Za-z0-9]/.test(val)) strength += 25;
    setPasswordStrength(strength);
  };
  const [otp, setOtp] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const list = await BatchService.getBatches();
        setBatches(list);
      } catch (e) {
        console.error("Failed to fetch batches:", e);
      }
    };
    fetchBatches();
  }, []);

  useEffect(() => {
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
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !password.trim() || password !== confirmPassword || !selectedBatchId) {
      setError('Please fill all mandatory fields correctly.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const exists = await AuthService.checkMobileExists(mobile);
      if (exists) {
        setError("An account already exists with this mobile number. Please login instead.");
        setLoading(false);
        return;
      }

      if (!recaptchaVerifier) return setError('ReCAPTCHA not initialized.');
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
      const { user } = await AuthService.verifyOtp(otp, mobile);
      
      // Update profile with details
      const updates = {
        name,
        pin: password,
        batchId: selectedBatchId,
        isProfileCompleted: true,
        updatedAt: new Date().toISOString()
      };
      
      let finalPhotoUrl = photoUrl;
      if (photoFile) {
        finalPhotoUrl = await uploadProfileImage(user.id || user.mobile, photoFile);
      }

      await updateUserProfile(user.id || user.mobile, { ...updates, photoUrl: finalPhotoUrl } as any);
      setUserProfile({ ...user, ...updates, photoUrl: finalPhotoUrl } as any);
      
      setStep(2); // Terms and Conditions
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = () => {
    if (!acceptedTerms) return;
    navigate('/app/doubt', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-tr from-sky-400 via-indigo-200 to-amber-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl">
        <h2 className="text-2xl font-black text-indigo-950 mb-6 text-center">Registration</h2>
        <div id="recaptcha-container"></div>
        
        {step === 1 && !showOtpInput && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="w-full p-3 border rounded-xl" required />
            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile Number" className="w-full p-3 border rounded-xl" required />
            <div className="relative w-full">
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => handlePasswordChange(e.target.value)} placeholder="Password" className="w-full p-3 border rounded-xl pr-10" required />
              <button type="button" className="absolute right-3 top-3.5 text-gray-500" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${passwordStrength < 50 ? 'bg-red-500' : passwordStrength < 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${passwordStrength}%` }}
              />
            </div>
            <div className="relative w-full">
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" className="w-full p-3 border rounded-xl pr-10" required />
              <button type="button" className="absolute right-3 top-3.5 text-gray-500" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <select value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)} className="w-full p-3 border rounded-xl" required>
              <option value="">Select a batch</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
            </select>
            
            <div className="flex flex-col items-center">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-24 h-24 rounded-full object-cover mb-4 border-4 border-white shadow-lg" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center mb-4 border-4 border-white shadow-inner">
                   <Camera className="text-indigo-400" size={32} />
                </div>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="w-full p-3 border rounded-xl" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">{loading ? 'Processing...' : 'Send OTP'}</button>
          </form>
        )}

        {showOtpInput && step === 1 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="Enter 6-digit OTP" className="w-full p-3 border rounded-xl" required />
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">{loading ? 'Verifying...' : 'Verify OTP'}</button>
          </form>
        )}
        
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center pb-2 border-b border-indigo-100">
                <h2 className="text-lg font-black text-indigo-950 tracking-tight">📜 শর্তাবলী</h2>
            </div>

            <div className="space-y-4 text-indigo-900 text-xs font-bold leading-relaxed max-h-[300px] overflow-y-auto pr-1 text-justify">
                <p className="border-l-2 border-cyan-500 pl-2.5">১. প্রত্যেক নতুন শিক্ষার্থী রেজিস্ট্রেশনের পর স্বয়ংক্রিয়ভাবে ৩০ দিনের Premium Access পাবেন।</p>
                <p className="border-l-2 border-indigo-500 pl-2.5">২. Premium সুবিধা বজায় রাখতে হলে প্রতিদিনের Mission নিয়মিত সম্পন্ন করে Submission করতে হবে।</p>
                <p className="border-l-2 border-purple-500 pl-2.5">৩. যদি কোনো শিক্ষার্থী টানা ১০ দিন Mission Submission না করেন, তাহলে তিনি তার Premium Access হারাবেন।</p>
                <div className="border-l-2 border-pink-500 pl-2.5 space-y-1">
                    <p>৪. Premium সুবিধা চালিয়ে যেতে চাইলে আপনি দুটি উপায়ে তা করতে পারবেন—</p>
                    <p className="pl-4 text-[11px] text-indigo-800 font-semibold">• Mission-এর নিয়ম মেনে ধারাবাহিকভাবে সক্রিয় থেকে।</p>
                    <p className="pl-4 text-[11px] text-indigo-800 font-semibold">• অথবা নির্ধারিত Premium Upgrade (Payment) গ্রহণ করে।</p>
                </div>
                <p className="border-l-2 border-amber-500 pl-2.5">৫. Mentor প্রয়োজন অনুযায়ী Premium প্রদান, বৃদ্ধি, পুনরায় চালু অথবা বাতিল করার সম্পূর্ণ অধিকার সংরক্ষণ করেন।</p>
                <p className="border-l-2 border-emerald-500 pl-2.5">৬. Premium-এর মেয়াদ, কার্যক্রম এবং নিয়ম পালন সম্পূর্ণভাবে সিস্টেম দ্বারা স্বয়ংক্রিয়ভাবে পর্যবেক্ষণ করা হবে।</p>
                <p className="border-l-2 border-teal-500 pl-2.5">৭. MissionGrid ব্যবহার করার মাধ্যমে আপনি উপরোক্ত সকল শর্তাবলী মেনে চলতে সম্মত হচ্ছেন।</p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none text-indigo-950 text-xs font-black leading-relaxed mt-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all">
              <input 
                  type="checkbox" 
                  checked={acceptedTerms} 
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-indigo-200 bg-white text-indigo-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
              />
              <span>আমি উপরোক্ত শর্তাবলী পড়েছি, বুঝেছি এবং মেনে নিতে সম্মত।</span>
            </label>

            <button onClick={handleFinalSubmit} disabled={!acceptedTerms} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">Finish</button>
          </div>
        )}
        
        {error && <p className="text-red-500 text-xs mt-4">{error}</p>}
      </div>
    </div>
  );
}
