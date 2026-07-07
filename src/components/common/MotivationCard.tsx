import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Quote } from 'lucide-react';
import { MOTIVATIONAL_QUOTES } from '../../data/quotes';

export const MotivationCard: React.FC = () => {
  const [quote, setQuote] = useState('');

  useEffect(() => {
    // Pick a quote based on the current day to ensure it rotates daily
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const index = dayOfYear % MOTIVATIONAL_QUOTES.length;
    setQuote(MOTIVATIONAL_QUOTES[index]);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-indigo-950 p-6 rounded-[2rem] border border-indigo-900 shadow-xl overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
      
      <div className="flex items-start gap-4">
        <div className="bg-indigo-800 p-3 rounded-2xl shrink-0">
          <Quote size={20} className="text-indigo-300" />
        </div>
        <div>
          <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Daily Motivation</h3>
          <AnimatePresence mode="wait">
            <motion.p
              key={quote}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm font-medium text-indigo-100 leading-snug"
            >
              "{quote}"
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
