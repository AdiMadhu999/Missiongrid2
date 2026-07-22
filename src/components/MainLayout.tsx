import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Target, BookOpen, Award, ClipboardCheck, ClipboardList, Rss, User, FileText, HelpCircle, WifiOff, FileEdit, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { GenerationCenterFloatingWidget } from './GenerationCenterFloatingWidget';

export default function MainLayout() {
  const { userProfile, logout } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const role = (userProfile?.role || '').toLowerCase();
  const isMentor = role === 'mentor' || role === 'primary-mentor' || role === 'staff' || role === 'admin' || role === 'examiner';

  const isTestEditMode = searchParams.get('mode') === 'edit';

  const hideNav = location.pathname.includes('/tests/attempt') || 
                  location.pathname.includes('/tests/ai-gen') || 
                  location.pathname.includes('/tests/result') ||
                  location.pathname.includes('/test-mode') ||
                  location.pathname.includes('attempt') ||
                  isTestEditMode;

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen md:h-screen bg-transparent w-full relative">
      {isOffline && (
        <div className="bg-amber-500 text-white text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 z-[999] shadow-sm animate-in slide-in-from-top duration-300 w-full shrink-0">
          <WifiOff size={14} className="animate-pulse" />
          <span>You are offline. Operating seamlessly in offline-first mode.</span>
        </div>
      )}
      
      <div className="main-layout-grid flex-1 flex flex-col md:grid md:grid-cols-[240px_minmax(0,1fr)_300px] w-full h-full md:overflow-hidden relative">
      {/* Sidebar for Desktop */}
      <div className="sidebar hidden md:flex flex-col bg-white border-r border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-center">
           <h2 className="font-bold text-lg text-indigo-700 tracking-tight">Mission Selection</h2>
        </div>
        <nav className="flex flex-col p-4 gap-2 h-full overflow-y-auto">
          <span className="text-xs font-bold text-slate-400 uppercase px-3 mb-2">Navigation</span>
            
          {role === 'student' ? (
            <>
              <NavLink to="/app/home" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                 <Home size={20} />
                 <span>Home</span>
              </NavLink>
              <NavLink to="/app/targets" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                 <Target size={20} />
                 <span>Target</span>
              </NavLink>
              <NavLink to="/app/guide" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                 <BookOpen size={20} />
                 <span>Guide</span>
              </NavLink>
              <NavLink to="/app/missions" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                 <ClipboardCheck size={20} />
                 <span>Mission</span>
              </NavLink>
              <NavLink to="/app/tests" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-rose-50 text-rose-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                 <ClipboardList size={20} />
                 <span>Test</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/app/home" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                 <Home size={20} />
                 <span>Home</span>
              </NavLink>
              {role !== 'examiner' && (
                <NavLink to="/app/targets" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                   <Target size={20} />
                   <span>Target</span>
                </NavLink>
              )}
              <NavLink to="/app/guide" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                 <BookOpen size={20} />
                 <span>Guide</span>
              </NavLink>
              {!isMentor && (
                <NavLink to="/app/missions" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                   <ClipboardCheck size={20} />
                   <span>Mission</span>
                </NavLink>
              )}
              {isMentor && (
                <NavLink to="/app/tests" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                   <FileText size={20} />
                   <span>Tests</span>
                </NavLink>
              )}
              {isMentor && (
                <NavLink to="/app/mentor-place" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                   <Award size={20} />
                   <span>Mentor Place</span>
                </NavLink>
              )}
              {isMentor && (
                <NavLink to="/app/study-material-creator" className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                   <FileEdit size={20} />
                   <span>Study Material</span>
                </NavLink>
              )}
            </>
          )}
        </nav>
        
        {/* Sidebar Footer - Desktop Profile */}
        <div className="p-4 border-t border-slate-200 mt-auto bg-slate-50">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                 {userProfile?.photoUrl ? (
                    <img src={userProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                 ) : (
                    <User size={18} className="text-indigo-400" />
                 )}
              </div>
              <div className="flex flex-col min-w-0">
                 <span className="text-sm font-bold text-slate-900 truncate">{userProfile?.name || 'User'}</span>
                 <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">{userProfile?.role || 'Student'}</span>
              </div>
           </div>
           
           <button 
             onClick={() => logout()}
             className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 hover:text-rose-600 transition-colors"
           >
             <LogOut size={16} />
             <span>Sign Out</span>
           </button>
        </div>
      </div>

      <div className={`main-content relative w-full h-full md:overflow-y-auto bg-slate-50 md:bg-white ${hideNav ? 'pb-0' : 'pb-28 md:pb-0'}`}>
        <Outlet />
      </div>

      {/* Secondary Panel for Desktop */}
      <div className="secondary-panel hidden md:flex flex-col bg-slate-50 border-l border-slate-200 h-full overflow-y-auto">
        <div className="p-5 flex-1 flex flex-col gap-6">
          {/* Quick Stats / Calendar Placeholder */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Today</h3>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-indigo-600 mb-1">
                {new Date().getDate()}
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {new Date().toLocaleString('default', { month: 'short' })} {new Date().getFullYear()}
              </span>
            </div>
          </div>

          {/* Notifications */}
          <div className="flex-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Activity</h3>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-3 min-h-[150px]">
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                  <Rss size={16} className="text-slate-400" />
                </div>
                <span className="text-sm font-semibold text-slate-600">No new updates</span>
                <span className="text-xs text-slate-400 mt-1">You're all caught up for today.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      {!hideNav && (
        <div className="mobile-bottom-nav-container fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-[40] px-3 pb-4 sm:pb-6 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
          <nav className="mx-auto bg-white border border-slate-200/60 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] rounded-[2.5rem] flex items-center justify-between p-1.5 overflow-x-auto no-scrollbar gap-0.5 pointer-events-auto">
            
            {role === 'student' ? (
              <>
                {/* Student order: Home, Target, Guide, Mission, Test */}
                <NavLink 
                  to="/app/home" 
                  className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-1.5 rounded-2xl transition-all duration-300 relative group ${
                    isActive 
                      ? 'text-violet-600 bg-gradient-to-br from-violet-100 to-indigo-50 border border-violet-200 scale-105 font-black shadow-md' 
                      : 'text-slate-500 hover:text-violet-500 hover:bg-slate-50'
                  }`}
                >
                  <div className="relative">
                    <img src={userProfile?.photoUrl || '/placeholder-avatar.png'} alt="Profile" className="w-7 h-7 rounded-full border-2 border-violet-300 shadow-sm" />
                  </div>
                  <span className="text-[9px] font-black tracking-tight mt-0.5 uppercase">Home</span>
                </NavLink>

                <NavLink 
                  to="/app/targets" 
                  className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-1.5 rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'text-amber-600 bg-gradient-to-br from-amber-100 to-yellow-50 border border-amber-200 scale-105 font-black shadow-md' 
                      : 'text-slate-500 hover:text-amber-500 hover:bg-slate-50'
                  }`}
                >
                  <Target size={20} className="transition-transform duration-200" />
                  <span className="text-[9px] font-black tracking-tight mt-0.5 uppercase">Target</span>
                </NavLink>

                <NavLink 
                  to="/app/guide" 
                  className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-1.5 rounded-2xl transition-all duration-300 relative ${
                    isActive 
                      ? 'text-blue-600 bg-gradient-to-br from-blue-100 to-cyan-50 border border-blue-200 scale-105 font-black shadow-md' 
                      : 'text-slate-500 hover:text-blue-500 hover:bg-slate-50'
                  }`}
                >
                  <div className="relative">
                    <BookOpen size={20} className="transition-transform duration-200" />
                  </div>
                  <span className="text-[9px] font-black tracking-tight mt-0.5 uppercase">Guide</span>
                </NavLink>

                <NavLink 
                  to="/app/missions" 
                  className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-1.5 rounded-2xl transition-all duration-300 relative ${
                    isActive 
                      ? 'text-emerald-600 bg-gradient-to-br from-emerald-100 to-teal-50 border border-emerald-200 scale-105 font-black shadow-md' 
                      : 'text-slate-500 hover:text-emerald-500 hover:bg-slate-50'
                  }`}
                >
                  <div className="relative">
                    <ClipboardCheck size={20} className="transition-transform duration-200" />
                  </div>
                  <span className="text-[9px] font-black tracking-tight mt-0.5 uppercase">Mission</span>
                </NavLink>

                <NavLink 
                  to="/app/tests" 
                  className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-1.5 rounded-2xl transition-all duration-300 relative ${
                    isActive 
                      ? 'text-rose-600 bg-gradient-to-br from-rose-100 to-pink-50 border border-rose-200 scale-105 font-black shadow-md' 
                      : 'text-slate-500 hover:text-rose-500 hover:bg-slate-50'
                  }`}
                >
                  <div className="relative">
                    <ClipboardList size={20} className="transition-transform duration-200" />
                  </div>
                  <span className="text-[9px] font-black tracking-tight mt-0.5 uppercase">Test</span>
                </NavLink>
              </>
            ) : (
              <>
                {/* Default order for mentors/examiners */}
                <NavLink 
                  to="/app/home" 
                  className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'text-violet-600 bg-violet-50/80 scale-105 font-bold' 
                      : 'text-slate-500 hover:text-violet-500'
                  }`}
                >
                  <Home size={22} className="transition-transform duration-200" />
                  <span className="text-[10px] font-bold tracking-tight mt-1">Home</span>
                </NavLink>

                {role !== 'examiner' && (
                  <NavLink 
                    to="/app/targets" 
                    className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                      isActive 
                        ? 'text-amber-600 bg-amber-50/80 scale-105 font-bold' 
                        : 'text-slate-500 hover:text-amber-500'
                    }`}
                  >
                    <Target size={22} className="transition-transform duration-200" />
                    <span className="text-[10px] font-bold tracking-tight mt-1">Target</span>
                  </NavLink>
                )}

                <NavLink 
                  to="/app/guide" 
                  className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'text-blue-600 bg-blue-50/80 scale-105 font-bold' 
                      : 'text-slate-500 hover:text-blue-500'
                  }`}
                >
                  <BookOpen size={22} className="transition-transform duration-200" />
                  <span className="text-[10px] font-bold tracking-tight mt-1">Guide</span>
                </NavLink>

                {!isMentor && (
                  <NavLink 
                    to="/app/missions" 
                    className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                      isActive 
                        ? 'text-emerald-600 bg-emerald-50/80 scale-105 font-bold' 
                        : 'text-slate-500 hover:text-emerald-500'
                    }`}
                  >
                    <ClipboardCheck size={22} className="transition-transform duration-200" />
                    <span className="text-[10px] font-bold tracking-tight mt-1">Mission</span>
                  </NavLink>
                )}

                {isMentor && (
                  <NavLink 
                    to="/app/tests" 
                    className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                      isActive 
                        ? 'text-emerald-600 bg-emerald-50/80 scale-105 font-bold' 
                        : 'text-slate-500 hover:text-emerald-500'
                    }`}
                  >
                    <FileText size={22} className="transition-transform duration-200" />
                    <span className="text-[10px] font-bold tracking-tight mt-1">Tests</span>
                  </NavLink>
                )}

                {isMentor && (
                  <NavLink 
                    to="/app/mentor-place" 
                    className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                      isActive 
                        ? 'text-slate-900 bg-slate-100 scale-105 font-bold' 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Award size={22} className="transition-transform duration-200" />
                    <span className="text-[10px] font-bold tracking-tight mt-1">Mentor Place</span>
                  </NavLink>
                )}

                {isMentor && (
                  <NavLink 
                    to="/app/study-material-creator" 
                    className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                      isActive 
                        ? 'text-indigo-600 bg-indigo-50/80 scale-105 font-bold' 
                        : 'text-slate-500 hover:text-indigo-600'
                    }`}
                  >
                    <FileEdit size={22} className="transition-transform duration-200" />
                    <span className="text-[10px] font-bold tracking-tight mt-1">Study Material</span>
                  </NavLink>
                )}
              </>
            )}

          </nav>
        </div>
      )}
    </div>
  );
}
