import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fareedmart.onlineshop',
  appName: 'Sasta Khareedo',
  webDir: 'dist/multikart/browser',
  android: {
    allowMixedContent: false,
  },
  server: {
    // Origin must match API CORS. https://localhost is blocked on beta;
    // the storefront domain is already allowed (same as the website).
    androidScheme: 'https',
    hostname: 'sastakhareedo.com',
    allowNavigation: [
      'sastakhareedo.com',
      '*.sastakhareedo.com',
      'beta-onlineshopping-api.sastakhareedo.com',
      'prod-onlineshopping-api.sastakhareedo.com',
      'wqw3kv18-44374.uks1.devtunnels.ms',
      '*.uks1.devtunnels.ms',
      '*.devtunnels.ms',
      'ipguat.apps.net.pk',
      'ipg.apps.net.pk',
      '*.apps.net.pk',
      '*.ngrok-free.app',
      '*.ngrok.io',
      '*.google.com',
      '*.googleapis.com',
      '*.gstatic.com',
    ],
  },
  plugins: {
    // Native HTTP bypasses WebView CORS (beta API does not allow APK origins).
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
  },
};

export default config;
