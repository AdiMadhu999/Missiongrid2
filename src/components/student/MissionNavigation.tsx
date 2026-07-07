import React, { useState, useEffect } from 'react';
import { BookOpen, Users, MessageSquare, Target, Shield, Award } from 'lucide-react';
import { User } from '../../models/user';
import { BatchService } from '../../services/batch';

interface MissionNavigationProps {
  userProfile: User | null;
  config: any;
}

export const MissionNavigation: React.FC<MissionNavigationProps> = ({ userProfile, config }) => {
  const isPremium = userProfile?.isPremium;
  const [batchCommunityLink, setBatchCommunityLink] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.batchId) {
      BatchService.getBatchById(userProfile.batchId).then(batch => {
        if (batch?.communityLink) {
          setBatchCommunityLink(batch.communityLink);
        }
      });
    }
  }, [userProfile?.batchId]);

  const handleNavigation = (link: string | undefined, defaultLink?: string) => {
    if (!isPremium) {
      alert("Want mentor guidance? Contact mentor.");
      return;
    }
    const finalLink = batchCommunityLink || link || defaultLink;
    if (finalLink) {
      window.open(finalLink, '_blank');
    }
  };

  const missions = [
    { id: 'mentor', label: 'Mentor Guidance', icon: Shield, link: config?.mentorLink },
    { id: 'doubt', label: 'Doubt Discuss Group', icon: MessageSquare, link: config?.doubtLink },
    { id: 'selection', label: 'MissionGrid', icon: Target, link: config?.selectionLink },
    { id: 'fighters', label: 'MissionGrid Final Fighters', icon: Award, link: config?.fightersLink },
    { id: 'titans', label: 'Working Titans', icon: Users, link: config?.titansLink },
    { id: 'wb', label: 'West Bengal Officer', icon: BookOpen, link: config?.wbLink },
    { id: 'police', label: 'Police Academy', icon: Shield, link: config?.policeLink },
  ];

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
      <h2 className="text-sm font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent uppercase tracking-widest">Success Roadmap</h2>
      <div className="grid grid-cols-2 gap-3">
        {missions.map((m, index) => {
          const colors = [
            'text-indigo-500 border-indigo-100 bg-indigo-50 hover:border-indigo-300 hover:bg-indigo-100',
            'text-sky-500 border-sky-100 bg-sky-50 hover:border-sky-300 hover:bg-sky-100',
            'text-amber-500 border-amber-100 bg-amber-50 hover:border-amber-300 hover:bg-amber-100',
            'text-emerald-500 border-emerald-100 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100',
            'text-rose-500 border-rose-100 bg-rose-50 hover:border-rose-300 hover:bg-rose-100',
            'text-violet-500 border-violet-100 bg-violet-50 hover:border-violet-300 hover:bg-violet-100',
            'text-orange-500 border-orange-100 bg-orange-50 hover:border-orange-300 hover:bg-orange-100',
          ];
          const colorClass = colors[index % colors.length];

          return (
            <button
              key={m.id}
              onClick={() => handleNavigation(m.link, config?.officialGroupLink)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all active:scale-95 space-y-2 group ${colorClass}`}
            >
              <m.icon className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-[10px] font-bold text-slate-700 text-center">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
