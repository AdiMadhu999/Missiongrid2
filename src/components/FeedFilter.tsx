import React from 'react';

interface FeedFilterProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export const FeedFilter: React.FC<FeedFilterProps> = ({ activeFilter, onFilterChange }) => {
  const filters = ['All', 'Mentor Posts', 'Daily Tests', 'Mission Reports', 'Doubts'];
  
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-4 scrollbar-hide">
      {filters.map(filter => (
        <button
          key={filter}
          onClick={() => onFilterChange(filter)}
          className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
            activeFilter === filter
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
};
