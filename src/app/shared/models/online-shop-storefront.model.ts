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
  defaultDeliveryCharges?: number;
  freeDeliveryMinimumOrderAmount?: number;
  estimatedDeliveryDays?: number;
  isSameDayDeliveryEnabled: boolean;
  isCashOnDeliveryEnabled: boolean;
  isGoPayFastEnabled: boolean;
  receiptFooterText?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaImageUrl?: string;
}

export interface AbpResponse<T> {
  result: T;
  success?: boolean;
}
