import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Shield, Link2, Eye, EyeOff, Save, 
  Settings, Users, Sparkles, Megaphone, HelpCircle, 
  FileText, Activity, AlertCircle, TrendingUp, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { logAuditAction } from '../../services/system';

interface GlobalCommunityConfig {
  communityName: string;
  communityDescription: string;
  communityStatus: 'Active' | 'Disabled';
  officialGroupLink: string;
  discussionGroupLink: string;
  showCommunityCard: boolean;
  showOfficialGroup: boolean;
  showDiscussionGroup: boolean;
  totalClicks: number;
  totalAttempts: number;
  lastUpdated: string;
}

interface PremiumCommunityConfig {
  premiumGroupLink: string;
  showPremiumGroup: boolean;
  lastUpdated: string;
}

const DEFAULT_GLOBAL: GlobalCommunityConfig = {
  communityName: "Mission Selection Base Channel",
  communityDescription: "Connect with fellow Mission Selection aspirants, participate in discussions, receive updates, ask doubts, and stay accountable throughout your preparation journey.",
  communityStatus: "Active",
  officialGroupLink: "https://groupme.com/join_official_placeholder",
  discussionGroupLink: "https://groupme.com/join_discussion_placeholder",
  showCommunityCard: true,
  showOfficialGroup: true,
  showDiscussionGroup: true,
  totalClicks: 0,
  totalAttempts: 0,
  lastUpdated: new Date().toISOString()
};

const DEFAULT_PREMIUM: PremiumCommunityConfig = {
  premiumGroupLink: "https://groupme.com/join_premium_placeholder",
  showPremiumGroup: true,
  lastUpdated: new Date().toISOString()
};

