import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  OnlineShopOrderService,
  OnlineShopPaymentFailureDetail
} from '../../../shared/services/online-shop-order.service';
import { ProductService } from '../../../shared/services/product.service';
import { PayFastPaymentService } from '../pay-fast-payment.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-failure',
  templateUrl: './failure.component.html',
  styleUrls: ['./failure.component.scss']
})
export class FailureComponent implements OnInit {

  public order: OnlineShopPaymentFailureDetail | null = null;
  public loading = true;
  public loadError = false;
  public retrying = false;
  public notFound = false;

  constructor(
    public productService: ProductService,
    private route: ActivatedRoute,
    private onlineShopOrder: OnlineShopOrderService,
    private payFast: PayFastPaymentService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.loading = false;
      this.notFound = true;
      this.loadError = true;
      return;
    }

    this.onlineShopOrder.getOrderForPaymentFailurePage(orderId).subscribe({
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

  retryPayment(): void {
    if (!this.order?.onlineShopSaleOrderId || !this.order.canRetryPayment || this.retrying) {
      return;
    }

    this.retrying = true;
    this.payFast.retryCheckout(this.order.onlineShopSaleOrderId).subscribe({
      next: (res) => {
        this.retrying = false;
        this.payFast.redirectToPayFast(res);
      },
      error: (err) => {
        this.retrying = false;
        const msg = err?.error?.error?.message || err?.error?.message || err?.message;
        this.toastr.error(msg || 'Could not restart payment. Please try again.');
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

  formatDateTime(iso?: string): string {
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  productImage(url?: string): string {
    return url || 'assets/images/product/1.jpg';
  }
}
