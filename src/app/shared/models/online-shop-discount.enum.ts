/**
 * Wire values for the discount engine, matching the backend constants OnlineShopCouponTypes and
 * OnlineShopShippingRuleTypes. The API compares these exact strings, so a typo here silently stops a
 * deal from being recognised rather than failing loudly.
 */
export enum CouponType {
  Percentage = 'percentage',
  Fixed = 'fixed',
  FreeShipping = 'free_shipping',
}

/**
 * What a discount reduces, matching the backend OnlineShopDiscountScopes. A cart may hold one
 * effective coupon per scope.
 */
export enum DiscountScope {
  Product = 'product',
  Order = 'order',
  Shipping = 'shipping',
}

/** Whether a delivery deal bands on order value or on billable weight. */
export enum ShippingRuleType {
  BaseOnPrice = 'base_on_price',
  BaseOnWeight = 'base_on_weight',
}
