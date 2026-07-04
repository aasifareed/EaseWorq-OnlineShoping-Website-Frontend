/** Canonical storefront URLs (hash routing: /#/home, /#/shop). */
export const STOREFRONT_ROUTES = {
  home: '/home',
  shop: '/shop',
} as const;

export function shopProductLink(id: string | number): (string | number)[] {
  return ['/shop/product', id];
}
