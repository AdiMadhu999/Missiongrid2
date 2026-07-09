import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Target, BookOpen, Award, Shield, ClipboardCheck, ClipboardList, Rss, User, FileText, HelpCircle } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

export default function MainLayout() {
  const { userProfile } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const role = (userProfile?.role || '').toLowerCase();
  const isMentor = role === 'mentor' || role === 'primary-mentor' || role === 'staff' || role === 'admin' || role === 'examiner';

  const isTestEditMode = searchParams.get('mode') === 'edit';
  const isSpecialPage = location.pathname.includes('/app/doubt') || 
                        location.pathname.includes('/app/guide') || 
                        location.pathname.includes('/app/tests');

  const hideNav = location.pathname.includes('/tests/attempt') || 
                  location.pathname.includes('/tests/ai-gen') || 
                  location.pathname.includes('/tests/result') ||
                  location.pathname.includes('/test-mode') ||
                  location.pathname.includes('attempt') ||
                  isTestEditMode;

  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      <div className={`flex-grow relative ${hideNav ? 'pb-0' : 'pb-28'}`}>
        <Outlet />
      </div>
      {!hideNav && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-[40] px-3 pb-4 sm:pb-6 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
        <nav className="mx-auto bg-white  border border-slate-200/60 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] rounded-[2.5rem] flex items-center justify-between p-1.5 overflow-x-auto no-scrollbar gap-0.5 pointer-events-auto">
          
          {role === 'student' ? (
            <>
              {/* Student order: Home (profile), Target, Community, Mission */}
              {!isSpecialPage && (
                <NavLink 
                  to="/app/home" 
                  className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 relative group ${
                    isActive 
                      ? 'text-violet-600 bg-violet-50/80 scale-105 font-bold' 
                      : 'text-slate-500 hover:text-violet-500'
                  }`}
                >
                  <div className="relative">
                    <img src={userProfile?.photoUrl || '/placeholder-avatar.png'} alt="Profile" className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
                  </div>
                  <span className="text-[10px] font-bold tracking-tight mt-1">Home</span>
                </NavLink>
              )}

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

              <NavLink 
                to="/app/doubt" 
                className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? 'text-indigo-600 bg-indigo-50/80 scale-105 font-bold' 
                    : 'text-slate-500 hover:text-indigo-500'
                }`}
              >
                <HelpCircle size={22} className="transition-transform duration-200" />
                <span className="text-[10px] font-bold tracking-tight mt-1">Doubt</span>
              </NavLink>

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

              <NavLink 
                to="/app/tests" 
                className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? 'text-rose-600 bg-rose-50/80 scale-105 font-bold' 
                    : 'text-slate-500 hover:text-rose-500'
                }`}
              >
                <ClipboardList size={22} className="transition-transform duration-200" />
                <span className="text-[10px] font-bold tracking-tight mt-1">Test</span>
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
                to="/app/doubt" 
                className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? 'text-indigo-600 bg-indigo-50/80 scale-105 font-bold' 
                    : 'text-slate-500 hover:text-indigo-500'
                }`}
              >
                <HelpCircle size={22} className="transition-transform duration-200" />
                <span className="text-[10px] font-bold tracking-tight mt-1">Doubt</span>
              </NavLink>

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

              {!isMentor ? (
                <NavLink 
                  to="/app/profile" 
                  className={({ isActive }) => `flex flex-col items-center flex-shrink-0 min-w-[50px] flex-1 px-1 py-2 rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'text-slate-900 bg-slate-100 scale-105 font-bold' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <User size={22} className="transition-transform duration-200" />
                  <span className="text-[10px] font-bold tracking-tight mt-1">Profile</span>
                </NavLink>
              ) : (
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
            </>
          )}

        </nav>
      </div>
      )}
    </div>
  );
}
