import React from 'react';
import { Flame } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  streak: number;
}

export const DailyStreakWidget: React.FC<Props> = ({ streak }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-orange-50 p-4 rounded-3xl border border-orange-100 flex items-center justify-between shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
          <Flame size={20} />
        </div>
        <div>
          <p className="text-[10px] font-black text-orange-900 uppercase tracking-widest">Daily Streak</p>
          <p className="text-sm font-bold text-orange-700">{streak} Days</p>
        </div>
      </div>
      <div className="text-[10px] font-bold text-orange-400 bg-orange-100/50 px-2 py-1 rounded-full uppercase">
        Active
      </div>
    </motion.div>
  );
};
