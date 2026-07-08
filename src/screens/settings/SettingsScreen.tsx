import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, User, Shield, Bell, Lock, Database, ArrowRight, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import AdminSettings from './AdminSettings';
import { APP_VERSION, GIT_COMMIT, BUILD_TIMESTAMP } from '../../version';

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { userProfile, logout } = useAuth();
  const role = (userProfile?.role || '').toLowerCase();
  const isMentor = role === 'mentor' || role === 'primary-mentor' || role === 'staff' || role === 'admin' || role === 'examiner';

  const [notifications, setNotifications] = useState({ daily: true, accountability: true, rank: false });

  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinMsg, setPinMsg] = useState('');

  const handlePinChange = async () => {
    if (!userProfile?.id || !newPin) return;
    setPinLoading(true);
    try {
        const { updateUserProfile } = await import('../../services/users');
        await updateUserProfile(userProfile.id || userProfile.mobile, { pin: newPin });
        setPinMsg('PIN updated successfully.');
        setTimeout(() => setShowPinModal(false), 2000);
    } catch (e) {
        setPinMsg('Update failed.');
    } finally {
        setPinLoading(false);
    }
  };

  const sections = [
    { id: 'account', title: 'Account Settings', icon: User, desc: 'Manage your profile and info' },
    { id: 'security', title: 'Security', icon: Lock, desc: 'Change PIN / Passcode', action: () => setShowPinModal(true) },
    { id: 'privacy', title: 'Privacy Settings', icon: Shield, desc: 'Manage your profile visibility' },
    { id: 'notifications', title: 'Notification Settings', icon: Bell, desc: 'Customize your alerts' },
    { id: 'data', title: 'Data & Storage', icon: Database, desc: 'View storage and personal records' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-32 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
           <ChevronLeft size={20} className="text-slate-600"/>
        </button>
        <h1 className="text-xl font-black text-slate-900">Settings</h1>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div 
            key={section.id} 
            onClick={section.action}
            className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between ${section.action ? 'cursor-pointer hover:bg-slate-50 active:scale-[0.98] transition-all' : ''}`}
          >
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <section.icon size={20} className="text-slate-600" />
                </div>
                <div>
                   <p className="font-bold text-slate-900">{section.title}</p>
                   <p className="text-[10px] text-slate-500">{section.desc}</p>
                </div>
             </div>
             <ArrowRight size={18} className="text-slate-400" />
          </div>
        ))}
      </div>
      
      {/* PIN Change Modal */}
      {showPinModal && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 space-y-6 animate-in slide-in-from-bottom-5 duration-300 shadow-2xl">
                    <div>
                        <h3 className="font-black text-xl text-slate-900">Security Credentials</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Access Point Update</p>
                    </div>

                    {pinMsg && <p className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-600">{pinMsg}</p>}

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">New 6-Digit PIN</label>
                        <input 
                            type="password" 
                            maxLength={6}
                            placeholder="••••••" 
                            value={newPin} 
                            onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                            className="w-full text-center text-2xl tracking-[1em] p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                    </div>

                    <button 
                        onClick={handlePinChange}
                        disabled={pinLoading || newPin.length < 4}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:shadow-xl transition-all disabled:opacity-50"
                    >
                        {pinLoading ? 'Updating Protocol...' : 'Confirm Update'}
                    </button>
                    
                    <button onClick={() => setShowPinModal(false)} className="w-full text-xs font-bold text-slate-400 py-2">Discard Changes</button>
              </div>
          </div>
      )}
      
      {/* Admin Settings Section */}
      {userProfile?.role === 'mentor' && <AdminSettings />}

      <div className="mt-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Notification Preferences</h3>
        {Object.entries(notifications).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center py-3 border-b last:border-0 border-slate-100">
                <span className="text-sm font-semibold text-slate-700 capitalize">{key}</span>
                <button 
                  onClick={() => setNotifications(prev => ({...prev, [key]: !value}))}
                  className={`w-10 h-6 rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
            </div>
        ))}
      </div>

      {isMentor && (
        <div className="mt-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
             <SettingsIcon size={18} className="text-slate-400" />
             Developer Options
          </h3>
          <div className="flex justify-between items-center py-3">
              <div>
                <span className="text-sm font-semibold text-slate-700 block">Diagnostic Mode</span>
                <span className="text-[10px] text-slate-500">Show raw mission data & logs on profile</span>
              </div>
              <button 
                onClick={() => {
                  const current = localStorage.getItem('diagnostic_mode') === 'true';
                  localStorage.setItem('diagnostic_mode', (!current).toString());
                  // Force state update to re-render
                  setNotifications(prev => ({...prev}));
                }}
                className={`w-10 h-6 rounded-full transition-colors ${localStorage.getItem('diagnostic_mode') === 'true' ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${localStorage.getItem('diagnostic_mode') === 'true' ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
          </div>
        </div>
      )}
      
      <button 
        onClick={logout}
        className="mt-8 w-full flex items-center justify-center gap-2 text-red-600 bg-white p-4 rounded-2xl border border-red-100 font-bold hover:bg-red-50 transition-all"
      >
        <LogOut size={18} />
        Log Out
      </button>

      <div className="mt-8 text-center px-4">
        <p className="text-[10px] text-slate-400 font-mono">App Version: {APP_VERSION}</p>
        <p className="text-[10px] text-slate-400 font-mono">Build: {GIT_COMMIT} | {BUILD_TIMESTAMP}</p>
      </div>
    </div>
  );
}
