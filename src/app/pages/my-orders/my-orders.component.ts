import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../shared/services/auth.service';
import {
  OnlineShopOrderListItem,
  OnlineShopOrderService,
  OnlineShopOrderSuccessDetail
} from '../../shared/services/online-shop-order.service';
import { ProductService } from '../../shared/services/product.service';

@Component({
  selector: 'app-my-orders',
  templateUrl: './my-orders.component.html',
  styleUrls: ['./my-orders.component.scss']
})
export class MyOrdersComponent implements OnInit {
  readonly pageSize = 20;

  @ViewChild('orderDetailModal') orderDetailModal!: TemplateRef<unknown>;

  orders: OnlineShopOrderListItem[] = [];
  totalCount = 0;
  currentPage = 1;
  loading = false;
  errorMessage = '';

  detailLoading = false;
  detailError = '';
  orderDetail: OnlineShopOrderSuccessDetail | null = null;
  private modalRef: NgbModalRef | null = null;

  constructor(
    public auth: AuthService,
    public productService: ProductService,
    private onlineShopOrder: OnlineShopOrderService,
    private modalService: NgbModal
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

  trackOrder(_order: OnlineShopOrderListItem): void {
    // Placeholder — tracking flow will be added later.
  }

  showDetail(order: OnlineShopOrderListItem): void {
    const email = this.auth.getCustomerEmail();
    if (!email) {
      return;
    }

    this.detailLoading = true;
    this.detailError = '';
    this.orderDetail = null;
    this.modalRef = this.modalService.open(this.orderDetailModal, {
      size: 'lg',
      centered: true,
      scrollable: true
    });

    this.onlineShopOrder.getMyOrderDetail(order.id, email).subscribe({
      next: (detail) => {
        this.orderDetail = detail;
        this.detailLoading = false;
      },
      error: (err) => {
        this.detailLoading = false;
        this.detailError =
          err?.error?.error?.message ||
          err?.error?.message ||
          err?.message ||
          'Could not load order details.';
      }
    });
  }

  closeDetailModal(): void {
    this.modalRef?.close();
    this.modalRef = null;
  }

  formatDate(value: string): string {
    if (!value) {
      return '—';
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  formatShortDate(value: string): string {
    if (!value) {
      return '';
    }
    const d = new Date(value);
    return isNaN(d.getTime())
      ? value
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  statusLabel(order: OnlineShopOrderListItem): string {
    return order.orderStatusDisplayName || order.orderStatusName || '—';
  }

  productImage(url?: string): string {
    return url || 'assets/images/product/1.jpg';
  }
}
