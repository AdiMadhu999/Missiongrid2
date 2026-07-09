import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { User } from '../../models/user';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  student: User;
  onUpdate: (data: any) => Promise<void>;
}

export default function PremiumManagerModal({ isOpen, onClose, student, onUpdate }: Props) {
  const [newStatus, setNewStatus] = useState<'PREMIUM' | 'FREE'>(
    (student.premiumStatus === 'active' || student.premiumStatus === 'PREMIUM') ? 'PREMIUM' : 'FREE'
  );
  const [newExpiry, setNewExpiry] = useState(student.premiumExpiryDate?.split('T')[0] || '');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onUpdate({
        newStatus,
        newExpiry,
        reason,
        previousStatus: student.premiumStatus,
        previousExpiry: student.premiumExpiryDate
      });
      onClose();
    } catch (err) {
      alert("Failed to update premium");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Manage Premium: {student.name}</h2>
              <button onClick={onClose} className="p-2 bg-slate-100 rounded-full">
                 <X size={20} />
              </button>
            </div>
            
            <div className="mb-6 p-4 bg-slate-50 rounded-xl space-y-2 text-sm">
                <p><strong>Current Status:</strong> {student.premiumStatus}</p>
                <p><strong>Expiry:</strong> {student.premiumExpiryDate?.split('T')[0] || 'N/A'}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                <select 
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as 'PREMIUM' | 'FREE')}
                >
                  <option value="FREE">FREE</option>
                  <option value="PREMIUM">PREMIUM</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expiry Date</label>
                <input 
                  type="date"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                  value={newExpiry}
                  onChange={e => setNewExpiry(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason for Change</label>
                <textarea
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Enter reason..."
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold"
              >
                {loading ? 'Updating...' : 'Save Changes'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
