import React, { useState, useRef } from 'react';
import type { User } from '../../models/user';
import {
  X,
  Camera,
  Lock,
  Trash2,
  Moon,
  Bell,
  Check,
  Loader2,
  LogOut,
  User as UserIcon,
  Settings,
} from 'lucide-react';
import { uploadProfileImage, deleteProfileImage } from '../../services/storage';
import { updateUserProfile } from '../../services/users';
import { useAuth } from '../../providers/AuthProvider';
import { updatePassword, deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface ProfileSettingsModalProps {
  userProfile: User;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProfileSettingsModal({
  userProfile,
  onClose,
  onSaved,
}: ProfileSettingsModalProps) {
  const { currentUser, logout, setUserProfile } = useAuth();
  const role = (userProfile?.role || '').toLowerCase();
  const isMentor = role === 'mentor' || role === 'primary-mentor' || role === 'staff' || role === 'admin' || role === 'examiner';

  const [activeTab, setActiveTab] = useState<
    'profile' | 'general' | 'security' | 'preferences'
  >('profile');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out from your session?')) {
      setLoading(true);
      try {
        await logout();
        onClose();
      } catch (err: any) {
        alert('Failed to sign out: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // General state
  const [photoUrl, setPhotoUrl] = useState(userProfile.photoUrl || '');
  const [name, setName] = useState(userProfile.name || '');
  const [email, setEmail] = useState(userProfile.email || '');
  const [dateOfBirth, setDateOfBirth] = useState(userProfile.dateOfBirth || '');
  const [gender, setGender] = useState(userProfile.gender || 'male');
  const [aboutMe, setAboutMe] = useState(userProfile.aboutMe || '');

  // Security state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Preferences State
  const [emailNotif, setEmailNotif] = useState(
    userProfile.notificationPreferences?.email ?? true,
  );
  const [appNotif, setAppNotif] = useState(
    userProfile.notificationPreferences?.app ?? true,
  );
  const [theme, setTheme] = useState(userProfile.themePreference || 'system');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setLoading(true);
    try {
      if (userProfile.photoUrl) {
        await deleteProfileImage(userProfile.photoUrl);
      }
      const url = await uploadProfileImage(
        userProfile.id || userProfile.mobile || 'user',
        file,
      );
      setPhotoUrl(url);
      await updateUserProfile(userProfile.id || userProfile.mobile!, {
        photoUrl: url,
      });
      userProfile.photoUrl = url; // optimistic update
    } catch (err: any) {
      alert('Failed to upload photo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = async () => {
    setLoading(true);
    try {
      if (photoUrl) {
        await deleteProfileImage(photoUrl);
      }
      setPhotoUrl('');
      await updateUserProfile(userProfile.id || userProfile.mobile!, {
        photoUrl: '',
      });
      userProfile.photoUrl = '';
    } catch (err: any) {
      alert('Failed to remove photo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await updateUserProfile(userProfile.id || userProfile.mobile!, {
        name,
        email,
        dateOfBirth,
        gender,
        aboutMe
      });
      const updatedProfile = { ...userProfile, name, email, dateOfBirth, gender, aboutMe };
      setUserProfile(updatedProfile);
      onSaved();
    } catch (err: any) {
      alert('Failed to save profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      await updateUserProfile(userProfile.id || userProfile.mobile!, {
        notificationPreferences: { email: emailNotif, app: appNotif },
        themePreference: theme as 'light' | 'dark' | 'system',
      });
      onSaved();
    } catch (err: any) {
      alert('Failed to save preferences: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return alert('PINs do not match');
    }
    if (!/^\d+$/.test(newPassword)) {
      return alert('PIN must be a number');
    }
    setLoading(true);
    try {
      await updateUserProfile(userProfile.id || userProfile.mobile!, {
        pin: newPassword,
      });
      const updatedProfile = { ...userProfile, pin: newPassword };
      setUserProfile(updatedProfile);
      alert('Security PIN updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert('Failed to update PIN: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.')) {
        return;
    }
    setLoading(true);
    try {
        if (currentUser) {
            await deleteDoc(doc(db, 'users', userProfile.id || userProfile.mobile!));
            await deleteUser(currentUser);
            onClose();
            logout();
        }
    } catch (err: any) {
        alert('Failed to delete account: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 ">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-900 text-lg tracking-tight">
            Settings
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-full transition-colors border border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 p-2 gap-2 bg-slate-50">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${activeTab === 'profile' ? 'bg-white shadow-sm text-primary-600 border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${activeTab === 'general' ? 'bg-white shadow-sm text-primary-600 border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${activeTab === 'security' ? 'bg-white shadow-sm text-primary-600 border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${activeTab === 'preferences' ? 'bg-white shadow-sm text-primary-600 border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Preferences
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Display Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">DOB</label>
                  <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full rounded-xl border-slate-200" />
                </div>
                 <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Gender</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="w-full rounded-xl border-slate-200">
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">About Me</label>
                <textarea rows={3} value={aboutMe} onChange={(e) => setAboutMe(e.target.value)} className="w-full rounded-xl border-slate-200" />
              </div>
              <button onClick={handleSaveProfile} disabled={loading} className="w-full py-3 bg-primary-600 text-white rounded-xl">Save Changes</button>
            </div>
          )}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-4">
                  Profile Photo
                </label>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-slate-100 border border-slate-200 overflow-hidden mt-1 flex items-center justify-center shrink-0">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    {loading && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-full">
                        <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="px-4 py-2 bg-primary-50 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-100 transition-colors flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" /> Change Photo
                    </button>
                    {photoUrl && (
                      <button
                        onClick={removePhoto}
                        disabled={loading}
                        className="px-4 py-2 bg-slate-50 text-rose-600 text-sm font-medium rounded-xl hover:bg-rose-50 transition-colors flex items-center gap-2 border border-slate-200"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <div className="px-4 py-3 bg-slate-50 rounded-xl text-slate-900 font-medium border border-slate-100">
                    {userProfile.name}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Name is locked. Contact mentor to change.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Role / Status
                  </label>
                  <div className="px-4 py-3 bg-slate-50 rounded-xl text-slate-900 font-medium capitalize border border-slate-100">
                    {userProfile.role} • {userProfile.status}
                  </div>
                </div>

                {/* Session Security Sign Out Action */}
                <div className="pt-4 border-t border-slate-200 mt-6">
                  <label className="block text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">
                    Session Safety
                  </label>
                  <button
                    onClick={handleLogout}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-xl font-bold text-xs transition-colors border border-dashed border-rose-200 flex items-center justify-center gap-2"
                    id="settings-logout-btn-general"
                    type="button"
                  >
                    <LogOut className="w-4 h-4" />
                    {loading ? 'Signing out...' : 'Sign Out of Session'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  New Security PIN
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter Security PIN (Number)"
                  className="w-full rounded-xl border-slate-200 focus:border-primary-500 focus:ring-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new PIN"
                  className="w-full rounded-xl border-slate-200 focus:border-primary-500 focus:ring-primary-500 transition-colors"
                />
              </div>
              <button
                disabled={loading || !newPassword}
                type="submit"
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                Update Security PIN
              </button>

              <div className="pt-6 border-t border-rose-100 mt-4">
                <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={loading}
                    className="w-full py-3 bg-rose-50 text-rose-700 rounded-xl font-bold text-sm hover:bg-rose-100 flex items-center justify-center gap-2 transition-colors border border-rose-100"
                >
                    <Trash2 className="w-4 h-4" /> Delete My Account
                </button>
              </div>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-8">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Bell className="w-4 h-4 text-slate-400" /> Notifications
                </h4>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium text-slate-700">
                      Email Updates
                    </span>
                    <input
                      type="checkbox"
                      className="rounded text-primary-600 focus:ring-primary-500 w-5 h-5 border-slate-300"
                      checked={emailNotif}
                      onChange={(e) => setEmailNotif(e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium text-slate-700">
                      In-App Alerts
                    </span>
                    <input
                      type="checkbox"
                      className="rounded text-primary-600 focus:ring-primary-500 w-5 h-5 border-slate-300"
                      checked={appNotif}
                      onChange={(e) => setAppNotif(e.target.checked)}
                    />
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Moon className="w-4 h-4 text-slate-400" /> Interface Theme
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {(['system', 'light', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`py-2 rounded-xl text-sm font-medium capitalize border transition-all ${theme === t ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {isMentor && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Settings className="w-4 h-4 text-slate-400" /> Developer Options
                  </h4>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">
                          Diagnostic Mode
                        </span>
                        <span className="text-xs text-slate-500">
                          Show raw mission data & logs on profile
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        className="rounded text-primary-600 focus:ring-primary-500 w-5 h-5 border-slate-300"
                        checked={localStorage.getItem('diagnostic_mode') === 'true'}
                        onChange={(e) => {
                          localStorage.setItem('diagnostic_mode', e.target.checked.toString());
                          // Force re-render to reflect the toggle state
                          setEmailNotif((prev) => prev);
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              <button
                onClick={handleSavePreferences}
                disabled={loading}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-500 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