export default function CommunityManagementScreen() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  // Settings states
  const [globalConfig, setGlobalConfig] = useState<GlobalCommunityConfig>(DEFAULT_GLOBAL);
  const [premiumConfig, setPremiumConfig] = useState<PremiumCommunityConfig>(DEFAULT_PREMIUM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  useEffect(() => {
    // Only mentors or primary mentors should access this
    const role = (userProfile?.role || '').toLowerCase();
    if (!userProfile || (role !== 'mentor' && role !== 'primary-mentor' && role !== 'primarymentor' && role !== 'staff')) {
      alert("Access Prohibited: Mentor authorization required.");
      navigate('/app/home');
      return;
    }

    const loadAllConfigs = async () => {
      setLoading(true);
      try {
        const globalDocRef = doc(db, 'community_config', 'global');
        const premiumDocRef = doc(db, 'community_config', 'premium');

        const [globalSnap, premiumSnap] = await Promise.all([
          getDoc(globalDocRef),
          getDoc(premiumDocRef)
        ]);

        if (globalSnap.exists()) {
          setGlobalConfig({ ...DEFAULT_GLOBAL, ...globalSnap.data() } as GlobalCommunityConfig);
        } else {
          // Initialize in DB
          await setDoc(globalDocRef, DEFAULT_GLOBAL);
          setGlobalConfig(DEFAULT_GLOBAL);
        }

        if (premiumSnap.exists()) {
          setPremiumConfig({ ...DEFAULT_PREMIUM, ...premiumSnap.data() } as PremiumCommunityConfig);
        } else {
          // Initialize in DB
          await setDoc(premiumDocRef, DEFAULT_PREMIUM);
          setPremiumConfig(DEFAULT_PREMIUM);
        }
      } catch (err) {
        console.error("Error loading community settings:", err);
        triggerToast("Failed to fetch settings from repository.");
      } finally {
        setLoading(false);
      }
    };

    loadAllConfigs();
  }, [userProfile, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setSaving(true);
    
    try {
      const now = new Date().toISOString();
      const updatedGlobal = {
        ...globalConfig,
        lastUpdated: now
      };
      const updatedPremium = {
        ...premiumConfig,
        lastUpdated: now
      };

      const globalDocRef = doc(db, 'community_config', 'global');
      const premiumDocRef = doc(db, 'community_config', 'premium');

      await Promise.all([
        setDoc(globalDocRef, updatedGlobal),
        setDoc(premiumDocRef, updatedPremium)
      ]);

      // Log high-authority action for auditing trail
      await logAuditAction(
        userProfile.uid,
        userProfile.name || 'System Mentor',
        'Updated Community Configuration',
        'global_community',
        `Meta and links updated. Card visible: ${updatedGlobal.showCommunityCard}`
      );

      setGlobalConfig(updatedGlobal);
      setPremiumConfig(updatedPremium);
      triggerToast("Community configurations applied successfully!");
    } catch (err) {
      console.error("Error saving community metrics:", err);
      triggerToast("Error updating configurations on Firestore.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetAnalytics = async () => {
    if (!window.confirm("Are you sure you want to reset community analytics counters to zero? This action is absolute and irreversible.")) {
      return;
    }
    try {
      const globalDocRef = doc(db, 'community_config', 'global');
      await updateDoc(globalDocRef, {
        totalClicks: 0,
        totalAttempts: 0
      });
      setGlobalConfig(prev => ({
        ...prev,
        totalClicks: 0,
        totalAttempts: 0
      }));
      triggerToast("Counters reset to zero.");
    } catch (err) {
      console.error("Error resetting analytics:", err);
      triggerToast("Failed to reset counters.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-screen bg-slate-50 font-sans">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-black text-slate-800 uppercase tracking-widest animate-pulse">Initializing Community Core...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-4 pb-32 px-4 sm:px-6 lg:px-8 font-sans text-slate-900 leading-normal">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 shadow-xl shadow-slate-950/20 text-xs font-black tracking-wide border border-slate-800 animate-bounce">
          <CheckCircle2 className="text-violet-400" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              id="back_to_dashboard_btn"
              onClick={() => navigate('/app/home')} 
              className="p-3.5 bg-white border border-slate-200/80 text-slate-900 rounded-2xl hover:bg-slate-100 transition-colors shadow-sm active:scale-95 duration-200"
            >
              <ArrowLeft size={18} className="stroke-[3]" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-950 tracking-tight">Community Management</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5 flex items-center gap-1">
                <Shield size={12} className="text-violet-600" /> Authorized Operations Console
              </p>
            </div>
          </div>
          <div className="bg-violet-100 px-3.5 py-1.5 rounded-full border border-violet-200 text-[10px] font-black text-violet-700 uppercase tracking-widest">
            {globalConfig.communityStatus}
          </div>
        </div>

        {/* Analytics High-Contrast Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/85 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Join Clicks</p>
              <h4 className="text-3xl font-black text-slate-900">{globalConfig.totalClicks || 0}</h4>
            </div>
            <p className="text-[9px] text-slate-500 font-bold mt-2.5">Total unique clicks on main banner</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/85 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Group Attempts</p>
              <h4 className="text-3xl font-black text-slate-900">{globalConfig.totalAttempts || 0}</h4>
            </div>
            <p className="text-[9px] text-slate-500 font-bold mt-2.5">Total link redirections visited</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/85 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Config Update</p>
              <h4 className="text-sm font-black text-slate-800 mt-2">
                {globalConfig.lastUpdated 
                  ? new Date(globalConfig.lastUpdated).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </h4>
            </div>
            <button 
              type="button" 
              onClick={handleResetAnalytics}
              className="mt-4 text-[9px] font-black text-rose-600 hover:text-rose-800 uppercase tracking-widest text-left"
            >
              Reset Statistics
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Section 1: Community settings */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.2rem] border border-slate-200/85 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <Settings size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">1. Community Meta Settings</h3>
                <p className="text-xs text-slate-500 font-medium">Configure community branding, status, and system-wide visibility.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider block mb-2">Community Name</label>
                <input 
                  type="text" 
                  value={globalConfig.communityName}
                  onChange={e => setGlobalConfig(prev => ({ ...prev, communityName: e.target.value }))}
                  placeholder="e.g. Mission Selection Base Group"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-600 focus:bg-white transition-all shadow-inner"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider block mb-2">Banner Description</label>
                <textarea 
                  rows={4}
                  value={globalConfig.communityDescription}
                  onChange={e => setGlobalConfig(prev => ({ ...prev, communityDescription: e.target.value }))}
                  placeholder="Insert community explanation. Visible to students on their dashboard card."
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-violet-600 focus:bg-white transition-all shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-900">Community Status</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">Toggle availability flag</p>
                  </div>
                  <select 
                    value={globalConfig.communityStatus}
                    onChange={e => setGlobalConfig(prev => ({ ...prev, communityStatus: e.target.value as any }))}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-800 outline-none focus:border-violet-500"
                  >
                    <option value="Active">Active / On</option>
                    <option value="Disabled">Disabled / Off</option>
                  </select>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-900">Show Main Card</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">Render banner on Dashboard</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setGlobalConfig(p => ({ ...p, showCommunityCard: !p.showCommunityCard }))}
                    className={`p-1.5 rounded-xl border transition-all ${
                      globalConfig.showCommunityCard 
                        ? 'bg-violet-100 border-violet-300 text-violet-700 font-black' 
                        : 'bg-slate-100 border-slate-200 text-slate-400 font-bold'
                    } text-[10px] uppercase tracking-wider px-3`}
                  >
                    {globalConfig.showCommunityCard ? "Visible" : "Hidden"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Group & Link Management */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.2rem] border border-slate-200/85 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Link2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">2. Group Channels & Invitation Links</h3>
                <p className="text-xs text-slate-500 font-medium">Link official GroupMe spaces. Updates update our student portals dynamically.</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Channel 1: Announcements */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-150 relative">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Megaphone size={13} /> Official Announcements Group
                  </span>
                  <button 
                    type="button"
                    onClick={() => setGlobalConfig(prev => ({ ...prev, showOfficialGroup: !prev.showOfficialGroup }))}
                    className="flex items-center gap-1 text-[10px] font-black text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {globalConfig.showOfficialGroup ? (
                      <>
                        <Eye size={12} className="text-emerald-600" /> <span className="text-emerald-700">Shown</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={12} className="text-rose-500" /> <span className="text-rose-600">Hidden</span>
                      </>
                    )}
                  </button>
                </div>
                <input 
                  type="url" 
                  value={globalConfig.officialGroupLink}
                  onChange={e => setGlobalConfig(prev => ({ ...prev, officialGroupLink: e.target.value }))}
                  placeholder="https://groupme.com/join/..."
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-2 font-bold leading-relaxed">Mandatory fallback. This acts as the default community link when clicked directly.</p>
              </div>

              {/* Channel 2: Discussion */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-150 relative">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                    <Users size={13} className="text-slate-500" /> Study Discussion Group (Optional)
                  </span>
                  <button 
                    type="button"
                    onClick={() => setGlobalConfig(prev => ({ ...prev, showDiscussionGroup: !prev.showDiscussionGroup }))}
                    className="flex items-center gap-1 text-[10px] font-black text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {globalConfig.showDiscussionGroup ? (
                      <>
                        <Eye size={12} className="text-emerald-600" /> <span className="text-emerald-700">Shown</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={12} className="text-rose-500" /> <span className="text-rose-600">Hidden</span>
                      </>
                    )}
                  </button>
                </div>
                <input 
                  type="url" 
                  value={globalConfig.discussionGroupLink}
                  onChange={e => setGlobalConfig(prev => ({ ...prev, discussionGroupLink: e.target.value }))}
                  placeholder="https://groupme.com/join/..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-2 font-bold leading-relaxed">Optional open discussion chat board where users exchange insights.</p>
              </div>

              {/* Channel 3: Premium Premium channel has backend authentication */}
              <div className="p-5 bg-violet-50/70 rounded-2xl border border-violet-100 relative">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-violet-700 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles size={13} className="text-violet-500" /> Premium Squad Circle (Authorized-Only)
                  </span>
                  <button 
                    type="button"
                    onClick={() => setPremiumConfig(prev => ({ ...prev, showPremiumGroup: !prev.showPremiumGroup }))}
                    className="flex items-center gap-1 text-[10px] font-black text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {premiumConfig.showPremiumGroup ? (
                      <>
                        <Eye size={12} className="text-violet-600" /> <span className="text-violet-700">Shown</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={12} className="text-rose-500" /> <span className="text-rose-600">Hidden</span>
                      </>
                    )}
                  </button>
                </div>
                <input 
                  type="url" 
                  value={premiumConfig.premiumGroupLink}
                  onChange={e => setPremiumConfig(prev => ({ ...prev, premiumGroupLink: e.target.value }))}
                  placeholder="https://groupme.com/join/..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-violet-500 shadow-sm"
                />
                <div className="p-3 bg-white/80 border border-violet-100 rounded-xl text-[10px] text-violet-850 font-bold leading-relaxed mt-3 uppercase tracking-wide flex items-start gap-2">
                  <Shield size={12} className="text-violet-600 shrink-0 mt-0.5" />
                  <span>
                    Secured behind backend Firestore rules. Only mentors or premium registered students will be able to retrieve this link from the database.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-4">
            <button 
              type="button" 
              onClick={() => navigate('/app/home')}
              className="px-6 py-4 rounded-2xl border border-slate-200 font-black text-xs uppercase tracking-widest text-slate-700 hover:bg-slate-100 transition-all active:scale-95 duration-200"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-2xl shadow-md hover:shadow-lg hover:shadow-violet-200/50 transition-all flex items-center justify-center gap-2 active:scale-95 duration-200 disabled:opacity-50"
            >
              <Save size={14} className="stroke-[3]" />
              {saving ? "Saving Changes..." : "Apply Configs"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
