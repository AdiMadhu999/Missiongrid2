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
import appLogo from "../assets/images/app_logo_final_1783550479368.jpg";

export default function UnifiedRegistration() {
  const navigate = useNavigate();
  const { setUserProfile } = useAuth();
  
    const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const batchList = await BatchService.getBatches();
        setBatches(batchList.filter(b => b.status === 'active'));
      } catch (err) {
        console.error("Failed to load batches:", err);
      }
    };
    fetchBatches();
  }, []);
  
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
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
      if (countdown > 0) {
          const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
          return () => clearTimeout(timer);
      }
  }, [countdown]);
  
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || countdown > 0) return;
    if (password !== confirmPassword) {
      setError("PINs do not match.");
      return;
    }
    if (!/^\d+$/.test(password)) {
      setError("Security PIN must be a number.");
      return;
    }
    if (!name.trim() || !mobile.trim() || !selectedBatchId) {
      setError("Please fill all required fields.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the terms and conditions.");
      return;
    }
    setLoading(true);
    setCountdown(5); // 5 second countdown/delay
    setError('');
    try {
      let finalPhotoUrl = previewUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
      const registeredUser = await AuthService.registerWithMobileAndPassword(mobile, password, name, selectedBatchId, finalPhotoUrl);
      const loginResponse = await AuthService.loginWithMobileAndPassword(mobile, password, 'student', 'pin');
      
      // Update AuthProvider profile and wait briefly
      setUserProfile(loginResponse);
      
      // Allow a moment for AuthProvider to potentially reconcile the profile
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      navigate('/app/doubt', { replace: true });
    } catch (err: any) {
      if (err.message === "An account already exists with this mobile number.") {
        setError("This mobile number is already registered. Please go to Login instead.");
      } else {
        setError(err.message || 'Registration failed.');
      }
    } finally {
      setLoading(false);
      setCountdown(0);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-tr from-sky-400 via-indigo-200 to-amber-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-6">
           <img src={appLogo} alt="Logo" className="w-20 h-20 mx-auto rounded-full shadow-lg" />
        </div>
        <h2 className="text-2xl font-black text-indigo-950 mb-6 text-center">Registration</h2>
        <div id="recaptcha-container"></div>
        
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="w-full p-3 border rounded-xl" required />
            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile Number" className="w-full p-3 border rounded-xl" required />
            <div className="relative w-full">
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Security PIN (Number)" inputMode="numeric" className="w-full p-3 border rounded-xl pr-10" required />
              <button type="button" className="absolute right-3 top-3.5 text-gray-500" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <div className="relative w-full">
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Security PIN" inputMode="numeric" className="w-full p-3 border rounded-xl pr-10" required />
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

            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Next</button>
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

            <button onClick={handleFinalSubmit} disabled={!acceptedTerms || loading || countdown > 0} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">{loading ? "Registering..." : countdown > 0 ? `Wait ${countdown}s` : "Finish Registration"}</button>
          </div>
        )}
        
        {error && <p className="text-red-500 text-xs mt-4">{error}</p>}
      </div>
    </div>
  );
}
