import { OnlineShopStorefront } from './online-shop-storefront.model';

/** Resolved tenant + store identity for the active storefront session. */
export interface ShopContext {
  tenancyName: string;
  tenantId: number;
  storeId: string;
  storefront: OnlineShopStorefront | null;
  resolved: boolean;
}
