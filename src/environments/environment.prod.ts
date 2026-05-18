export const environment = {
  production: true,
  stripe_token: 'STRIPE_TOKEN',
  paypal_token: 'PAYPAL_TOKEN',
  baseUrl: '',
  tenantId: 1,
  storeId: null as string | null,
  urls: {
    OnlineShopAvailableProduct_GetAllAvailableProductsForOnlineShop:
      'OnlineShopAvailableProduct/GetAllAvailableProductsForOnlineShop',
    Page_GetBySlug: 'OnlineShopPage/GetBySlug',
    Page_GetActivePages: 'OnlineShopPage/GetActivePages',
    Settings_GetForStorefront: 'OnlineShopSettings/GetForStorefront',
  },
};
