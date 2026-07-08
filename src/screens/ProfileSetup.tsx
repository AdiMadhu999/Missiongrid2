import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../providers/AuthProvider';
import { updateUserProfile } from '../services/users';
import { toast } from 'react-hot-toast';

export const ProfileSetup: React.FC = () => {
  const { userProfile, setUserProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(userProfile?.name || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.id) return;

    if (!name.trim() || !password.trim()) {
      toast.error('All fields are mandatory.');
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile(userProfile.id, {
        name,
        isProfileCompleted: true,
      });
      // In a real app, you would also update the password in a secure way (using Firebase Auth updatePassword)
      // For this prototype, we'll just update the Firestore document
      
      setUserProfile({ ...userProfile, name, isProfileCompleted: true });
      toast.success('Profile setup complete!');
      const userRole = (userProfile.role || '').toLowerCase();
      const isMentor = userRole === 'mentor' || userRole === 'primary-mentor' || userRole === 'staff' || userRole === 'admin' || userRole === 'examiner';
      navigate(isMentor ? '/app/home' : '/app/doubt');
    } catch (err) {
      toast.error('Failed to complete profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border border-slate-100"
      >
        <h2 className="text-2xl font-black text-slate-900 mb-6">Complete Your Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-slate-100 rounded-xl outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-slate-100 rounded-xl outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs hover:bg-indigo-700"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
