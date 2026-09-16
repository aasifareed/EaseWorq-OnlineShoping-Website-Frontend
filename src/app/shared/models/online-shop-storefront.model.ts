export interface OnlineShopStorefrontTax {
  taxId: string;
  taxName: string;
  taxInPercentage: number;
  taxType?: string;
}

export interface OnlineShopStorefront {
  tenantId: number;
  storeId?: string;
  isOnlineShopEnabled: boolean;
  storeName?: string;
  logoUrl?: string;
  bannerImageUrl?: string;
  storeAddress?: string;
  phoneNumber?: string;
  whatsAppNumber?: string;
  email?: string;
  currencyName?: string;
  currencySymbol?: string;
  defaultLanguage?: string;
  timezone?: string;
  taxEnabled: boolean;
  taxes?: OnlineShopStorefrontTax[];
  storeSlug?: string;
  themeName?: string;
  showOutOfStockProducts: boolean;
  allowGuestCheckout: boolean;
  isDeliveryEnabled: boolean;
  /** Local Delivery fee when order is below freeDeliveryMinimumOrderAmount. */
  defaultDeliveryCharges?: number;
  /** Net merchandise total at or above which Local Delivery is free. */
  freeDeliveryMinimumOrderAmount?: number;
  estimatedDeliveryDays?: number;
  isSameDayDeliveryEnabled: boolean;
  isCashOnDeliveryEnabled: boolean;
  /** When true, COD checkout collects shipping via PayFast before order confirmation. */
  collectShippingChargesOnCod: boolean;
  isGoPayFastEnabled: boolean;
  receiptFooterText?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaImageUrl?: string;
  /** Public Meta Pixel ID when tracking is enabled (never includes CAPI token). */
  metaPixelId?: string;
  metaTrackingEnabled?: boolean;
  isPriceChallengeEnabled?: boolean;
}

export interface AbpResponse<T> {
  result: T;
  success?: boolean;
}
