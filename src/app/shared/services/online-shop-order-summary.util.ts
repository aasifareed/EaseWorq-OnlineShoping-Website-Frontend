import {
  OnlineShopOrderAppliedDiscount,
  OnlineShopOrderSuccessDetail
} from './online-shop-order.service';

/**
 * Reads the order summary the way every customer-facing surface needs it.
 *
 * Orders placed before pricing was centralised have no breakdown columns and no discount rows: they
 * only ever stored the charged subtotal, the charged shipping and a single coupon discount. Each
 * helper falls back to those older columns so a historical order still renders the figures it was
 * actually placed with, rather than zeros.
 */

/** Merchandise at list price. Older orders only recorded the already-discounted subtotal. */
export function orderSubtotalBeforeDiscounts(order: OnlineShopOrderSuccessDetail): number {
  return order.originalSubTotalAmount > 0 ? order.originalSubTotalAmount : order.subTotalAmount;
}

/** The courier rate before any delivery promotion. Older orders only recorded what was charged. */
export function orderShippingBeforeDiscount(order: OnlineShopOrderSuccessDetail): number {
  return order.originalShippingAmount > 0 ? order.originalShippingAmount : order.shippingCharges;
}

/** Product and order discounts, each with the label the pricing engine gave it. */
export function orderMerchandiseDiscountRows(
  order: OnlineShopOrderSuccessDetail
): OnlineShopOrderAppliedDiscount[] {
  const rows = discountRowsForScope(order, (scope) => scope !== 'shipping');
  if (rows.length || !(order.discountAmount > 0)) {
    return rows;
  }

  // Pre-conversion order: its one discount figure was the coupon.
  return [{
    scope: 'order',
    description: 'Discount',
    discountAmount: order.discountAmount,
    sortOrder: 0
  }];
}

/** Delivery promotions. Always empty for pre-conversion orders, which stored no such row. */
export function orderShippingDiscountRows(
  order: OnlineShopOrderSuccessDetail
): OnlineShopOrderAppliedDiscount[] {
  return discountRowsForScope(order, (scope) => scope === 'shipping');
}

function discountRowsForScope(
  order: OnlineShopOrderSuccessDetail,
  matches: (scope: string) => boolean
): OnlineShopOrderAppliedDiscount[] {
  return (order.appliedDiscounts ?? [])
    .filter((d) => matches(d.scope) && d.discountAmount > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
