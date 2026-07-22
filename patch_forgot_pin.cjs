const fs = require('fs');

const code = `import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export default function ForgotPin() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden bg-gradient-to-tr from-sky-400 via-indigo-200 to-amber-100 p-4">
      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/90 p-8 rounded-3xl shadow-2xl border border-white/50 text-center"
        >
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center">
              <ShieldAlert size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-black text-indigo-950 mb-2">Forgot PIN?</h2>
          <p className="text-sm font-bold text-slate-600 mb-8 leading-relaxed">
            For security reasons, your 6-Digit Security PIN cannot be reset via SMS. 
            <br/><br/>
            Please contact your <span className="text-indigo-600">Mentor or Administrator</span> to request a PIN reset.
          </p>
          
          <button 
            onClick={() => navigate('/login')} 
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft size={18} /> Return to Login
          </button>
        </motion.div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/screens/ForgotPin.tsx', code);
console.log("Patched ForgotPin.tsx");
