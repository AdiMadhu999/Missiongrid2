import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, User, Key, ArrowRight, Mail, Users, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { updateUserProfile } from '../services/users';
import { uploadProfileImage } from '../services/storage';
import { BatchService } from '../services/batch';
import { Batch } from '../models/mission';
import toast from 'react-hot-toast';

export default function CompleteProfile() {
  const { userProfile, setUserProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    
    const fetchBatches = async () => {
      try {
        const list = await BatchService.getBatches();
        if (mounted) {
          if (list.length > 0) {
            setBatches(list);
            const pubBatchId = sessionStorage.getItem('public_test_batch_id');
            if (pubBatchId) {
              setSelectedBatchId(pubBatchId);
            }
          } else if (retryCount < 3) {
            // Retry if empty (workaround for Firestore auth token propagation delay)
            retryCount++;
            setTimeout(fetchBatches, 1000);
          }
        }
      } catch (e) {
        if (mounted && retryCount < 3) {
          retryCount++;
          setTimeout(fetchBatches, 1000);
        }
      }
    };

    fetchBatches();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (userProfile) {
      setMobile(userProfile.mobile || '');
      setEmail(userProfile.email || '');
      setPhotoUrl(userProfile.photoUrl || '');
    }
  }, [userProfile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Candidate Name is required.');
    if (!newPin) return setError('Password is required.');
    if (newPin.length < 6) return setError('Password must be at least 6 characters.');
    if (newPin !== confirmPin) return setError('Password confirmation mismatch.');
    if (!selectedBatchId) return setError('Please select a batch.');

    setError('');
    setStep(2);
  };

  const handleFinalSubmit = async () => {
    if (!acceptedTerms) return;

    setLoading(true);
    setError('');
    try {
      const selectedBatch = batches.find((b: any) => b.id === selectedBatchId);
      const batchName = selectedBatch ? (selectedBatch.batchName || selectedBatch.batchCode) : 'Aspirants';

      const updates = { 
        name, 
        email,
        pin: newPin, 
        photoUrl,
        batchId: selectedBatchId,
        currentBatch: batchName,
        isProfileCompleted: true, 
        updatedAt: new Date().toISOString() 
      };
      await updateUserProfile(userProfile!.id || userProfile!.mobile, updates as any);
      setUserProfile({ ...userProfile!, ...updates } as any);
      const redirectUrl = sessionStorage.getItem('redirect_url');
      sessionStorage.removeItem('public_test_batch_id');
      sessionStorage.removeItem('public_test_batch_name');
      if (redirectUrl) {
        sessionStorage.removeItem('redirect_url');
        navigate(redirectUrl, { replace: true });
      } else {
        const userRole = (userProfile?.role || '').toLowerCase();
        const isMentor = userRole === 'mentor' || userRole === 'primary-mentor' || userRole === 'staff' || userRole === 'admin' || userRole === 'examiner';
        navigate(isMentor ? '/app/home' : '/app/doubt');
      }
    } catch (err: any) {
      setError(err.message);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex flex-col justify-center px-6 py-12 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-500 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto space-y-8">
        <div className="text-center">
            <div className="w-20 h-20 bg-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6  border border-white/20 shadow-2xl">
                <ShieldCheck size={40} className="text-cyan-400" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Mission Activation</h1>
            <p className="text-xs font-bold text-white/60 uppercase tracking-[0.3em] mt-2">Personalize Your Access Hub</p>
        </div>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 -3xl border border-white/20 p-8 rounded-[2.5rem] shadow-2xl"
        >
            {step === 1 ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl text-center">{error}</div>}

                    {photoUrl && (
                        <div className="flex justify-center">
                            <img 
                                src={photoUrl} 
                                alt="Profile" 
                                className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400 shadow-lg"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block px-1">Candidate Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3.5 text-white/20" size={18}/>
                            <input 
                                type="text" 
                                placeholder="Enter full name" 
                                value={name} 
                                onChange={e => setName(e.target.value)}
                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:bg-white/10 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block px-1">Mobile Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3.5 text-white/20" size={18}/>
                            <input 
                                type="tel" 
                                disabled
                                value={mobile ? `+91 ${mobile}` : ''} 
                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-sm outline-none cursor-not-allowed font-semibold"
                                placeholder="Registered Mobile"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block px-1">Email (Optional)</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3.5 text-white/20" size={18}/>
                            <input 
                                type="email" 
                                placeholder="Enter email address" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:bg-white/10 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block px-1">Choose Batch</label>
                        <div className="relative">
                            <Users className="absolute left-3 top-3.5 text-white/20" size={18}/>
                            <select
                                value={selectedBatchId}
                                disabled={!!sessionStorage.getItem('public_test_batch_id')}
                                onChange={e => setSelectedBatchId(e.target.value)}
                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:bg-white/10 focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none disabled:opacity-75 disabled:cursor-not-allowed"
                            >
                                <option value="" className="text-slate-900">Select a batch</option>
                                {batches.map(b => (
                                    <option key={b.id} value={b.id} className="text-slate-900">{b.batchName}</option>
                                ))}
                            </select>
                        </div>
                        {sessionStorage.getItem('public_test_batch_id') && (
                            <p className="text-[11px] text-cyan-400 font-bold mt-2 leading-relaxed">
                                You are registering through this Public Test and will be enrolled in the associated batch.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block px-1">Set Profile Photo</label>
                        <div className="relative">
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={async (e) => {
                                    if (e.target.files && e.target.files[0] && userProfile?.id) {
                                        setLoading(true);
                                        try {
                                            const url = await uploadProfileImage(userProfile.id, e.target.files[0]);
                                            setPhotoUrl(url);
                                        } catch (err) {
                                            toast.error('Failed to upload image.');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }
                                }}
                                className="w-full pl-4 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:bg-white/10 focus:ring-2 focus:ring-indigo-500 transition-all outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 block px-1">Create Password (min. 6 characters)</label>
                        <div className="relative mb-3">
                            <Key className="absolute left-3 top-3.5 text-white/20" size={18}/>
                            <input 
                                type="password" 
                                placeholder="Enter password" 
                                value={newPin} 
                                onChange={e => setNewPin(e.target.value)}
                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:bg-white/10 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                        <div className="relative">
                            <Key className="absolute left-3 top-3.5 text-white/20" size={18}/>
                            <input 
                                type="password" 
                                placeholder="Confirm password" 
                                value={confirmPin} 
                                onChange={e => setConfirmPin(e.target.value)}
                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:bg-white/10 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] text-white/40 font-medium leading-relaxed italic">
                            Note: Establish a secure password to access your mentorship dashboard. Keep your credentials private and safe.
                        </p>
                    </div>

                    <button 
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-cyan-400 to-indigo-500 text-white rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-2 hover:from-cyan-500 hover:to-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-indigo-500/20"
                    >
                        {loading ? 'Synchronizing Profiles...' : (
                            <>
                                <span>Initialize Mission Hub</span>
                                <ArrowRight size={18}/>
                            </>
                        )}
                    </button>
                </form>
            ) : (
                <div className="space-y-6">
                    {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl text-center">{error}</div>}
                    
                    <div className="text-center pb-2 border-b border-white/10">
                        <h2 className="text-lg font-black text-white tracking-tight">📜 শর্তাবলী</h2>
                    </div>

                    <div className="space-y-4 text-white/95 text-xs font-bold leading-relaxed max-h-[300px] overflow-y-auto pr-1 text-justify">
                        <p className="border-l-2 border-cyan-400 pl-2.5">১. প্রত্যেক নতুন শিক্ষার্থী রেজিস্ট্রেশনের পর স্বয়ংক্রিয়ভাবে ৩০ দিনের Premium Access পাবেন।</p>
                        <p className="border-l-2 border-indigo-400 pl-2.5">২. Premium সুবিধা বজায় রাখতে হলে প্রতিদিনের Mission নিয়মিত সম্পন্ন করে Submission করতে হবে।</p>
                        <p className="border-l-2 border-purple-400 pl-2.5">৩. যদি কোনো শিক্ষার্থী টানা ১০ দিন Mission Submission না করেন, তাহলে তিনি তার Premium Access হারাবেন।</p>
                        <div className="border-l-2 border-pink-400 pl-2.5 space-y-1">
                            <p>৪. Premium সুবিধা চালিয়ে যেতে চাইলে আপনি দুটি উপায়ে তা করতে পারবেন—</p>
                            <p className="pl-4 text-[11px] text-white/80 font-semibold">• Mission-এর নিয়ম মেনে ধারাবাহিকভাবে সক্রিয় থেকে।</p>
                            <p className="pl-4 text-[11px] text-white/80 font-semibold">• অথবা নির্ধারিত Premium Upgrade (Payment) গ্রহণ করে।</p>
                        </div>
                        <p className="border-l-2 border-amber-400 pl-2.5">৫. Mentor প্রয়োজন অনুযায়ী Premium প্রদান, বৃদ্ধি, পুনরায় চালু অথবা বাতিল করার সম্পূর্ণ অধিকার সংরক্ষণ করেন।</p>
                        <p className="border-l-2 border-emerald-400 pl-2.5">৬. Premium-এর মেয়াদ, কার্যক্রম এবং নিয়ম পালন সম্পূর্ণভাবে সিস্টেম দ্বারা স্বয়ংক্রিয়ভাবে পর্যবেক্ষণ করা হবে।</p>
                        <p className="border-l-2 border-teal-400 pl-2.5">৭. MissionGrid ব্যবহার করার মাধ্যমে আপনি উপরোক্ত সকল শর্তাবলী মেনে চলতে সম্মত হচ্ছেন।</p>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer select-none text-white/90 text-xs font-black leading-relaxed mt-4 bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
                        <input 
                            type="checkbox" 
                            id="terms-checkbox"
                            checked={acceptedTerms} 
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                        />
                        <span>আমি উপরোক্ত শর্তাবলী পড়েছি, বুঝেছি এবং মেনে নিতে সম্মত।</span>
                    </label>

                    <button 
                        type="button"
                        onClick={handleFinalSubmit}
                        disabled={loading || !acceptedTerms}
                        className="w-full py-4 bg-gradient-to-r from-cyan-400 to-indigo-500 text-white rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-2 hover:from-cyan-500 hover:to-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-indigo-500/20"
                    >
                        {loading ? 'Synchronizing Profiles...' : (
                            <>
                                <span>➡️ মিশনগ্রিডে প্রবেশ করুন</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </motion.div>
      </div>
    </div>
  );
}
