import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.joblink.app',
  appName: 'Joblink',
  webDir: 'build',
  server: {
    url: 'http://192.168.100.5:8000',
    cleartext: true,
    androidScheme: 'http'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
    },
    Camera: {
      permissions: ['photos', 'camera']
    },
    Geolocation: {
      permissions: ['coarseLocation', 'fineLocation']
    },
    'cordova-plugin-googleplus': {
      REVERSED_CLIENT_ID: 'com.googleusercontent.apps.1053677464000-2sbmgpffk5qjtmpmtkj093uhkvrfnbsn'
    }
  }
};

export default config;
