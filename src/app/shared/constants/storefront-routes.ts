/** Canonical storefront URLs (hash routing: /#/home, /#/shop). */
export const STOREFRONT_ROUTES = {
  home: '/home',
  shop: '/shop',
} as const;

/** Prefer SEO slug when present; fall back to inventory id. */
export function shopProductLink(productOrId: { id?: string | number; slug?: string } | string | number): (string | number)[] {
  if (typeof productOrId === 'string' || typeof productOrId === 'number') {
    return ['/shop/product', productOrId];
  }

  const slug = String(productOrId?.slug || '').trim();
  if (slug) {
    return ['/shop/product', slug];
  }
  if (productOrId?.id != null && String(productOrId.id).trim()) {
    return ['/shop/product', productOrId.id];
  }
  return ['/shop'];
}
