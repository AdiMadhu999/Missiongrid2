import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import appLogo from "../assets/images/app_logo_base_1783466372014.jpg";
import { motion } from 'motion/react';
import { useAuth } from '../providers/AuthProvider';
import { APP_VERSION, GIT_COMMIT } from '../version';

export default function Splash() {
  const navigate = useNavigate();
  const { userProfile, loading } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // Enforce a smaller duration for a returning user to meet the sub-1-second requirement
    const hasProfile = !!localStorage.getItem('user_profile');
    const delay = hasProfile ? 100 : 400;
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && minTimeElapsed) {
      if (userProfile && userProfile.status === 'active') {
        navigate('/app/home', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [loading, minTimeElapsed, userProfile, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-indigo-600 text-white overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <motion.div 
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-24 h-24 bg-white/10 border-2 border-white/30 rounded-[28px] p-1 mb-6 shadow-2xl shadow-indigo-950/40 flex items-center justify-center"
        >
          <div className="w-full h-full rounded-[24px] overflow-hidden">
            <img 
              src={appLogo} 
              alt="Mission Logo" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>
        <h1 className="text-3xl font-black tracking-tight drop-shadow-sm">MissionGrid</h1>
        <p className="text-indigo-200/70 text-[10px] font-bold tracking-[0.4em] uppercase mt-2">Adi Madhu Mentorship</p>
      </motion.div>
      <div className="absolute bottom-8 left-0 w-full text-center">
        <p className="text-[9px] text-white/40 font-mono tracking-widest">v{APP_VERSION} ({GIT_COMMIT})</p>
      </div>
    </div>
  );
}
