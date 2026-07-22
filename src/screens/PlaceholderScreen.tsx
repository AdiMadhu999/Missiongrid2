import React from 'react';
import { motion } from 'motion/react';

interface ScreenProps {
  title: string;
  description: string;
}

export default function PlaceholderScreen({ title, description }: ScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[60vh] max-w-xs mx-auto"
    >
      <div className="w-20 h-20 bg-primary-50 text-primary-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-primary-100">
        <span className="text-3xl font-bold font-sans">M</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-3">{title}</h2>
      <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
