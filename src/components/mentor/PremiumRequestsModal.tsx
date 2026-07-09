import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, XCircle, Search, Filter, Calendar, User, CheckCircle, Smartphone, Clock, AlertCircle } from 'lucide-react';
import { collection, query, getDocs, doc, getDoc, updateDoc, setDoc, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../providers/AuthProvider';
import toast from 'react-hot-toast';

interface PremiumRequestsModalProps {
  onClose: () => void;
  onRefreshStats?: () => void;
}

interface PremiumRequest {
  id: string;
  mobile: string;
  studentName: string;
  studentId: string;
  transactionId: string;
  timestamp: string;
  currentExpiry: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectReason?: string;
  approvedDays?: number;
  approvedAt?: string;
  planTitle?: string;
  pricePaid?: string;
}

export default function PremiumRequestsModal({ onClose, onRefreshStats }: PremiumRequestsModalProps) {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState<PremiumRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [search, setSearch] = useState('');
  
  // Detail / action modal states
  const [activeReq, setActiveReq] = useState<PremiumRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [durationPreset, setDurationPreset] = useState<'30' | '60' | '90' | 'custom'>('30');
  const [customDays, setCustomDays] = useState('30');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'premium_requests'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const items: PremiumRequest[] = [];
      snap.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as PremiumRequest);
      });
      setRequests(items);
    } catch (err) {
      console.error('Error fetching premium requests:', err);
      toast.error('Failed to load premium requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = requests.filter(req => {
    const matchesFilter = filter === 'All' || req.status === filter;
    const searchLower = search.trim().toLowerCase();
    const matchesSearch = 
      !searchLower || 
      (req.studentName || '').toLowerCase().includes(searchLower) ||
      (req.mobile || '').includes(searchLower) ||
      (req.transactionId || '').toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  const handleApprove = async () => {
    if (!activeReq) return;
    const days = durationPreset === 'custom' ? parseInt(customDays) : parseInt(durationPreset);
    if (isNaN(days) || days <= 0) {
      toast.error('Please specify a valid number of days.');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Approving request and updating student access...');
    try {
      // 1. Fetch user public profile
      const userDocRef = doc(db, 'users', activeReq.studentId);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        throw new Error('Student profile not found in database.');
      }

      const userData = userSnap.data();
      const currentExpiryStr = userData.premiumExpiryDate || '';
      let currentExpiryDate = new Date();

      // Check if user has premium already and is active
      const now = new Date();
      if (currentExpiryStr) {
        const exp = new Date(currentExpiryStr);
        if (exp > now) {
          currentExpiryDate = exp; // Extend from current expiration
        }
      }

      // Calculate new expiration date
      const newExpiryDate = new Date(currentExpiryDate.getTime());
      newExpiryDate.setDate(newExpiryDate.getDate() + days);

      // Remaining Premium Days calculations
      const diffTime = Math.max(0, newExpiryDate.getTime() - now.getTime());
      const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 2. Update Student User Document
      await updateDoc(userDocRef, {
        isPremium: true,
        premiumStatus: 'active',
        premiumExpiryDate: newExpiryDate.toISOString(),
        premiumStartDate: now.toISOString(),
        premiumType: 'MANUAL',
        remainingPremiumDays: remainingDays,
        testAccess: 'premium'
      });

      // 3. Update Premium Request Document
      const reqRef = doc(db, 'premium_requests', activeReq.id);
      await updateDoc(reqRef, {
        status: 'Approved',
        approvedAt: now.toISOString(),
        approvedBy: userProfile?.name || 'Mentor',
        approvedDays: days
      });

      // 4. Log to Premium History
      const historyRef = collection(db, 'premium_history');
      await addDoc(historyRef, {
        studentId: activeReq.studentId,
        studentName: activeReq.studentName,
        mobile: activeReq.mobile,
        changedBy: userProfile?.id || 'system',
        changedByName: userProfile?.name || 'Mentor',
        action: 'Granted Extension via Request',
        previousStatus: userData.isPremium ? 'PREMIUM' : 'FREE',
        newStatus: 'PREMIUM',
        durationDays: days,
        reason: `Approved UPI Request (Txn ID: ${activeReq.transactionId})`,
        timestamp: now.toISOString(),
        date: now.toLocaleDateString('en-IN'),
        time: now.toLocaleTimeString('en-IN')
      });

      toast.success(`Premium extended by ${days} days for ${activeReq.studentName}!`, { id: toastId });
      setActiveReq(null);
      setActionType(null);
      fetchRequests();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      console.error('Error approving premium:', err);
      toast.error(err.message || 'Approval failed. Please try again.', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!activeReq) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection.');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Rejecting request...');
    try {
      const now = new Date();
      
      // 1. Update request status to Rejected
      const reqRef = doc(db, 'premium_requests', activeReq.id);
      await updateDoc(reqRef, {
        status: 'Rejected',
        rejectedAt: now.toISOString(),
        rejectedBy: userProfile?.name || 'Mentor',
        rejectReason: rejectReason.trim()
      });

      toast.success('Request rejected successfully.', { id: toastId });
      setActiveReq(null);
      setActionType(null);
      setRejectReason('');
      fetchRequests();
    } catch (err) {
      console.error('Error rejecting premium request:', err);
      toast.error('Rejection failed.', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[85vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              👑 Student Premium Extension Requests
              {requests.filter(r => r.status === 'Pending').length > 0 && (
                <span className="bg-rose-500 text-white font-black text-[10px] px-2.5 py-1 rounded-full animate-pulse">
                  {requests.filter(r => r.status === 'Pending').length} Pending
                </span>
              )}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Review, approve, or reject student premium upgrade requests manually</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 sm:p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs group">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text"
              placeholder="Search by student, mobile, txn ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl py-3 pl-11 pr-4 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-300 transition-all"
            />
          </div>

          {/* Filter Segment */}
          <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 w-full sm:w-auto">
            {(['Pending', 'Approved', 'Rejected', 'All'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Request List / Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading ? (
            <div className="text-center py-20 text-xs font-black text-slate-400 animate-pulse uppercase tracking-widest">
              Accessing request vaults...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
              <Clock size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No matching requests found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRequests.map(req => (
                <motion.div
                  key={req.id}
                  layout
                  className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-xs hover:border-indigo-300 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                          {(req.studentName || 'S').charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{req.studentName}</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                            <Smartphone size={10} /> {req.mobile}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider ${
                        req.status === 'Pending' ? 'bg-amber-100 text-amber-800 border border-amber-200/50' :
                        req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/50' :
                        'bg-rose-100 text-rose-800 border border-rose-200/50'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2 text-[10px] font-semibold text-slate-500">
                      {req.planTitle && (
                        <div className="flex justify-between text-indigo-600 font-extrabold pb-1.5 border-b border-slate-200/40">
                          <span>Selected Plan:</span>
                          <span className="font-black text-indigo-750">{req.planTitle} ({req.pricePaid || 'Paid'})</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Transaction ID:</span>
                        <span className="font-mono font-black text-slate-800">{req.transactionId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Submitted At:</span>
                        <span className="font-extrabold text-slate-700">{new Date(req.timestamp).toLocaleString('en-IN', { hour12: true })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Current Expiry:</span>
                        <span className="font-extrabold text-slate-700">
                          {req.currentExpiry && req.currentExpiry !== 'None' 
                            ? new Date(req.currentExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Not Expired / Active'
                          }
                        </span>
                      </div>
                      {req.status === 'Approved' && req.approvedDays && (
                        <div className="border-t border-slate-200 pt-2 flex justify-between text-emerald-700">
                          <span>Extension Duration:</span>
                          <span className="font-black">+{req.approvedDays} Days</span>
                        </div>
                      )}
                      {req.status === 'Rejected' && req.rejectReason && (
                        <div className="border-t border-slate-200 pt-2 text-rose-700">
                          <span className="block font-black uppercase text-[8px] tracking-wider mb-1">Rejection Reason:</span>
                          <p className="italic font-bold">"{req.rejectReason}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {req.status === 'Pending' && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setActiveReq(req);
                          setActionType('reject');
                        }}
                        className="flex-1 py-2 rounded-xl text-[10px] font-black text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all uppercase tracking-wider flex items-center justify-center gap-1"
                      >
                        <XCircle size={12} />
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setActiveReq(req);
                          setActionType('approve');
                        }}
                        className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black transition-all uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Check size={12} />
                        Verify & Approve
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Action / Overlay confirmation dialog */}
        <AnimatePresence>
          {activeReq && actionType && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 border border-slate-100 space-y-5"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-slate-950 text-sm uppercase tracking-wider">
                    {actionType === 'approve' ? 'Approve Premium Extension' : 'Reject Premium Request'}
                  </h4>
                  <button onClick={() => { setActiveReq(null); setActionType(null); }} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                    Student: <span className="font-extrabold text-slate-800">{activeReq.studentName}</span> ({activeReq.mobile}) <br />
                    {activeReq.planTitle && (
                      <>
                        Selected Plan: <span className="font-extrabold text-indigo-600">{activeReq.planTitle} ({activeReq.pricePaid})</span> <br />
                      </>
                    )}
                    UPI ID Reference / Transaction: <span className="font-mono font-black text-slate-800">{activeReq.transactionId}</span>
                  </p>

                  {actionType === 'approve' ? (
                    <div className="space-y-3.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Choose Extension Period
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['30', '60', '90'] as const).map(d => (
                          <button
                            type="button"
                            key={d}
                            onClick={() => setDurationPreset(d)}
                            className={`py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                              durationPreset === d 
                                ? 'bg-indigo-650 text-white border-indigo-650' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {d} Days
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setDurationPreset('custom')}
                          className={`col-span-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                            durationPreset === 'custom' 
                              ? 'bg-indigo-650 text-white border-indigo-650' 
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Custom Duration
                        </button>
                      </div>

                      {durationPreset === 'custom' && (
                        <div className="pt-2 animate-fadeIn">
                          <label className="block text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1 pl-1">
                            Enter Custom Days
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={customDays}
                            onChange={(e) => setCustomDays(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-indigo-100 rounded-xl p-3 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 transition-all"
                            placeholder="e.g. 45"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        Reason for Rejection
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason (e.g., Transaction ID invalid or price mismatched...)"
                        rows={3}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 transition-all leading-relaxed"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { setActiveReq(null); setActionType(null); }}
                    disabled={submitting}
                    className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-black text-slate-500 uppercase tracking-wider transition-all hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  {actionType === 'approve' ? (
                    <button
                      onClick={handleApprove}
                      disabled={submitting}
                      className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check size={14} />
                      Approve & Grant
                    </button>
                  ) : (
                    <button
                      onClick={handleReject}
                      disabled={submitting}
                      className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={14} />
                      Reject Request
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
