import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../shared/services/auth.service';
import {
  OnlineShopOrderListItem,
  OnlineShopOrderService,
  OnlineShopOrderStatusTimeline,
  OnlineShopOrderSuccessDetail,
  OnlineShopPaymentMethod,
  OnlineShopPaymentStatus,
  ONLINE_SHOP_PAYMENT_STATUS_LABELS,
  OnlineShopShippingMethod,
} from '../../shared/services/online-shop-order.service';
import { ProductService } from '../../shared/services/product.service';
import { PayFastPaymentService } from '../../shop/checkout/pay-fast-payment.service';

@Component({
  selector: 'app-my-orders',
  templateUrl: './my-orders.component.html',
  styleUrls: ['./my-orders.component.scss']
})
export class MyOrdersComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly pageSize = 20;
  readonly orderSearchControl = new FormControl('');

  @ViewChild('orderDetailModal') orderDetailModal!: TemplateRef<unknown>;
  @ViewChild('trackOrderModal') trackOrderModal!: TemplateRef<unknown>;

  orders: OnlineShopOrderListItem[] = [];
  totalCount = 0;
  currentPage = 1;
  loading = false;
  errorMessage = '';

  detailLoading = false;
  detailError = '';
  orderDetail: OnlineShopOrderSuccessDetail | null = null;
  detailShipmentResyncLoading = false;
  retryingOrderId: string | null = null;
  trackingLoading = false;
  trackingError = '';
  orderTimeline: OnlineShopOrderStatusTimeline | null = null;
  trackingOrderNumber = '';
  trackingOrderId: string | null = null;
  receiptLoadingOrderId: string | null = null;
  private modalRef: NgbModalRef | null = null;
  private trackingModalRef: NgbModalRef | null = null;
  private pendingOrderId: string | null = null;
  private viewReady = false;
  private pendingDetailRetryCount = 0;
  private readonly maxPendingDetailRetries = 5;
  private readonly modalOptions = {
    centered: true,
    scrollable: true,
    windowClass: 'my-orders-modal-90',
  };
  private readonly destroy$ = new Subject<void>();

  constructor(
    public auth: AuthService,
    public productService: ProductService,
    private onlineShopOrder: OnlineShopOrderService,
    private payFast: PayFastPaymentService,
    private modalService: NgbModal,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.loadPage(1);
    }

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const orderId = params.get('orderId')?.trim();
        if (orderId && this.isLoggedIn) {
          this.scheduleOrderDetailFromQuery(orderId);
        }
      });

    this.orderSearchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isLoggedIn) {
          this.loadPage(1);
        }
      });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.tryOpenPendingOrderDetail();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

    const keyword = String(this.orderSearchControl.value || '').trim();
    this.onlineShopOrder.getMyOrders(email, skipCount, this.pageSize, keyword || undefined).subscribe({
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

  isReceiptLoading(orderId: string): boolean {
    return this.receiptLoadingOrderId === orderId;
  }

  downloadReceipt(order: OnlineShopOrderListItem): void {
    const email = this.auth.getCustomerEmail();
    if (!email || !order?.id) {
      return;
    }

    this.receiptLoadingOrderId = order.id;
    this.onlineShopOrder.downloadOrderReceiptPdf(order.id, email).subscribe({
      next: (response) => {
        this.receiptLoadingOrderId = null;
        if (!response || response.size === 0) {
          this.toastr.error('Receipt could not be generated.');
          return;
        }

        const blob = new Blob([response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = this.buildReceiptPdfFileName(order);
        anchor.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.receiptLoadingOrderId = null;
        this.toastr.error(this.resolveReceiptErrorMessage(err, 'Could not download receipt.'));
      },
    });
  }

  previewReceipt(order: OnlineShopOrderListItem): void {
    const email = this.auth.getCustomerEmail();
    if (!email || !order?.id) {
      return;
    }

    this.receiptLoadingOrderId = order.id;
    this.onlineShopOrder.previewOrderReceiptPdf(order.id, email).subscribe({
      next: (response) => {
        this.receiptLoadingOrderId = null;
        if (!response || response.size === 0) {
          this.toastr.error('Receipt could not be generated.');
          return;
        }

        const blob = new Blob([response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const previewWindow = window.open(url, '_blank');
        if (!previewWindow) {
          window.URL.revokeObjectURL(url);
          this.toastr.warning('Please allow pop-ups to preview the receipt.');
          return;
        }

        previewWindow.addEventListener('unload', () => window.URL.revokeObjectURL(url));
      },
      error: (err) => {
        this.receiptLoadingOrderId = null;
        this.toastr.error(this.resolveReceiptErrorMessage(err, 'Could not preview receipt.'));
      },
    });
  }

  private buildReceiptPdfFileName(order: OnlineShopOrderListItem): string {
    const orderNumber = (order?.onlineOrderNumber || 'order').trim();
    return `${orderNumber}-Receipt.pdf`;
  }

  private resolveReceiptErrorMessage(err: any, fallback: string): string {
    return (
      err?.error?.error?.message ||
      err?.error?.message ||
      err?.message ||
      fallback
    );
  }

  canTrackOrder(order: OnlineShopOrderListItem): boolean {
    return !!order?.id;
  }

  trackOrder(order: OnlineShopOrderListItem): void {
    if (!this.canTrackOrder(order)) {
      return;
    }

    const email = this.auth.getCustomerEmail();
    if (!email || !order?.id) {
      return;
    }

    this.trackingLoading = true;
    this.trackingError = '';
    this.orderTimeline = null;
    this.trackingOrderNumber = order.onlineOrderNumber;
    this.trackingOrderId = order.id;
    this.trackingModalRef = this.modalService.open(this.trackOrderModal, {
      ...this.modalOptions,
      windowClass: 'my-orders-modal-90 my-orders-tracking-modal',
    });

    this.onlineShopOrder.getMyOrderStatusTimeline(order.id, email).subscribe({
      next: (result) => {
        this.orderTimeline = result;
        this.trackingLoading = false;
      },
      error: (err) => {
        this.trackingLoading = false;
        const msg =
          err?.error?.error?.message ||
          err?.error?.message ||
          err?.message ||
          'Could not load order status history.';
        this.trackingError = msg;
        this.toastr.error(msg);
      }
    });
  }

  closeTrackingModal(): void {
    this.trackingModalRef?.close();
    this.trackingModalRef = null;
    this.trackingOrderId = null;
  }

  timelineStatusLabel(item: { orderStatusDisplayName?: string }): string {
    return item?.orderStatusDisplayName?.trim() || 'Update';
  }

  get chronologicalTimelineItems() {
    if (!this.orderTimeline?.items?.length) {
      return [];
    }
    return [...this.orderTimeline.items].reverse();
  }

  deliveryStatusLabel(status?: string | number | null): string | null {
    if (status == null || status === '') {
      return null;
    }

    if (typeof status === 'string') {
      return status.trim() || null;
    }

    const labels: Record<number, string> = {
      1: 'Not Started',
      2: 'Local Pickup',
      3: 'Pending Shipment',
      4: 'Shipped',
      5: 'Delivered',
      6: 'Returned',
      7: 'Booked',
      8: 'In Process',
      9: 'Cancelled',
    };

    return labels[status] ?? String(status);
  }

  paymentStatusLabel(status?: OnlineShopPaymentStatus | number | null, fallbackName?: string): string {
    if (fallbackName?.trim()) {
      return fallbackName.trim();
    }

    if (status == null) {
      return '—';
    }

    return ONLINE_SHOP_PAYMENT_STATUS_LABELS[status as OnlineShopPaymentStatus] ?? '—';
  }

  hasShipmentSection(detail: OnlineShopOrderSuccessDetail | null): boolean {
    if (!detail) {
      return false;
    }

    if (detail.shippingMethod === OnlineShopShippingMethod.LocalPickup) {
      return false;
    }

    return !!(
      detail.shipment?.hasShipment
      || detail.shipment?.trackingNumber
      || detail.deliveryStatus
    );
  }

  canResyncDetailShipment(): boolean {
    return !!this.orderDetail?.shipment?.canResync;
  }

  resyncDetailShipment(): void {
    const email = this.auth.getCustomerEmail();
    const orderId = this.orderDetail?.onlineShopSaleOrderId;
    if (!email || !orderId || this.detailShipmentResyncLoading) {
      return;
    }

    this.detailShipmentResyncLoading = true;
    this.onlineShopOrder.syncOrderTracking(orderId, email).subscribe({
      next: (result) => {
        this.detailShipmentResyncLoading = false;
        if (this.orderDetail?.shipment) {
          this.orderDetail = {
            ...this.orderDetail,
            deliveryStatus: this.deliveryStatusLabel(result.deliveryStatus) ?? this.orderDetail.deliveryStatus,
            shipment: {
              ...this.orderDetail.shipment,
              trackingNumber: result.trackingNumber ?? this.orderDetail.shipment.trackingNumber,
              courierName: result.courierName ?? this.orderDetail.shipment.courierName,
              deliveryStatus: this.deliveryStatusLabel(result.deliveryStatus) ?? this.orderDetail.shipment.deliveryStatus,
              lastTrackingStatus: result.currentStatus ?? this.orderDetail.shipment.lastTrackingStatus,
              lastTrackingSyncAt: result.lastSyncAt ?? this.orderDetail.shipment.lastTrackingSyncAt,
              canResync: result.canResync ?? this.orderDetail.shipment.canResync,
            },
          };
        }
        this.toastr.success('Shipment tracking updated.');
      },
      error: (err) => {
        this.detailShipmentResyncLoading = false;
        const msg =
          err?.error?.error?.message ||
          err?.error?.message ||
          err?.message ||
          'Could not refresh shipment tracking.';
        this.toastr.error(msg);
      },
    });
  }

  canRetryPayment(order: OnlineShopOrderListItem): boolean {
    if (order.paymentMethod === OnlineShopPaymentMethod.GoPayFast) {
      return order.paymentStatus === OnlineShopPaymentStatus.Failed
        || order.paymentStatus === OnlineShopPaymentStatus.Pending;
    }

    // COD orders that require shipping prepayment via GoPayFast
    if (order.paymentMethod === OnlineShopPaymentMethod.CashOnDelivery) {
      return order.paymentStatus === OnlineShopPaymentStatus.Failed
        || (order.paymentStatus === OnlineShopPaymentStatus.PartiallyPaid && order.paidAmount < order.totalAmount);
    }

    return false;
  }

  isRetrying(orderId: string): boolean {
    return this.retryingOrderId === orderId;
  }

  retryPayment(order: OnlineShopOrderListItem): void {
    if (!order?.id || !this.canRetryPayment(order) || this.retryingOrderId) {
      return;
    }

    this.retryingOrderId = order.id;
    this.payFast.retryCheckout(order.id).subscribe({
      next: (res) => {
        this.retryingOrderId = null;
        this.payFast.redirectToPayFast(res);
      },
      error: (err) => {
        this.retryingOrderId = null;
        const msg = err?.error?.error?.message || err?.error?.message || err?.message;
        this.toastr.error(msg || 'Could not restart payment. Please try again.');
      }
    });
  }

  private scheduleOrderDetailFromQuery(orderId: string): void {
    this.pendingOrderId = orderId;
    this.pendingDetailRetryCount = 0;
    this.tryOpenPendingOrderDetail();
  }

  private tryOpenPendingOrderDetail(): void {
    const orderId = this.pendingOrderId?.trim();
    if (!orderId || !this.isLoggedIn) {
      return;
    }

    if (!this.viewReady) {
      return;
    }

    if (!this.orderDetailModal) {
      if (this.pendingDetailRetryCount < this.maxPendingDetailRetries) {
        this.pendingDetailRetryCount += 1;
        setTimeout(() => this.tryOpenPendingOrderDetail(), 50);
      }
      return;
    }

    this.pendingOrderId = null;
    this.pendingDetailRetryCount = 0;
    this.clearOrderIdQueryParam();
    this.showDetail({ id: orderId } as OnlineShopOrderListItem);
  }

  private clearOrderIdQueryParam(): void {
    if (!this.route.snapshot.queryParamMap.has('orderId')) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { orderId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  showDetail(order: OnlineShopOrderListItem): void {
    const email = this.auth.getCustomerEmail();
    if (!email || !order?.id) {
      return;
    }

    this.closeDetailModal();
    this.detailLoading = true;
    this.detailError = '';
    this.orderDetail = null;
    this.detailShipmentResyncLoading = false;
    this.modalRef = this.modalService.open(this.orderDetailModal, {
      ...this.modalOptions,
      windowClass: 'my-orders-modal-90 my-orders-detail-modal',
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
