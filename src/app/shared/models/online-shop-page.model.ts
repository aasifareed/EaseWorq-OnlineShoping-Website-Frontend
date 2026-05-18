export interface OnlineShopPagePublic {
  title: string;
  slug: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  metaImageUrl?: string;
}

export interface OnlineShopPageMenuItem {
  title: string;
  slug: string;
}

export interface AbpResponse<T> {
  result: T;
  success: boolean;
}
