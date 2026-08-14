import { environment } from 'src/environments/environment';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;

/**
 * Storefront media URLs from Host often point at http://localhost:2222 (or :44374).
 * That works in desktop Chrome on the same PC, but the APK WebView cannot reach
 * the developer's machine. Rewrite those hosts to environment.baseUrl (dev tunnel / API).
 */
export function rewriteMediaUrl(url: string | null | undefined): string {
  if (url == null) {
    return '';
  }

  let value = String(url).trim().replace(/\\/g, '/');
  if (!value) {
    return '';
  }

  if (
    value.startsWith('assets/') ||
    value.startsWith('/assets/') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value.replace(/^\//, '');
  }

  const base = (environment.baseUrl || '').replace(/\/$/, '');

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (LOCAL_HOST.test(parsed.hostname) && base) {
        const api = new URL(base.includes('://') ? base : `https://${base}`);
        // Drop localhost ports (:2222 / :44374). `host =` keeps them in WebView URL.
        return `${api.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return value;
    }
    return value;
  }

  if (!base) {
    return value.startsWith('/') ? value : `/${value}`;
  }

  const path = value.startsWith('/') ? value : `/${value}`;
  return `${base}${path}`;
}

/** Rewrite localhost hosts on cached cart / wishlist / compare product rows. */
export function rewriteProductMedia<T extends {
  pictureUrl?: string | null;
  imageUrl?: string | null;
  pictureUrls?: string[] | null;
  images?: Array<{ src?: string; alt?: string } | null> | null;
}>(product: T): T {
  if (!product) {
    return product;
  }

  return {
    ...product,
    pictureUrl: product.pictureUrl ? rewriteMediaUrl(product.pictureUrl) : product.pictureUrl,
    imageUrl: product.imageUrl ? rewriteMediaUrl(product.imageUrl) : product.imageUrl,
    pictureUrls: (product.pictureUrls || []).map((u) => rewriteMediaUrl(u)),
    images: (product.images || []).map((img) =>
      img?.src ? { ...img, src: rewriteMediaUrl(img.src) } : img
    ),
  };
}
