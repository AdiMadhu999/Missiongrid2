import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.adimadhu.missiongrid',
  appName: 'MissionGrid',
  webDir: 'dist',
  server: {
    hostname: 'mission-selection-ultimate.firebaseapp.com',
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    CapacitorHttp: {
      enabled: false
    },
    CapacitorCookies: {
      enabled: true
    }
  }
};

export default config;
