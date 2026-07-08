import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { PremiumUpgradeScreen } from './student/PremiumUpgradeScreen';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose, featureName }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 -xs overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar rounded-[2.5rem] bg-white shadow-2xl"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-all z-[110]"
            >
              <X size={18} className="stroke-[2.5]" />
            </button>

            <PremiumUpgradeScreen 
              featureName={featureName} 
              onClose={onClose} 
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
