import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moonlightstrikers.cricket',
  appName: 'MoonLight Strikers',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
