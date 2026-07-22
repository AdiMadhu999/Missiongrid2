import { Capacitor } from '@capacitor/core';

/**
 * Utility to detect the current platform.
 */
export const getPlatform = () => {
  return Capacitor.getPlatform(); // 'android', 'ios', or 'web'
};

/**
 * Detects if the app is running in a native Android wrapper.
 */
export const isNativeAndroid = (): boolean => {
  return Capacitor.getPlatform() === 'android';
};

/**
 * Detects if the app is running in a standard web browser.
 */
export const isWeb = (): boolean => {
  return Capacitor.getPlatform() === 'web';
};
