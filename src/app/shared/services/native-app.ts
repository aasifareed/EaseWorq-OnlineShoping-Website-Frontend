import { NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

/** Native shell glue for the Capacitor Android APK (no-op on web). */
export function initNativeApp(router: Router, ngZone?: NgZone): void {
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

  const openIncomingUrl = (url: string) => {
    const run = () => {
      if (isPayFastIncomingUrl(url)) {
        const path = pathFromPayFastReturnUrl(url);
        if (path) {
          void router.navigateByUrl(path);
        }
        return;
      }

      const product = pathFromProductAppLink(url);
      if (product) {
        void router.navigate(['/shop/product', product.slug], {
          queryParams: product.queryParams,
          replaceUrl: true,
        });
      }
    };

    if (ngZone) {
      ngZone.run(run);
      return;
    }
    run();
  };

  void App.addListener('appUrlOpen', ({ url }) => openIncomingUrl(url));
  void App.getLaunchUrl().then((launch) => {
    if (launch?.url) {
      openIncomingUrl(launch.url);
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

export function isPayFastIncomingUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  const lower = url.toLowerCase();
  return lower.includes('payfast-return')
    || lower.includes('shop/checkout/')
    || /^com\.fareedmart\.onlineshop:/i.test(url);
}

export interface ProductAppLink {
  slug: string;
  queryParams: Record<string, string>;
}

/**
 * Maps verified App Links such as
 * `https://sastakhareedo.com/shop/product/{slug}?utm_source=facebook`
 * (and hash equivalents) to the existing Product Detail route.
 */
export function pathFromProductAppLink(url: string): ProductAppLink | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const slug = productSlugFromPath(parsed.pathname)
      || productSlugFromPath(hashPath(parsed.hash));
    if (!slug) {
      return null;
    }

    return {
      slug,
      queryParams: {
        ...queryParamsFromSearch(parsed.search),
        ...queryParamsFromSearch(hashSearch(parsed.hash)),
      },
    };
  } catch {
    const hashIdx = url.indexOf('#/');
    if (hashIdx >= 0) {
      const hash = url.slice(hashIdx);
      const slug = productSlugFromPath(hashPath(hash));
      if (slug) {
        return { slug, queryParams: queryParamsFromSearch(hashSearch(hash)) };
      }
    }
    return null;
  }
}

function productSlugFromPath(pathname: string): string | null {
  const path = decodeURIComponent(pathname || '').replace(/\/+$/, '');
  const match = path.match(/^\/shop\/product\/(?:left\/sidebar\/)?([^/]+)$/i);
  if (!match?.[1]) {
    return null;
  }

  const slug = match[1].trim();
  return slug || null;
}

function hashPath(hash: string): string {
  if (!hash?.startsWith('#/')) {
    return '';
  }
  return hash.slice(1).split('?')[0] || '';
}

function hashSearch(hash: string): string {
  if (!hash?.startsWith('#/')) {
    return '';
  }
  const q = hash.indexOf('?');
  return q >= 0 ? hash.slice(q) : '';
}

function queryParamsFromSearch(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!search) {
    return params;
  }

  const query = search.startsWith('?') ? search.slice(1) : search;
  new URLSearchParams(query).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}
