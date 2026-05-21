// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  stripe_token: 'STRIPE_TOKEN',
  paypal_token: 'PAYPAL_TOKEN',
  baseUrl: 'https://localhost:44374',
  /** Tenant for public storefront APIs (pages, products, settings). */
  tenantId: 1,
  /** Optional online store id (CustomStore). Uses tenant online store when omitted. */
  storeId: 'd4d292f5-de72-4742-b728-ea34a1706191' as string | null,
  // baseUrl: 'https://q1dcwl9z-44374.inc1.devtunnels.ms',

//   urls: {
   
//   },
   urls: {
OnlineShopAvailableProduct_GetAllAvailableProductsForOnlineShop:"OnlineShopAvailableProduct/GetAllAvailableProductsForOnlineShop",
OnlineShopAvailableProduct_GetProductDetailForOnlineShop: "OnlineShopAvailableProduct/GetProductDetailForOnlineShop",
OnlineShopAvailableProduct_GetRelatedProductsForOnlineShop: "OnlineShopAvailableProduct/GetRelatedProductsForOnlineShop",
OnlineShopBrand_GetBrandsListForOnline: "OnlineShopBrand/GetBrandsListForOnline",
OnlineShopWishlist_GetWishlistForOnlineShop: "OnlineShopWishlist/GetWishlistForOnlineShop",
OnlineShopWishlist_AddToWishlistForOnlineShop: "OnlineShopWishlist/AddToWishlistForOnlineShop",
OnlineShopWishlist_RemoveFromWishlistForOnlineShop: "OnlineShopWishlist/RemoveFromWishlistForOnlineShop",
OnlineShopSaleOrder_CreateOnlineShopSaleOrder: "OnlineShopSaleOrder/CreateOnlineShopSaleOrder",
OnlineShopSaleOrder_GetForSuccessPage: "OnlineShopSaleOrder/GetOnlineShopSaleOrderForSuccessPage",
OnlineShopSaleOrder_GetMyOrders: "OnlineShopSaleOrder/GetMyOnlineShopSaleOrdersForCustomer",
//OnlineShopUsersAppServcie
OnlinseShopUsers_SignupForOnlineShop: "OnlinseShopUsers/SignupForOnlineShop",
OnlinseShopUsers_ResetPasswordRequestForOnlineShop: "OnlinseShopUsers/ResetPasswordRequestForOnlineShop",

// OnlineShopAvailableProduct_GetAllAvailableProductsForOnlineShop:
// 'OnlineShopAvailableProduct/GetAllAvailableProductsForOnlineShop',
Page_GetBySlug: 'OnlineShopPage/GetBySlug',
Page_GetActivePages: 'OnlineShopPage/GetActivePages',
Settings_GetForStorefront: 'OnlineShopSettings/GetForStorefront',
HeaderMenu_GetForStorefront: 'OnlineShopHeaderMenu/GetForStorefront',
OnlineShopProductGroup_GetHierarchyForOnline: 'OnlineShopProductGroup/GetProductGroupHierarchyForOnline',

   },
   shop: {
    tenantId: '1',
    storeId: 'd4d292f5-de72-4742-b728-ea34a1706191',
    tenancyName: 'AK Mobile Shop'
   },
   auth: {
    login: 'TokenAuth/AuthenticateForOnlineShop',
    signup: 'User/SignupForMobile',
    resetPassword: 'User/ResetPasswordRequestForMobile'
   }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
