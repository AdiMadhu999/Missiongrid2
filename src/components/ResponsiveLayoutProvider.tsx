import React, { useEffect } from 'react';
import { isNativeAndroid } from '../utils/platform';

export const ResponsiveLayoutProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const updateLayout = () => {
      const root = document.getElementById('root');
      if (!root) return;

      // If it's a native android app, it MUST be mobile layout.
      if (isNativeAndroid()) {
        root.classList.add('mobile-layout');
        root.classList.remove('desktop-layout');
      } else {
        const isMobileOS = /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
        if (isMobileOS) {
           // Mobile web browser
           root.classList.add('mobile-layout');
           root.classList.remove('desktop-layout');
        } else {
           // Desktop web browser - NEVER force mobile layout
           root.classList.add('desktop-layout');
           root.classList.remove('mobile-layout');
        }
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  return <>{children}</>;
};
