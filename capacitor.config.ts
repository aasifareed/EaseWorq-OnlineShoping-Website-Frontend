import type { CapacitorConfig } from '@capacitor/cli';
/// <reference types="@codetrix-studio/capacitor-google-auth" />

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
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // Web client ID — used as serverClientId so the ID token audience matches Host auth.
      serverClientId: '845543032039-b34k6kg6h54i25vdrjjb3vco49uln8a2.apps.googleusercontent.com',
      androidClientId: '845543032039-e6art77rc2slr1ilen304g3f1fv06m7b.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
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
