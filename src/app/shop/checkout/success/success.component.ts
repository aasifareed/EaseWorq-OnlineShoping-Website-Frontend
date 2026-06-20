import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  OnlineShopOrderService,
  OnlineShopOrderSuccessDetail
} from '../../../shared/services/online-shop-order.service';
import { ProductService } from '../../../shared/services/product.service';

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
    private onlineShopOrder: OnlineShopOrderService
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
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      }
    });
  }

  formatDate(iso: string): string {
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  productImage(url?: string): string {
    return url || 'assets/images/product/1.jpg';
  }
}
