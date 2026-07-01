// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: true,
  stripe_token: 'STRIPE_TOKEN',
  paypal_token: 'PAYPAL_TOKEN',
  baseUrl: 'https://beta-onlineshopping-api.sastakhareedo.com/',
  /** Subdomain tenancy name used when running on localhost in development. */
  devTenancyName: 'beta-ak-mobile-shop',
  /** Fixed tenant id used when running locally in development (mirrors admin panel). */
  devTenantId: 1,
  /** Optional fallback only — resolved at runtime from subdomain + APIs. */
  tenantId: null as number | null,
  /** Optional fallback only — resolved from GetForStorefront when omitted. */
  storeId: null as string | null,
  // baseUrl: 'https://q1dcwl9z-44374.inc1.devtunnels.ms',

//   urls: {
   
//   },
   urls: {
Account_IsTenantAvailable: 'Account/IsTenantAvailable',
Notification_GetAll: 'Notification/GetNotifications',
Notification_GetUnread: 'Notification/GetUnreadCustomerNotifications',
Notification_Update: 'Notification/UpdateNotification',
Notification_MarkAsRead: 'Notification/MarkCustomerNotificationAsRead',
OnlineShopAvailableProduct_GetAllAvailableProductsForOnlineShop:"OnlineShopAvailableProduct/GetAllAvailableProductsForOnlineShop",
OnlineShopAvailableProduct_GetProductDetailForOnlineShop: "OnlineShopAvailableProduct/GetProductDetailForOnlineShop",
OnlineShopAvailableProduct_GetRelatedProductsForOnlineShop: "OnlineShopAvailableProduct/GetRelatedProductsForOnlineShop",
OnlineShopBrand_GetBrandsListForOnline: "OnlineShopBrand/GetBrandsListForOnline",
OnlineShopBrand_GetHomePopularBrandsForOnline: "OnlineShopBrand/GetHomePopularBrandsForOnline",
OnlineShopAvailableProduct_GetProductColorsListForOnline: "OnlineShopAvailableProduct/GetProductColorsListForOnlineShop",
OnlineShopAvailableProduct_GetProductSizesListForOnline: "OnlineShopAvailableProduct/GetProductSizesListForOnlineShop",
OnlineShopAvailableProduct_GetHomePopularCategoryProductSliders: "OnlineShopAvailableProduct/GetHomePopularCategoryProductSliders",
OnlineShopProduct_GetHomePopularCategoryProductSliders: "OnlineShopProduct/GetHomePopularCategoryProductSliders",
OnlineShopWishlist_GetWishlistForOnlineShop: "OnlineShopWishlist/GetWishlistForOnlineShop",
OnlineShopWishlist_AddToWishlistForOnlineShop: "OnlineShopWishlist/AddToWishlistForOnlineShop",
OnlineShopWishlist_RemoveFromWishlistForOnlineShop: "OnlineShopWishlist/RemoveFromWishlistForOnlineShop",
OnlineShopCheckout_GetShippingRate: "OnlineShopCheckout/GetShippingRate",
OnlineShopCheckout_ApplyCoupon: "OnlineShopCheckout/ApplyCoupon",
OnlineShopSaleOrder_CreateOnlineShopSaleOrder: "OnlineShopSaleOrder/CreateOnlineShopSaleOrder",
OnlineShopSaleOrder_GetForSuccessPage: "OnlineShopSaleOrder/GetOnlineShopSaleOrderForSuccessPage",
OnlineShopSaleOrder_GetForFailurePage: "OnlineShopSaleOrder/GetOnlineShopSaleOrderForPaymentFailurePage",
OnlineShopSaleOrder_GetMyOrders: "OnlineShopSaleOrder/GetMyOnlineShopSaleOrdersForCustomer",
OnlineShopSaleOrder_GetMyOrderDetail: "OnlineShopSaleOrder/GetMyOnlineShopSaleOrderDetailForCustomer",
OnlineShopSaleOrder_GetMyOrderStatusTimeline: "OnlineShopSaleOrder/GetMyOnlineShopOrderStatusTimelineForCustomer",
OnlineShopSaleOrder_GetOrderReceipt: "OnlineShopSaleOrder/GetMyOrderReceiptHtml",
OnlineShopSaleOrder_DownloadOrderReceiptPdf: "OnlineShopSaleOrder/DownloadMyOrderReceiptPdf",
OnlineShopSaleOrder_PreviewOrderReceiptPdf: "OnlineShopSaleOrder/PreviewMyOrderReceiptPdf",
OnlineShopShipment_TrackOrder: "OnlineShopShipment/TrackOrder",
OnlineShopShipment_SyncOrderTracking: "OnlineShopShipment/SyncOrderTracking",
OnlineShopShipment_ResyncOrderTracking: "OnlineShopShipment/ResyncOrderTracking",
TcsCourier_CreateBookingFromOrder: "TcsCourier/CreateBookingFromOrder",
//OnlineShopUsersAppServcie
OnlinseShopUsers_SignupForOnlineShop: "OnlinseShopUsers/SignupForOnlineShop",
OnlinseShopUsers_ResetPasswordRequestForOnlineShop: "OnlinseShopUsers/ResetPasswordRequestForOnlineShop",
OnlinseShopUsers_GetCustomerProfileForOnlineShop: "OnlinseShopUsers/GetCustomerProfileForOnlineShop",

// OnlineShopAvailableProduct_GetAllAvailableProductsForOnlineShop:
// 'OnlineShopAvailableProduct/GetAllAvailableProductsForOnlineShop',
Page_GetBySlug: 'OnlineShopPage/GetBySlug',
Page_GetActivePages: 'OnlineShopPage/GetActivePages',
Settings_GetForStorefront: 'OnlineShopSettings/GetForStorefront',
HeaderMenu_GetForStorefront: 'OnlineShopHeaderMenu/GetForStorefront',
OnlineShopProductGroup_GetHierarchyForOnline: 'OnlineShopProductGroup/GetProductGroupHierarchyForOnline',
OnlineShopProductGroup_GetProductGroupsListForOnline: 'OnlineShopProductGroup/GetProductGroupsListForOnline',
OnlineShopSearch_GetSuggestions: 'OnlineShopSearch/GetSearchSuggestions',
OnlineShopTenant_GetTenantDetailsForWebsite: 'OnlineShopTenant/GetTenantDetailsForWebsite',

   },
   shop: {
    tenantId: '1',
    storeId: null as string | null,
    tenancyName: 'beta-ak-mobile-shop',
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
