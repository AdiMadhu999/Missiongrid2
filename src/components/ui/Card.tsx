import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm ${className} ${onClick ? 'cursor-pointer hover:border-blue-300 gpu-accelerated touch-active-tactile' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
