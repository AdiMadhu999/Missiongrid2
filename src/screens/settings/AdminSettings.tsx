import React, { useState } from 'react';
import { Settings, BookOpen, Target, ShieldCheck, Trophy, Bell, User, LayoutGrid, Database, Activity } from 'lucide-react';
import ModuleControlScreen from './ModuleControlScreen';
import BackupRestoreScreen from './BackupRestoreScreen';
import AuditLogScreen from './AuditLogScreen';
import SystemHealthScreen from './SystemHealthScreen';

export default function AdminSettings() {
  const [view, setView] = useState<'admin' | 'modules' | 'backup' | 'audit' | 'health'>('admin');
  
  if (view === 'modules') return <ModuleControlScreen onBack={() => setView('admin')} />;
  if (view === 'backup') return <BackupRestoreScreen onBack={() => setView('admin')} />;
  if (view === 'audit') return <AuditLogScreen onBack={() => setView('admin')} />;
  if (view === 'health') return <SystemHealthScreen onBack={() => setView('admin')} />;

  const configGroups = [
    { title: 'Application', fields: ['App Name', 'Welcome Msg'], icon: Settings },
    { title: 'Batch', fields: ['Capacity', 'Visibility'], icon: BookOpen },
    { title: 'Target', fields: ['Timing', 'Archive Duration'], icon: Target },
    { title: 'Accountability', fields: ['Submission Window'], icon: ShieldCheck },
    { title: 'Rank', fields: ['Leaderboard', 'Category'], icon: Trophy },
    { title: 'Announcements', fields: ['Visibility'], icon: Bell },
    { title: 'Module Features', fields: ['Enable/Disable'], icon: LayoutGrid, action: () => setView('modules') },
    { title: 'Backup & Restore', fields: ['System Safety'], icon: Database, action: () => setView('backup') },
    { title: 'Audit Trail', fields: ['System Transparency'], icon: Activity, action: () => setView('audit') },
    { title: 'System Health', fields: ['Monitor Status'], icon: Activity, action: () => setView('health') },
  ];


  return (
    <div className="mt-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4">System Administration</h3>
      <div className="space-y-4">
        {configGroups.map((group, i) => (
          <div key={i} className="flex justify-between items-center py-3 border-b last:border-0 border-slate-100">
             <div className="flex items-center gap-3">
                <group.icon size={16} className="text-indigo-600" />
                <span className="text-sm font-semibold text-slate-700">{group.title}</span>
             </div>
             <button onClick={group.action} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">CONFIGURE</button>
          </div>
        ))}
      </div>
    </div>
  );
}
