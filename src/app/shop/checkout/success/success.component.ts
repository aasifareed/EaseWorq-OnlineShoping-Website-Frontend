import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  OnlineShopOrderAppliedDiscount,
  OnlineShopOrderService,
  OnlineShopOrderSuccessDetail
} from '../../../shared/services/online-shop-order.service';
import {
  orderMerchandiseDiscountRows,
  orderShippingBeforeDiscount,
  orderShippingDiscountRows,
  orderSubtotalBeforeDiscounts
} from '../../../shared/services/online-shop-order-summary.util';
import { ProductService } from '../../../shared/services/product.service';
import { MetaTrackingService } from '../../../shared/services/meta-tracking.service';

@Component({
  selector: 'app-success',
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.scss']
})
export class SuccessComponent implements OnInit {

  public order: OnlineShopOrderSuccessDetail | null = null;
  public loading = true;
  public loadError = false;

  constructor(
    public productService: ProductService,
    private route: ActivatedRoute,
    private onlineShopOrder: OnlineShopOrderService,
    private metaTracking: MetaTrackingService,
  ) { }

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.loading = false;
      this.loadError = true;
      return;
    }

    this.productService.clearCheckoutAfterOrder();
    sessionStorage.removeItem('pending_online_shop_order_id');
    sessionStorage.removeItem('pending_online_shop_order_number');

    this.onlineShopOrder.getOrderForSuccessPage(orderId).subscribe({
      next: (detail) => {
        this.order = detail;
        this.loading = false;
        this.loadError = false;
        this.trackPurchase(detail);
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      }
    });
  }

  private trackPurchase(detail: OnlineShopOrderSuccessDetail): void {
    if (!detail?.onlineShopSaleOrderId) {
      return;
    }
    this.metaTracking.trackPurchasePixel({
      orderId: detail.onlineShopSaleOrderId,
      orderNumber: detail.onlineOrderNumber,
      value: Number(detail.totalAmount) || 0,
      lines: (detail.products || [])
        .map((p) => ({
          id: String(p.externalProductId || ''),
          quantity: Number(p.quantity) || 1,
          itemPrice: Number(p.unitPrice) || 0,
          name: p.productName,
        }))
        .filter((l) => !!l.id),
    });
  }

  get orderSubtotal(): number {
    return this.order ? orderSubtotalBeforeDiscounts(this.order) : 0;
  }

  get orderShippingAmount(): number {
    return this.order ? orderShippingBeforeDiscount(this.order) : 0;
  }

  get merchandiseDiscountRows(): OnlineShopOrderAppliedDiscount[] {
    return this.order ? orderMerchandiseDiscountRows(this.order) : [];
  }

  get shippingDiscountRows(): OnlineShopOrderAppliedDiscount[] {
    return this.order ? orderShippingDiscountRows(this.order) : [];
  }

  formatDate(iso: string): string {
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  productImage(url?: string): string {
    return this.productService.normalizeImageUrl(url) || this.productService.defaultProductImage;
  }
}
