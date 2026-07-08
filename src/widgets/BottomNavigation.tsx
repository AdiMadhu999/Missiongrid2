import React from 'react';
import { motion } from 'motion/react';
import { Target, ShieldCheck, ClipboardList, Trophy, User as UserIcon, Users } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../providers/AuthProvider';

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNavigation({ currentTab, onTabChange }: BottomNavProps) {
  const { userProfile } = useAuth();
  const role = (userProfile?.role || '').toLowerCase();
  const isMentor = role === 'mentor' || role === 'primary-mentor' || role === 'staff' || role === 'admin' || role === 'examiner';

  const TABS = [
    { id: 'target', label: 'Target', icon: Target },
    { id: 'accountability', label: 'Feed', icon: ShieldCheck },
    { id: 'test', label: 'Test', icon: ClipboardList },
    ...(isMentor ? [{ id: 'admin', label: 'Admin', icon: Users }] : []),
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-primary-600" : "text-slate-500 hover:text-slate-900"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute top-0 w-8 h-1 bg-primary-600 rounded-b-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className={cn("w-6 h-6", isActive && "fill-primary-50")} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium tracking-wide">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
