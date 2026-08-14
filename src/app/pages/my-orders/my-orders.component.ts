import {
  AfterViewInit,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  TemplateRef,
  ViewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { fromEvent, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../shared/services/auth.service';
import {
  OnlineShopOrderAppliedDiscount,
  OnlineShopOrderListItem,
  OnlineShopOrderService,
  OnlineShopOrderStatusTimeline,
  OnlineShopOrderSuccessDetail,
  OnlineShopPaymentMethod,
  OnlineShopPaymentStatus,
  ONLINE_SHOP_PAYMENT_STATUS_LABELS,
  OnlineShopShippingMethod,
} from '../../shared/services/online-shop-order.service';
import {
  orderMerchandiseDiscountRows,
  orderShippingBeforeDiscount,
  orderShippingDiscountRows,
  orderSubtotalBeforeDiscounts
} from '../../shared/services/online-shop-order-summary.util';
import { ProductService } from '../../shared/services/product.service';
import { SignalRService } from '../../shared/services/signal-r.service';
import { ShopNotificationItem } from '../../shared/models/notification.model';
import { PayFastPaymentService } from '../../shop/checkout/pay-fast-payment.service';
import { statusChipStyle } from '../../shared/utils/color-contrast.util';
import {
  downloadBlobInBrowser,
  isNativeApp,
  previewBlobInBrowser,
  saveAndShareNativePdf,
} from '../../shared/services/native-receipt';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-my-orders',
  templateUrl: './my-orders.component.html',
  styleUrls: ['./my-orders.component.scss']
})
export class MyOrdersComponent implements OnInit, AfterViewInit, OnDestroy {
  pageSize = 6;
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
  removingOrderId: string | null = null;
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
  private readonly isBrowser: boolean;

  constructor(
    public auth: AuthService,
    public productService: ProductService,
    private onlineShopOrder: OnlineShopOrderService,
    private payFast: PayFastPaymentService,
    private modalService: NgbModal,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private router: Router,
    private signalR: SignalRService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.syncPageSizeFromViewport();

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

    this.signalR.orderUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((notification) => this.refreshAfterOrderUpdate(notification));

    this.watchForMissedOrderUpdates();
    this.watchViewportForPageSize();
  }

  /**
   * Phone screens show fewer rows so the table stays short; wide desktops show more.
   * 6 is the default (tablet / typical laptop).
   */
  private resolvePageSize(width: number): number {
    if (width < 576) {
      return 4;
    }
    if (width < 768) {
      return 5;
    }
    if (width < 1200) {
      return 6;
    }
    if (width < 1400) {
      return 8;
    }
    return 10;
  }

  private syncPageSizeFromViewport(reload = false): void {
    if (!this.isBrowser) {
      return;
    }

    const nextSize = this.resolvePageSize(window.innerWidth);
    if (nextSize === this.pageSize) {
      return;
    }

    const firstVisible = this.orders.length
      ? (this.currentPage - 1) * this.pageSize + 1
      : 1;
    this.pageSize = nextSize;

    if (reload && this.isLoggedIn) {
      const nextPage = Math.max(1, Math.ceil(firstVisible / this.pageSize));
      this.loadPage(nextPage, { silent: true });
    }
  }

  private watchViewportForPageSize(): void {
    if (!this.isBrowser) {
      return;
    }

    fromEvent(window, 'resize')
      .pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe(() => this.syncPageSizeFromViewport(true));
  }

  /**
   * Pushed updates only arrive while the hub is connected, so anything the shop changed during a drop
   * would sit unseen until the customer reloaded. Both moments that end such a gap — the hub coming
   * back, and the tab being looked at again after the browser put it to sleep — re-read the rows.
   */
  private watchForMissedOrderUpdates(): void {
    this.signalR.connectionRestored$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.catchUpOnOrders());

    if (!this.isBrowser) {
      return;
    }

    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible'),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.catchUpOnOrders());
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

  /** First row number on the current page, 1-based; 0 when there is nothing to show. */
  get pageRangeStart(): number {
    return this.orders.length ? (this.currentPage - 1) * this.pageSize + 1 : 0;
  }

  /** Counts the rows actually returned, so a short last page reads correctly. */
  get pageRangeEnd(): number {
    return (this.currentPage - 1) * this.pageSize + this.orders.length;
  }

