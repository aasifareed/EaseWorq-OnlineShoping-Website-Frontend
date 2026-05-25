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
    OnlineShopAvailableProduct_GetProductDetailForOnlineShop:
      'OnlineShopAvailableProduct/GetProductDetailForOnlineShop',
    OnlineShopAvailableProduct_GetRelatedProductsForOnlineShop:
      'OnlineShopAvailableProduct/GetRelatedProductsForOnlineShop',
    OnlineShopBrand_GetBrandsListForOnline: 'OnlineShopBrand/GetBrandsListForOnline',
    OnlineShopAvailableProduct_GetProductColorsListForOnline:
      'OnlineShopAvailableProduct/GetProductColorsListForOnline',
    OnlineShopAvailableProduct_GetProductSizesListForOnline:
      'OnlineShopAvailableProduct/GetProductSizesListForOnline',
    OnlineShopWishlist_GetWishlistForOnlineShop: 'OnlineShopWishlist/GetWishlistForOnlineShop',
    OnlineShopWishlist_AddToWishlistForOnlineShop: 'OnlineShopWishlist/AddToWishlistForOnlineShop',
    OnlineShopWishlist_RemoveFromWishlistForOnlineShop:
      'OnlineShopWishlist/RemoveFromWishlistForOnlineShop',
    OnlineShopSaleOrder_CreateOnlineShopSaleOrder: 'OnlineShopSaleOrder/CreateOnlineShopSaleOrder',
    OnlineShopSaleOrder_GetForSuccessPage: 'OnlineShopSaleOrder/GetOnlineShopSaleOrderForSuccessPage',
    OnlineShopSaleOrder_GetMyOrders: 'OnlineShopSaleOrder/GetMyOnlineShopSaleOrdersForCustomer',
    OnlineShopSaleOrder_GetMyOrderDetail: 'OnlineShopSaleOrder/GetMyOnlineShopSaleOrderDetailForCustomer',
    OnlinseShopUsers_SignupForOnlineShop: 'OnlinseShopUsers/SignupForOnlineShop',
    OnlinseShopUsers_ResetPasswordRequestForOnlineShop:
      'OnlinseShopUsers/ResetPasswordRequestForOnlineShop',
    OnlinseShopUsers_GetCustomerProfileForOnlineShop:
      'OnlinseShopUsers/GetCustomerProfileForOnlineShop',
    Page_GetBySlug: 'OnlineShopPage/GetBySlug',
    Page_GetActivePages: 'OnlineShopPage/GetActivePages',
    Settings_GetForStorefront: 'OnlineShopSettings/GetForStorefront',
    HeaderMenu_GetForStorefront: 'OnlineShopHeaderMenu/GetForStorefront',
    OnlineShopProductGroup_GetHierarchyForOnline: 'OnlineShopProductGroup/GetProductGroupHierarchyForOnline',
    OnlineShopProductGroup_GetProductGroupsListForOnline: 'OnlineShopProductGroup/GetProductGroupsListForOnline',
  },
  shop: {
    tenantId: '1',
    storeId: null as string | null,
    tenancyName: '',
  },
  auth: {
    login: 'TokenAuth/AuthenticateForOnlineShop',
    signup: 'User/SignupForMobile',
    resetPassword: 'User/ResetPasswordRequestForMobile',
  },
};
