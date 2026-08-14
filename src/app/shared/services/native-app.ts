import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

/** Native shell glue for the Capacitor Android APK (no-op on web). */
export function initNativeApp(router: Router): void {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  document.body.classList.add('is-native-app');

  void StatusBar.setOverlaysWebView({ overlay: false });
  void StatusBar.setBackgroundColor({ color: '#0a0a0a' });
  void StatusBar.setStyle({ style: Style.Dark });

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) {
      window.history.back();
      return;
    }
    void App.exitApp();
  });

  const openPayFastReturn = (url: string) => {
    const path = pathFromPayFastReturnUrl(url);
    if (path) {
      void router.navigateByUrl(path);
    }
  };

  void App.addListener('appUrlOpen', ({ url }) => openPayFastReturn(url));
  void App.getLaunchUrl().then((launch) => {
    if (launch?.url) {
      openPayFastReturn(launch.url);
    }
  });
}

/** Maps `com.fareedmart.onlineshop://return/#/shop/checkout/success/{id}` to Angular hash routes. */
export function pathFromPayFastReturnUrl(url: string): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hash && parsed.hash.startsWith('#/')) {
      return parsed.hash.slice(1);
    }

    const fromPath = `${parsed.hostname || ''}${parsed.pathname || ''}`
      .replace(/^\/+/, '')
      .replace(/^return\/?/i, '');
    if (fromPath.startsWith('shop/checkout/')) {
      return `/${fromPath}`;
    }
  } catch {
    const hashIdx = url.indexOf('#/');
    if (hashIdx >= 0) {
      return url.slice(hashIdx + 1);
    }
  }

  return null;
}
