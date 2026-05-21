import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../shared/services/auth.service';
import {
  OnlineShopOrderListItem,
  OnlineShopOrderService
} from '../../shared/services/online-shop-order.service';

@Component({
  selector: 'app-my-orders',
  templateUrl: './my-orders.component.html',
  styleUrls: ['./my-orders.component.scss']
})
export class MyOrdersComponent implements OnInit {
  readonly pageSize = 20;

  orders: OnlineShopOrderListItem[] = [];
  totalCount = 0;
  currentPage = 1;
  loading = false;
  errorMessage = '';

  constructor(
    public auth: AuthService,
    private onlineShopOrder: OnlineShopOrderService
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.loadPage(1);
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  loadPage(page: number): void {
    const email = this.auth.getCustomerEmail();
    if (!email) {
      this.errorMessage = 'Please log in to view your orders.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.currentPage = page;
    const skipCount = (page - 1) * this.pageSize;

    this.onlineShopOrder.getMyOrders(email, skipCount, this.pageSize).subscribe({
      next: (result) => {
        this.loading = false;
        this.orders = result.items;
        this.totalCount = result.totalCount;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.error?.message ||
          err?.error?.message ||
          err?.message ||
          'Could not load your orders.';
      }
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }
    this.loadPage(page);
  }

  goToLogin(): void {
    this.auth.navigateToLogin('/pages/my-orders');
  }

  formatDate(value: string): string {
    if (!value) {
      return '—';
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  statusLabel(order: OnlineShopOrderListItem): string {
    return order.orderStatusDisplayName || order.orderStatusName || '—';
  }
}
