import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: string) => Promise<void>;
  missionDate: string;
}

export const MissionFeedbackModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, missionDate }) => {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      toast.error('Please enter your feedback.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(feedback);
      toast.success('Feedback submitted!');
      setFeedback('');
      onClose();
    } catch (e) {
      toast.error('Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 15 }}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-100"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Mission Feedback</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{missionDate}</p>
              </div>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Leave notes or feedback for your mentor about this mission..."
              className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 mb-4"
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all"
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
