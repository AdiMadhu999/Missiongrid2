import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Edit2, Trash2, Save, DollarSign, QrCode, FileText, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import toast from 'react-hot-toast';

interface PremiumPaymentSetupModalProps {
  onClose: () => void;
}

interface PaymentOption {
  id: string;
  title: string;
  price: string;
  upiId: string;
  instructions: string;
  timestamp?: string;
}

export default function PremiumPaymentSetupModal({ onClose }: PremiumPaymentSetupModalProps) {
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOption, setEditingOption] = useState<PaymentOption | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('₹299');
  const [upiId, setUpiId] = useState('missionselectionofficial999@okaxis');
  const [instructions, setInstructions] = useState(
    'পেমেন্ট করার পর ১২ সংখ্যার UPI Transaction ID (Ref No) নিচে দিন এবং Submit Request বাটনে ক্লিক করুন। মেন্টর যাচাই করে আপনার অ্যাকাউন্ট প্রিমিয়াম করে দেবেন।'
  );
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'payment_options'), orderBy('price', 'asc'));
      const snap = await getDocs(q);
      const items: PaymentOption[] = [];
      snap.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as PaymentOption);
      });
      setOptions(items);
    } catch (err) {
      console.error('Error fetching payment options:', err);
      toast.error('Failed to load payment options.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const handleOpenCreate = () => {
    setEditingOption(null);
    setTitle('');
    setPrice('₹299');
    setUpiId('missionselectionofficial999@okaxis');
    setInstructions(
      'পেমেন্ট করার পর ১২ সংখ্যার UPI Transaction ID (Ref No) নিচে দিন এবং Submit Request বাটনে ক্লিক করুন। মেন্টর যাচাই করে আপনার অ্যাকাউন্ট প্রিমিয়াম করে দেবেন।'
    );
    setShowForm(true);
  };

  const handleOpenEdit = (option: PaymentOption) => {
    setEditingOption(option);
    setTitle(option.title);
    setPrice(option.price);
    setUpiId(option.upiId);
    setInstructions(option.instructions);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete payment option "${name}"?`)) {
      return;
    }
    setDeletingId(id);
    const toastId = toast.loading(`Deleting payment option "${name}"...`);
    try {
      await deleteDoc(doc(db, 'payment_options', id));
      toast.success('Payment option deleted successfully!', { id: toastId });
      fetchOptions();
    } catch (err) {
      console.error('Error deleting option:', err);
      toast.error('Failed to delete payment option.', { id: toastId });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !price.trim() || !upiId.trim() || !instructions.trim()) {
      toast.error('All fields are required.');
      return;
    }

    setSaving(true);
    const toastId = toast.loading(editingOption ? 'Updating payment option...' : 'Creating payment option...');
    try {
      const payload = {
        title: title.trim(),
        price: price.trim(),
        upiId: upiId.trim(),
        instructions: instructions.trim(),
        timestamp: new Date().toISOString()
      };

      if (editingOption) {
        await updateDoc(doc(db, 'payment_options', editingOption.id), payload);
        toast.success('Payment option updated successfully!', { id: toastId });
      } else {
        await addDoc(collection(db, 'payment_options'), payload);
        toast.success('New payment option created successfully!', { id: toastId });
      }

      setShowForm(false);
      fetchOptions();
    } catch (err) {
      console.error('Error saving option:', err);
      toast.error('Failed to save payment option.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const previewUpiUri = `upi://pay?pa=${upiId}&pn=Mission%20Selection&am=${price.replace(/[^0-9]/g, '')}&cu=INR`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(previewUpiUri)}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[85vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <DollarSign size={20} className="text-indigo-600" />
              Manage Premium Payment Options
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              {showForm ? 'Configure UPI Details & Instructions' : 'Create, edit, or delete student subscription plans'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs font-black text-slate-400 animate-pulse">
            LOADING PAYMENT PLATFORMS...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-slate-50/50 flex flex-col">
            <AnimatePresence mode="wait">
              {!showForm ? (
                <motion.div 
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6 flex-1 space-y-6 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-1">
                        Active Packages ({options.length})
                      </h4>
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-97"
                      >
                        <Plus size={14} />
                        Add New Option
                      </button>
                    </div>

                    {options.length === 0 ? (
                      <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-6">
                        <AlertCircle size={36} className="mx-auto text-slate-350 mb-3" />
                        <p className="text-slate-800 font-extrabold text-sm mb-1">No payment options configured yet</p>
                        <p className="text-slate-400 text-xs font-medium max-w-sm mx-auto mb-5">
                          Add your first subscription option (UPI ID and Pricing) so students can request upgrades.
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenCreate}
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                        >
                          Create Option
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {options.map(option => (
                          <div 
                            key={option.id}
                            className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-xs hover:border-indigo-300 transition-colors flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h5 className="font-extrabold text-slate-900 text-sm">{option.title}</h5>
                                  <span className="text-xs font-black text-indigo-600 mt-1 block">{option.price}</span>
                                </div>
                                <span className="bg-emerald-50 text-emerald-800 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-200/40">
                                  Active
                                </span>
                              </div>

                              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-[10px] font-semibold text-slate-500 space-y-1.5 font-mono">
                                <div className="flex justify-between">
                                  <span>UPI:</span>
                                  <span className="text-slate-800 font-black truncate max-w-[150px]">{option.upiId}</span>
                                </div>
                                <div className="flex justify-between items-start">
                                  <span className="shrink-0">Notes:</span>
                                  <span className="text-slate-600 font-sans font-medium line-clamp-2 text-right pl-3 leading-relaxed">
                                    {option.instructions}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleDelete(option.id, option.title)}
                                disabled={deletingId === option.id}
                                className="flex-1 py-2 rounded-xl text-[10px] font-black text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all uppercase tracking-wider flex items-center justify-center gap-1 active:scale-97"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(option)}
                                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider flex items-center justify-center gap-1 active:scale-97"
                              >
                                <Edit2 size={12} />
                                Edit
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-3 border-2 border-slate-100 hover:bg-slate-50 text-slate-600 font-black text-xs uppercase tracking-wider rounded-2xl transition-all"
                    >
                      Close Manager
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSave} 
                  className="p-6 space-y-5"
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      {editingOption ? 'Edit Payment Option' : 'Create New Payment Option'}
                    </h4>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                      Option / Plan Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. 30 Days Premium Membership, 3-Month Combo"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 transition-all"
                      required
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                      Plan Price (e.g. ₹299, ₹499)
                    </label>
                    <input
                      type="text"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g. ₹299"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 transition-all"
                      required
                    />
                  </div>

                  {/* UPI ID */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                      UPI ID for Payment Receiving
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. paymentid@okaxis"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 transition-all font-mono"
                      required
                    />
                  </div>

                  {/* Instructions */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                      Payment Instructions (English / Bengali)
                    </label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Enter details on how the student can pay and verify..."
                      rows={4}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all leading-relaxed"
                      required
                    />
                  </div>

                  {/* Live QR Preview */}
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col sm:flex-row items-center gap-4">
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200/60 flex-shrink-0">
                      <img src={qrCodeUrl} alt="UPI QR Code" className="w-24 h-24 object-contain" onError={(e)=>{(e.target as any).style.display='none'}} />
                    </div>
                    <div className="space-y-1">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[8px] font-black bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                        Live Dynamic QR
                      </span>
                      <p className="text-xs font-black text-slate-800">Dynamic Payment QR Code</p>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                        The student app generates scan-to-pay QR codes corresponding to this UPI ID and plan's pricing instantly.
                      </p>
                    </div>
                  </div>

                  {/* Footer Buttons */}
                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      disabled={saving}
                      className="flex-1 py-3.5 border-2 border-slate-100 hover:bg-slate-50 text-slate-500 font-black text-xs uppercase tracking-wider rounded-2xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-3.5 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-150 transition-all flex items-center justify-center gap-2"
                    >
                      <Save size={14} />
                      <span>{editingOption ? 'Update Option' : 'Save Option'}</span>
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
