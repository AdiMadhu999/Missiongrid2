import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Crown, Sparkles, Check, ArrowRight, Home, CreditCard, Clock, CheckCircle, ChevronDown, Copy, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useSystemSettings } from '../../hooks/useSystemSettings';

interface PremiumUpgradeScreenProps {
  featureName?: string;
  onClose?: () => void;
}

interface PaymentOption {
  id: string;
  title: string;
  price: string;
  upiId: string;
  instructions: string;
}

export const PremiumUpgradeScreen: React.FC<PremiumUpgradeScreenProps> = ({ featureName, onClose }) => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { data: systemSettings } = useSystemSettings();

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Available plans and currently selected plan
  const [plans, setPlans] = useState<PaymentOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PaymentOption | null>(null);
  
  const [pendingReq, setPendingReq] = useState<any>(null);
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile?.id) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Fetch custom payment options from collection
        const qOptions = query(collection(db, 'payment_options'), orderBy('price', 'asc'));
        const snapOptions = await getDocs(qOptions);
        const optionsList: PaymentOption[] = [];
        
        snapOptions.forEach(d => {
          optionsList.push({ id: d.id, ...d.data() } as PaymentOption);
        });

        // Fallback option if mentor hasn't created any custom plans
        if (optionsList.length === 0) {
          optionsList.push({
            id: 'default',
            title: '30 Days Premium Membership',
            price: '₹299',
            upiId: 'missionselectionofficial999@okaxis',
            instructions: 'পেমেন্ট করার পর ১২ সংখ্যার UPI Transaction ID (Ref No) নিচে দিন এবং Submit Request বাটনে ক্লিক করুন। মেন্টর যাচাই করে আপনার অ্যাকাউন্ট প্রিমিয়াম করে দেবেন।'
          });
        }

        setPlans(optionsList);
        setSelectedPlan(optionsList[0]);

        // 2. Query for pending requests
        const qReq = query(
          collection(db, 'premium_requests'),
          where('studentId', '==', userProfile.id),
          where('status', '==', 'Pending')
        );
        const snapReq = await getDocs(qReq);
        if (!snapReq.empty) {
          setPendingReq({ id: snapReq.docs[0].id, ...snapReq.docs[0].data() });
        } else {
          setPendingReq(null);
        }
      } catch (err) {
        console.error('Error fetching student premium data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userProfile?.id]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId.trim()) {
      toast.error('Please enter a valid Transaction ID.');
      return;
    }
    if (!selectedPlan) {
      toast.error('Please select a payment package.');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Submitting payment verification request...');
    try {
      const now = new Date();
      const requestData = {
        studentId: userProfile.id,
        studentName: userProfile.name || 'Anonymous Student',
        mobile: userProfile.mobile || 'N/A',
        transactionId: transactionId.trim(),
        timestamp: now.toISOString(),
        currentExpiry: userProfile.premiumExpiryDate || 'None',
        status: 'Pending',
        planId: selectedPlan.id,
        planTitle: selectedPlan.title,
        pricePaid: selectedPlan.price
      };

      const docRef = await addDoc(collection(db, 'premium_requests'), requestData);
      setPendingReq({ id: docRef.id, ...requestData });
      toast.success('Premium extension request submitted successfully!', { id: toastId });
      setTransactionId('');
    } catch (err) {
      console.error('Error submitting request:', err);
      toast.error('Submission failed. Please try again.', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueFree = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/app');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] w-full px-4 py-12 font-sans bg-slate-50">
        <div className="text-center text-xs font-black text-slate-400 animate-pulse uppercase tracking-widest">
          SYNCING PREMIUM GATEWAY...
        </div>
      </div>
    );
  }

  if (systemSettings && systemSettings.premiumGatewayEnabled === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] w-full px-4 py-12 font-sans bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl border border-slate-200 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4 shadow-lg mx-auto border border-rose-100">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            ⚠️ Premium Gateway Offline
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">
            মেন্টর বর্তমানে প্রিমিয়াম পেমেন্ট গেটওয়ে বন্ধ রেখেছেন। প্রয়োজনে আপনার মেন্টরের সাথে সরাসরি যোগাযোগ করুন।
          </p>
          
          <button
            onClick={handleContinueFree}
            className="w-full mt-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-97"
          >
            <Home size={14} />
            <span>Return to Dashboard</span>
          </button>
        </motion.div>
      </div>
    );
  }

  if (pendingReq) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] w-full px-4 py-12 font-sans bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl border border-slate-200 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col items-center text-center mb-8 relative z-10">
            <div className="w-16 h-16 rounded-[1.5rem] bg-amber-50 text-amber-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/5 border border-amber-200/50">
              <Clock className="w-8 h-8 animate-spin-slow" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              ⏳ Request Pending Approval
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-2">
              আপনার পেমেন্ট অনুরোধটি সফলভাবে জমা হয়েছে এবং মেন্টর দ্বারা যাচাইকরণের অপেক্ষায় রয়েছে।
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/60 mb-6 space-y-3.5 text-xs font-semibold text-slate-600 relative z-10">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/50">
              <span>Student Name</span>
              <span className="font-extrabold text-slate-800">{pendingReq.studentName}</span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/50">
              <span>Selected Package</span>
              <span className="font-extrabold text-indigo-600">{pendingReq.planTitle || 'Premium Access'} ({pendingReq.pricePaid || 'Paid'})</span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/50">
              <span>Mobile Number</span>
              <span className="font-extrabold text-slate-800">{pendingReq.mobile}</span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/50">
              <span>Transaction ID</span>
              <span className="font-mono font-black text-indigo-650">{pendingReq.transactionId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Submitted At</span>
              <span className="font-extrabold text-slate-800">
                {new Date(pendingReq.timestamp).toLocaleString('en-IN', { hour12: true })}
              </span>
            </div>
          </div>

          <div className="p-4.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-xs font-bold text-indigo-900/90 leading-relaxed mb-6">
            <p>আপনার পেমেন্টটি ১২ থেকে ২৪ ঘণ্টার মধ্যে যাচাই করে আপনার প্রিমিয়াম সুবিধা সক্রিয় করে দেওয়া হবে। কোনো সমস্যা হলে আপনার মেন্টরের সাথে যোগাযোগ করুন। ধন্যবাদ!</p>
          </div>

          <button
            onClick={handleContinueFree}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-97"
          >
            <Home size={14} />
            <span>Return to Dashboard</span>
          </button>
        </motion.div>
      </div>
    );
  }

  if (showRequestForm && selectedPlan) {
    const upiUri = `upi://pay?pa=${selectedPlan.upiId}&pn=Mission%20Selection&am=${selectedPlan.price.replace(/[^0-9]/g, '')}&cu=INR`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] w-full px-4 py-12 font-sans bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl border border-slate-200 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white flex items-center justify-center mb-3.5 shadow-md shadow-indigo-500/10">
              <CreditCard className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              💳 Premium Upgrade Portal
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Select a package, complete payment, and submit reference details.
            </p>
          </div>

          {/* Package Selector */}
          {plans.length > 1 && (
            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">
                Choose Subscription Plan
              </label>
              <div className="grid grid-cols-1 gap-2">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all flex justify-between items-center ${
                      selectedPlan.id === plan.id 
                        ? 'bg-indigo-50/50 border-indigo-500 shadow-xs' 
                        : 'bg-white border-slate-150 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs">{plan.title}</h4>
                      <p className="text-[10px] text-slate-450 font-semibold mt-0.5 leading-relaxed truncate max-w-[200px]">UPI: {plan.upiId}</p>
                    </div>
                    <span className="text-sm font-black text-indigo-600 bg-white px-3 py-1.5 rounded-xl border border-indigo-100 shadow-3xs">{plan.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Plan Details Info Block */}
          <div className="bg-indigo-50/60 border border-indigo-100/60 p-4.5 rounded-2xl text-center mb-6">
            <span className="text-[10px] font-black text-indigo-650 uppercase tracking-widest block mb-1">Membership Price ({selectedPlan.title})</span>
            <span className="text-3xl font-black text-indigo-950">{selectedPlan.price}</span>
          </div>

          {/* QR Code Scan Section */}
          <div className="flex flex-col items-center bg-slate-50/80 p-5 rounded-3xl border border-slate-200/50 mb-6">
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs mb-3">
              <img src={qrCodeUrl} alt="Payment UPI QR" className="w-40 h-40 object-contain mx-auto" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-black text-slate-800">Scan QR Code using any UPI App</p>
              <p className="text-[10px] font-bold text-slate-400">GPay, PhonePe, Paytm, BHIM</p>
            </div>

            <div className="mt-4 w-full bg-white p-3.5 rounded-2xl border border-slate-150 flex items-center justify-between text-xs font-bold text-slate-700">
              <div className="truncate pr-2">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">UPI ID</span>
                <span className="font-mono text-slate-800 font-extrabold truncate block max-w-full">{selectedPlan.upiId}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(selectedPlan.upiId);
                  toast.success('UPI ID copied to clipboard!');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all shrink-0 flex items-center gap-1 active:scale-95"
              >
                <Copy size={10} />
                Copy
              </button>
            </div>
          </div>

          {/* Bengali Instructions */}
          <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100/50 mb-6 text-xs text-amber-950 font-semibold leading-relaxed text-justify">
            <p className="font-black text-amber-900 mb-1 flex items-center gap-1">📌 পেমেন্ট নির্দেশাবলী:</p>
            <p>{selectedPlan.instructions}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                Enter UPI Transaction ID (Ref No)
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={e => setTransactionId(e.target.value)}
                placeholder="১২ সংখ্যার Transaction ID বা Ref No দিন"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 transition-all font-mono"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                disabled={submitting}
                className="flex-1 py-3.5 border-2 border-slate-100 hover:bg-slate-50 text-slate-500 font-black text-xs uppercase tracking-wider rounded-2xl transition-all"
              >
                Go Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>Submit Request</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] w-full px-4 py-12 font-sans bg-slate-50">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl border border-slate-200 relative overflow-hidden"
      >
        {/* Ambient background blur */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Block */}
        <div className="flex flex-col items-center text-center mb-8 relative z-10">
          <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-amber-400 to-amber-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20 animate-bounce-slow">
            <Crown className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 justify-center">
            👑 MissionGrid Premium
          </h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Unlock your full preparation experience.
          </p>
        </div>

        {/* Status Section */}
        <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200/60 mb-6 relative z-10">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Current Status</span>
            <span className="text-sm font-extrabold text-slate-800">Free Account</span>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Premium Status</span>
            <span className="text-sm font-extrabold text-rose-600">Inactive</span>
          </div>
          <div className="col-span-2 pt-3 border-t border-slate-200/60">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reason</span>
            <ul className="text-xs font-bold text-slate-600 space-y-1">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Premium expired
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Premium lost due to inactivity
              </li>
            </ul>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="mb-8 relative z-10">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-4">Premium Benefits</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Daily Mission Submission',
              'Mentor Evaluation',
              'Premium Tests',
              'Premium Study Resources',
              'Premium Community Access',
              'All Future Premium Features'
            ].map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-2.5 bg-white border border-slate-100 p-3 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                <span className="text-emerald-500 font-extrabold text-sm">✅</span>
                <span className="text-xs font-black text-slate-800">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* How to Continue Bangla section */}
        <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100 mb-6 relative z-10 text-justify">
          <p className="text-xs font-extrabold text-amber-900 mb-2">
            আপনি Premium সুবিধা পুনরায় চালু করতে পারবেন দুটি উপায়ে—
          </p>
          <div className="space-y-1.5 text-xs font-bold text-amber-850 leading-relaxed">
            <p className="pl-1">১. Mission-এর নিয়ম মেনে ধারাবাহিকভাবে সক্রিয় থেকে (যদি প্রযোজ্য হয়)।</p>
            <p className="pl-1">২. Premium Upgrade (Payment) গ্রহণ করে।</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 relative z-10">
          <button
            onClick={() => setShowRequestForm(true)}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/10 transition-all flex items-center justify-center gap-2 active:scale-97"
          >
            <CreditCard size={16} />
            <span>💳 Request Premium Extension</span>
          </button>

          <button
            onClick={handleContinueFree}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-97"
          >
            <Home size={14} />
            <span>🏠 Continue with Free Version</span>
          </button>
        </div>

        {/* Mentor note at bottom */}
        <div className="mt-8 pt-6 border-t border-slate-150 text-center relative z-10">
          <p className="text-[11px] font-black text-slate-500">
            Premium সংক্রান্ত যেকোনো সমস্যার জন্য আপনার Mentor-এর সাথে যোগাযোগ করুন।
          </p>
        </div>
      </motion.div>
    </div>
  );
};
