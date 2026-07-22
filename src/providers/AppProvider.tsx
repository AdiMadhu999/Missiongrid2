// Global application providers (Context, Theme, etc.)
import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext<{
  isPremiumModalOpen: boolean;
  setIsPremiumModalOpen: (open: boolean) => void;
  isMaintenanceMode: boolean;
  setIsMaintenanceMode: (active: boolean) => void;
}>({
  isPremiumModalOpen: false,
  setIsPremiumModalOpen: () => {},
  isMaintenanceMode: false,
  setIsMaintenanceMode: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(() => {
    try {
      return localStorage.getItem('__maintenance_mode_active') === 'true';
    } catch {
      return false;
    }
  });

  const handleSetMaintenanceMode = (active: boolean) => {
    setIsMaintenanceMode(active);
    try {
      localStorage.setItem('__maintenance_mode_active', String(active));
    } catch (e) {
      console.error('Failed to save maintenance mode state:', e);
    }
  };

  return (
    <AppContext.Provider value={{ 
      isPremiumModalOpen: false, 
      setIsPremiumModalOpen: () => {}, 
      isMaintenanceMode, 
      setIsMaintenanceMode: handleSetMaintenanceMode 
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppConfig = () => useContext(AppContext);
