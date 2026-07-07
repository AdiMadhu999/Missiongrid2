import React from 'react';
import { motion } from 'motion/react';
import { Crown, Sparkles, Check, ArrowRight, Home, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';

interface PremiumUpgradeScreenProps {
  featureName?: string;
  onClose?: () => void;
}

export const PremiumUpgradeScreen: React.FC<PremiumUpgradeScreenProps> = ({ featureName, onClose }) => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const handleUpgradePayment = () => {
    // Show premium upgrade instruction / payment handler
    const mentorName = userProfile?.mentorName || 'Primary Mentor';
    const mentorMobile = userProfile?.mentorMobile || '';
    
    let infoMsg = `To upgrade to Premium, please contact your designated Mentor.\n\n`;
    if (userProfile?.mentorName) {
      infoMsg += `Mentor Name: ${mentorName}\n`;
    }
    if (mentorMobile) {
      infoMsg += `Mobile/WhatsApp: ${mentorMobile}\n`;
    }
    infoMsg += `\nThey will provide the payment procedure and instantly activate your account.`;
    alert(infoMsg);
  };

  const handleContinueFree = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/app');
    }
  };

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
          <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-amber-400 to-amber-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
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
                • Premium expired
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                • Premium lost due to inactivity
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
            onClick={handleUpgradePayment}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/10 transition-all flex items-center justify-center gap-2 active:scale-97"
          >
            <CreditCard size={16} />
            <span>💳 Upgrade Premium</span>
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