  /**
   * The page buttons to render, windowed around the current page so a long order history cannot
   * produce a strip of numbers wider than the table.
   */
  get pageNumbers(): number[] {
    const total = this.totalPages;
    const maxButtons = 5;
    if (total <= maxButtons) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const half = Math.floor(maxButtons / 2);
    const end = Math.min(total, Math.max(1, this.currentPage - half) + maxButtons - 1);
    const start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  /**
   * A silent load refreshes the rows in place: no spinner and no error banner, because it is the page
   * catching up on a status change the customer never asked for and a failed background attempt should
   * leave the orders they can already see alone.
   */
  loadPage(page: number, options: { silent?: boolean } = {}): void {
    const email = this.auth.getCustomerEmail();
    if (!email) {
      this.errorMessage = 'Please log in to view your orders.';
      return;
    }

    const silent = options.silent === true;
    if (!silent) {
      this.loading = true;
      this.errorMessage = '';
    }

    this.currentPage = page;
    const skipCount = (page - 1) * this.pageSize;

    const keyword = String(this.orderSearchControl.value || '').trim();
    this.onlineShopOrder
      .getMyOrders(email, skipCount, this.pageSize, keyword || undefined, silent)
      .subscribe({
        next: (result) => {
          this.loading = false;
          this.orders = result.items;
          this.totalCount = result.totalCount;
        },
        error: (err) => {
          this.loading = false;
          if (silent) {
            return;
          }

          this.errorMessage =
            err?.error?.error?.message ||
            err?.error?.message ||
            err?.message ||
            'Could not load your orders.';
        }
      });
  }

  /**
   * The alert carries the new status text but not the badge colour, amounts or payment state, so the
   * order is re-read rather than patched from it.
   */
  private refreshAfterOrderUpdate(notification: ShopNotificationItem): void {
    this.catchUpOnOrders(notification?.sourceId?.trim() || undefined);
  }

  /**
   * Re-reads the visible orders, keeping the page, search and pagination the customer chose. Given an
   * order id, only a modal showing that order is refreshed with it; without one — a reconnect, where
   * we cannot know what we missed — whatever is open is refreshed too.
   */
  private catchUpOnOrders(updatedOrderId?: string): void {
    if (!this.isLoggedIn) {
      return;
    }

    this.loadPage(this.currentPage, { silent: true });

    const openDetailId = this.orderDetail?.onlineShopSaleOrderId;
    if (openDetailId && (!updatedOrderId || this.isSameOrder(openDetailId, updatedOrderId))) {
      this.refreshOpenOrderDetail(openDetailId);
    }

    if (this.trackingOrderId && (!updatedOrderId || this.isSameOrder(this.trackingOrderId, updatedOrderId))) {
      this.refreshOpenOrderTimeline(this.trackingOrderId);
    }
  }

  private refreshOpenOrderDetail(orderId: string): void {
    const email = this.auth.getCustomerEmail();
    if (!email) {
      return;
    }

    this.onlineShopOrder.getMyOrderDetail(orderId, email, true).subscribe({
      next: (detail) => {
        // Guard against the customer having moved on while the request was in flight.
        if (this.isSameOrder(this.orderDetail?.onlineShopSaleOrderId, orderId)) {
          this.orderDetail = detail;
        }
      },
      error: () => undefined
    });
  }

  private refreshOpenOrderTimeline(orderId: string): void {
    const email = this.auth.getCustomerEmail();
    if (!email) {
      return;
    }

    this.onlineShopOrder.getMyOrderStatusTimeline(orderId, email, true).subscribe({
      next: (timeline) => {
        if (this.isSameOrder(this.trackingOrderId, orderId)) {
          this.orderTimeline = timeline;
        }
      },
      error: () => undefined
    });
  }

  /** Ids travel as text through the hub and the API, so casing cannot be relied on. */
  private isSameOrder(left?: string | null, right?: string | null): boolean {
    const a = left?.trim().toLowerCase();
    const b = right?.trim().toLowerCase();
    return !!a && a === b;
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
        void this.openReceiptPdf(response, order, 'download');
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
        void this.openReceiptPdf(response, order, 'preview');
      },
      error: (err) => {
        this.receiptLoadingOrderId = null;
        this.toastr.error(this.resolveReceiptErrorMessage(err, 'Could not preview receipt.'));
      },
    });
  }

  private async openReceiptPdf(
    response: Blob,
    order: OnlineShopOrderListItem,
    mode: 'download' | 'preview',
  ): Promise<void> {
    this.receiptLoadingOrderId = null;
    if (!response || response.size === 0) {
      this.toastr.error('Receipt could not be generated.');
      return;
    }

    const blob = new Blob([response], { type: 'application/pdf' });
    const fileName = this.buildReceiptPdfFileName(order);

    if (isNativeApp()) {
      try {
        const dialogTitle = mode === 'preview' ? 'Preview Receipt' : 'Download Receipt';
        const { savedPath } = await saveAndShareNativePdf(blob, fileName, dialogTitle);
        this.toastr.success(
          mode === 'preview'
            ? 'Choose an app to open the receipt.'
            : `Receipt saved to ${savedPath}.`,
        );
      } catch (err) {
        this.toastr.error(
          this.resolveReceiptErrorMessage(
            err,
            mode === 'preview' ? 'Could not preview receipt.' : 'Could not download receipt.',
          ),
        );
      }
      return;
    }

    if (mode === 'download') {
      downloadBlobInBrowser(blob, fileName);
      return;
    }

    if (!previewBlobInBrowser(blob)) {
      this.toastr.warning('Please allow pop-ups to preview the receipt.');
    }
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
    const chronological = [...this.orderTimeline.items].reverse();
    // Collapse consecutive repeated statuses so each status appears only once
    // when it actually changes (avoids duplicate steps on the tracking screen).
    return chronological.filter((item, index) => {
      if (index === 0) {
        return true;
      }
      const prev = chronological[index - 1];
      const key = (item.orderStatusDisplayName ?? '').trim().toLowerCase();
      const prevKey = (prev.orderStatusDisplayName ?? '').trim().toLowerCase();
      return key !== prevKey;
    });
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

  get orderDetailSubtotal(): number {
    return this.orderDetail ? orderSubtotalBeforeDiscounts(this.orderDetail) : 0;
  }

  get orderDetailShipping(): number {
    return this.orderDetail ? orderShippingBeforeDiscount(this.orderDetail) : 0;
  }

  get orderDetailMerchandiseDiscounts(): OnlineShopOrderAppliedDiscount[] {
    return this.orderDetail ? orderMerchandiseDiscountRows(this.orderDetail) : [];
  }

  get orderDetailShippingDiscounts(): OnlineShopOrderAppliedDiscount[] {
    return this.orderDetail ? orderShippingDiscountRows(this.orderDetail) : [];
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

  /**
   * An order that has been cancelled, returned or refunded can never take another payment, even though
   * its payment status may still read Pending from before it was closed.
   *
   * Order statuses are configured per store, so the name is what identifies a cancellation here.
   */
  private isClosedForPayment(order: OnlineShopOrderListItem): boolean {
    if (
      order.paymentStatus === OnlineShopPaymentStatus.Cancelled
      || order.paymentStatus === OnlineShopPaymentStatus.Refunded
      || order.paymentStatus === OnlineShopPaymentStatus.PartiallyRefunded
    ) {
      return true;
    }

    const orderStatus = `${order.orderStatusDisplayName ?? ''} ${order.orderStatusName ?? ''}`.toLowerCase();
    if (orderStatus.includes('cancel')) {
      return true;
    }

    const deliveryStatus = (this.deliveryStatusLabel(order.deliveryStatus) ?? '').toLowerCase();
    return deliveryStatus.includes('cancel') || deliveryStatus.includes('return');
  }

  canRetryPayment(order: OnlineShopOrderListItem): boolean {
    if (this.isClosedForPayment(order)) {
      return false;
    }

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

  isRemoving(orderId: string): boolean {
    return this.removingOrderId === orderId;
  }

  /**
   * Hides the order from My Orders only. The store still has it for fulfilment and support.
   */
  async removeFromList(order: OnlineShopOrderListItem): Promise<void> {
    const email = this.auth.getCustomerEmail();
    if (!order?.id || !email || this.removingOrderId) {
      return;
    }

    const orderLabel = order.onlineOrderNumber || 'this order';
    const result = await Swal.fire({
      title: 'Remove from list?',
      html: `<p style="margin:0 0 0.5rem;">Remove <strong>${this.escapeHtml(orderLabel)}</strong> from your orders list?</p>
             <p style="margin:0;font-size:0.9rem;opacity:0.85;">You can still contact support about it. This does not cancel the order.</p>`,
      icon: 'warning',
      showCancelButton: true,
      focusCancel: true,
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: 'my-orders-swal',
        confirmButton: 'btn btn-danger my-orders-swal__confirm',
        cancelButton: 'btn btn-outline-secondary my-orders-swal__cancel',
      },
    });

    if (!result.isConfirmed) {
      return;
    }

    this.removingOrderId = order.id;
    this.onlineShopOrder.hideMyOrder(order.id, email).subscribe({
      next: () => {
        this.removingOrderId = null;
        this.toastr.success(`${orderLabel} removed from your list.`);
        const nextPage = this.orders.length === 1 && this.currentPage > 1
          ? this.currentPage - 1
          : this.currentPage;
        this.loadPage(nextPage);
      },
      error: (err) => {
        this.removingOrderId = null;
        const msg = err?.error?.error?.message || err?.error?.message || err?.message;
        this.toastr.error(msg || 'Could not remove this order. Please try again.');
      }
    });
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  formatListDate(value: string): string {
    if (!value) {
      return '—';
    }
    const d = new Date(value);
    return isNaN(d.getTime())
      ? value
      : d.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
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

  statusChipStyles(colorCode?: string | null): { backgroundColor: string; color: string } {
    return statusChipStyle(colorCode);
  }

  productImage(url?: string): string {
    return this.productService.normalizeImageUrl(url) || this.productService.defaultProductImage;
  }
}
