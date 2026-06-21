import { Product } from '../classes/product';

/** API row for online-shop inventory (subset used on home sliders). */
export interface AvailableProductInventoryDtoForOnlineShop {
  id: string;
  productId?: string;
  productIdTag?: string;
  productName?: string;
  brandId?: string;
  brandName?: string;
  productSize?: number;
  productColor?: string;
  productDescription?: string;
  actualSellPrice?: number;
  productMSRP?: number;
  discountOnProduct?: number;
  categoryName?: string;
  categoryId?: string;
  storeId?: string;
  storeName?: string;
  isFavouriteProduct?: boolean;
  /** True when product was created within the last 7 days. */
  isNew?: boolean;
  productTaxesId?: string[];
  pictureUrl?: string;
  pictureUrls?: string[];
  productUnitStock?: number;
  productTotalQuantity?: number;
  productQuantityPerUnit?: number;
  isAvailable?: boolean;
}

export interface HomeCategorySliderDto {
  categoryId: string;
  categoryName: string;
  seeMoreUrl?: string;
  products: AvailableProductInventoryDtoForOnlineShop[];
}

/** View model for home page slider binding. */
export interface HomeCategorySliderView {
  categoryId: string;
  categoryName: string;
  products: Product[];
}
