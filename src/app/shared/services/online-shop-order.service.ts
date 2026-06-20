import { Injectable } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable, throwError } from 'rxjs';

import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

import { Product } from '../classes/product';

import { AuthService } from './auth.service';
import { AppliedShopCouponState } from './online-shop-checkout.service';



/** Matches backend OnlineShopPaymentMethodEnum */

export enum OnlineShopPaymentMethod {

  CashOnDelivery = 1,

  GoPayFast = 2

}

/** Matches backend OnlineShopPaymentStatusEnum */
export enum OnlineShopPaymentStatus {
  Pending = 1,
  Paid = 2,
  PartiallyPaid = 3,
  OverPaid = 4,
  Failed = 5,
  Cancelled = 6,
  Refunded = 7,
  PartiallyRefunded = 8
}



/** Matches backend OnlineShopShippingMethodEnum */

export enum OnlineShopShippingMethod {

  LocalPickup = 1,

  Shipping = 2

}



export const ONLINE_SHOP_PAYMENT_METHOD_LABELS: Record<OnlineShopPaymentMethod, string> = {

  [OnlineShopPaymentMethod.CashOnDelivery]: 'Cash on Delivery',

  [OnlineShopPaymentMethod.GoPayFast]: 'PayFast'

};



export const ONLINE_SHOP_SHIPPING_METHOD_LABELS: Record<OnlineShopShippingMethod, string> = {

  [OnlineShopShippingMethod.LocalPickup]: 'Local Pickup',

  [OnlineShopShippingMethod.Shipping]: 'Shipping'

};

export const ONLINE_SHOP_PAYMENT_STATUS_LABELS: Record<OnlineShopPaymentStatus, string> = {
  [OnlineShopPaymentStatus.Pending]: 'Pending',
  [OnlineShopPaymentStatus.Paid]: 'Paid',
  [OnlineShopPaymentStatus.PartiallyPaid]: 'Partially Paid',
  [OnlineShopPaymentStatus.OverPaid]: 'Over Paid',
  [OnlineShopPaymentStatus.Failed]: 'Failed',
  [OnlineShopPaymentStatus.Cancelled]: 'Cancelled',
  [OnlineShopPaymentStatus.Refunded]: 'Refunded',
  [OnlineShopPaymentStatus.PartiallyRefunded]: 'Partially Refunded',
};



export interface CreateOnlineShopSaleOrderProductLine {

  externalProductId: string;

  externalProductInventoryId: string;

  quantity: number;

}



export interface OnlineShopSaleOrderAddress {

  customerName: string;

  phone: string;

  emailAddress: string;

  address: string;

  townCity: string;

  stateCounty: string;

  postalCode: string;

}



export interface CreateOnlineShopSaleOrderRequest {

  storeId: string;

  userEmail: string;

  billingAddress: OnlineShopSaleOrderAddress;

  shippingAddress: OnlineShopSaleOrderAddress;

  description?: string;

  shippingMethod: OnlineShopShippingMethod;

  paymentMethod: OnlineShopPaymentMethod;

  products: CreateOnlineShopSaleOrderProductLine[];

  /** Applied coupon code (for order note / usage tracking). */
  couponCode?: string | null;

  /** Coupon discount from checkout ApplyCoupon API. */
  couponDiscountAmount?: number;

  /** Final shipping from checkout GetShippingRate API (0 for local pickup). */
  shippingCharges?: number;

  /** Total cart weight in KG for courier rate-card calculation. */
  cartWeight?: number;

  /** Customer-selected courier from checkout shipping options. */
  selectedCourierCompany?: string | null;
  selectedCourierServiceType?: string | null;

}

export interface CheckoutOrderAmounts {
  couponDiscountAmount: number;
  shippingCharges: number;
  selectedCourierCompany?: string | null;
  selectedCourierServiceType?: string | null;
}



export interface OnlineShopOrderSuccessProduct {
  productName: string;
  productImageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OnlineShopOrderReceipt {
  orderId: string;
  orderNumber: string;
  fileName: string;
  htmlContent: string;
}

export interface OnlineShopOrderListItem {
  id: string;
  onlineOrderNumber: string;
  orderDate: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: number;
  deliveryStatus?: string | number | null;
  paymentMethod: number;
  shippingMethod?: OnlineShopShippingMethod;
  hasShipment?: boolean;
  trackingNumber?: string;
  courierName?: string;
  trackShipment?: boolean;
  lastTrackingStatus?: string;
  lastTrackingSyncAt?: string;
  customerName?: string;
  phone?: string;
  orderStatusId: string;
  orderStatusName?: string;
  orderStatusDisplayName?: string;
  orderStatusColorCode?: string;
}

export interface OnlineShopSaleOrderShipmentSummary {
  hasShipment: boolean;
  trackingNumber?: string;
  courierName?: string;
  courierProvider?: string;
  deliveryStatus?: string;
  lastTrackingStatus?: string;
  lastTrackingSyncAt?: string;
  trackShipment?: boolean;
  canResync?: boolean;
}

export interface OnlineShopOrderStatusTimelineItem {
  changedAt: string;
  orderStatusDisplayName?: string;
  orderStatusColorCode?: string;
  paymentStatusName?: string;
  oldPaymentStatusName?: string;
  deliveryStatus?: string;
  oldDeliveryStatus?: string;
  remarks?: string;
}

export interface OnlineShopOrderStatusTimeline {
  onlineOrderNumber: string;
  currentOrderStatusDisplayName?: string;
  currentOrderStatusColorCode?: string;
  currentPaymentStatusName?: string;
  currentDeliveryStatus?: string;
  items: OnlineShopOrderStatusTimelineItem[];
}

export interface OnlineShopShipmentTrackingHistoryItem {
  status?: string;
  location?: string;
  remarks?: string;
  creationTime?: string;
}

export interface TrackOnlineShopOrderResult {
  success: boolean;
  trackingNumber?: string;
  courierProvider?: string;
  courierName?: string;
  currentStatus?: string;
  deliveryStatus?: string | number;
  lastSyncAt?: string;
  trackShipment?: boolean;
  canResync?: boolean;
  history: OnlineShopShipmentTrackingHistoryItem[];
}

export interface PagedOnlineShopOrders {
  totalCount: number;
  items: OnlineShopOrderListItem[];
}

export interface OnlineShopOrderSuccessDetail {
  onlineShopSaleOrderId: string;
  onlineOrderNumber: string;
  orderDate: string;
  expectedDeliveryDate: string;
  subTotalAmount: number;
  shippingCharges: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  shippingMethod: OnlineShopShippingMethod;
  shippingMethodName: string;
  paymentMethod: OnlineShopPaymentMethod;
  paymentMethodName: string;
  orderStatusId?: string;
  orderStatusDisplayName?: string;
  orderStatusColorCode?: string;
  paymentStatus?: OnlineShopPaymentStatus;
  paymentStatusName?: string;
  deliveryStatus?: string;
  paidAmount?: number;
  remainingAmount?: number;
  shipment?: OnlineShopSaleOrderShipmentSummary;
  products: OnlineShopOrderSuccessProduct[];
  billingAddress?: OnlineShopSaleOrderAddress;
  shippingAddress?: OnlineShopSaleOrderAddress;
}

export interface OnlineShopPaymentFailureDetail extends OnlineShopOrderSuccessDetail {
  gatewayResponseCode?: string;
  gatewayResponseMessage?: string;
  paymentFailedAt?: string;
  amountDueNow: number;
  canRetryPayment: boolean;
}

export interface CreateOnlineShopSaleOrderResponse {

  onlineShopSaleOrderId: string;

  onlineOrderNumber: string;

  totalAmount: number;

  /** Amount to pay online now (full total or COD shipping prepayment). */
  amountDueNow?: number;

  /** COD order that requires shipping payment via PayFast before confirmation. */
  requiresOnlineShippingPayment?: boolean;

  paymentMethod: number;

  paymentStatus: number;

  orderStatusId: string;

  orderStatusName?: string;

  orderStatusDisplayName?: string;

  orderStatusColorCode?: string;

  redirectUrl?: string;

  transactionReference?: string;

  message?: string;

}



export interface CheckoutAddressFormValues {

  customerName: string;

  customerMobileNo: string;

  customerEmail: string;

  address: string;

  town: string;

  state: string;

  postalcode: string;

}



export interface CheckoutFormValues {

  billing: CheckoutAddressFormValues;

  shipping?: CheckoutAddressFormValues;

  shipToDifferentAddress?: boolean;

  description?: string;

  shippingMethod: OnlineShopShippingMethod;

  paymentMethod: OnlineShopPaymentMethod;

}



@Injectable({

  providedIn: 'root'

})

export class OnlineShopOrderService {

  private static readonly PENDING_ORDER_KEY = 'pending_online_shop_order_id';

  private static readonly PENDING_ORDER_NO_KEY = 'pending_online_shop_order_number';



  constructor(private http: HttpClient, private auth: AuthService) {}



  private apiRoot(): string {

    const b = environment.baseUrl || '';

    return b.endsWith('/') ? b : `${b}/`;

  }



  createOrder(request: CreateOnlineShopSaleOrderRequest): Observable<CreateOnlineShopSaleOrderResponse> {

    const path = environment.urls?.OnlineShopSaleOrder_CreateOnlineShopSaleOrder

      || 'OnlineShopSaleOrder/CreateOnlineShopSaleOrder';

    const url = `${this.apiRoot()}api/services/app/${path}`;

    return this.http.post<any>(url, request).pipe(

      map((body) => this.normalizeOrderResponse(body?.result ?? body))

    );

  }

  getOrderForSuccessPage(orderId: string): Observable<OnlineShopOrderSuccessDetail> {
    const path = environment.urls?.OnlineShopSaleOrder_GetForSuccessPage
      || 'OnlineShopSaleOrder/GetOnlineShopSaleOrderForSuccessPage';
    const url = `${this.apiRoot()}api/services/app/${path}?onlineShopSaleOrderId=${encodeURIComponent(orderId)}`;
    return this.http.get<any>(url).pipe(
      map((body) => this.normalizeSuccessDetail(body?.result ?? body))
    );
  }

  getOrderForPaymentFailurePage(orderId: string): Observable<OnlineShopPaymentFailureDetail> {
    const path = environment.urls?.OnlineShopSaleOrder_GetForFailurePage
      || 'OnlineShopSaleOrder/GetOnlineShopSaleOrderForPaymentFailurePage';
    const url = `${this.apiRoot()}api/services/app/${path}?onlineShopSaleOrderId=${encodeURIComponent(orderId)}`;
    return this.http.get<any>(url).pipe(
      map((body) => this.normalizeFailureDetail(body?.result ?? body))
    );
  }

  getOrderReceiptHtml(orderId: string, customerEmail: string): Observable<OnlineShopOrderReceipt> {
    const path =
      environment.urls?.OnlineShopSaleOrder_GetOrderReceipt ||
      'OnlineShopSaleOrder/GetMyOrderReceiptHtml';
    const params = new HttpParams()
      .set('OnlineShopSaleOrderId', orderId)
      .set('StoreId', this.auth.storeId)
      .set('CustomerEmail', customerEmail.trim());
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.get<any>(url, { params }).pipe(
      map((body) => this.normalizeOrderReceipt(body?.result ?? body))
    );
  }

  downloadOrderReceiptPdf(orderId: string, customerEmail: string): Observable<Blob> {
    const path =
      environment.urls?.OnlineShopSaleOrder_DownloadOrderReceiptPdf ||
      'OnlineShopSaleOrder/DownloadMyOrderReceiptPdf';
    const params = new HttpParams()
      .set('OnlineShopSaleOrderId', orderId)
      .set('StoreId', this.auth.storeId)
      .set('CustomerEmail', customerEmail.trim());
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http
      .get(url, { params, responseType: 'blob' })
      .pipe(catchError((err) => this.handleBlobError(err)));
  }

  previewOrderReceiptPdf(orderId: string, customerEmail: string): Observable<Blob> {
    const path =
      environment.urls?.OnlineShopSaleOrder_PreviewOrderReceiptPdf ||
      'OnlineShopSaleOrder/PreviewMyOrderReceiptPdf';
    const params = new HttpParams()
      .set('OnlineShopSaleOrderId', orderId)
      .set('StoreId', this.auth.storeId)
      .set('CustomerEmail', customerEmail.trim());
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http
      .get(url, { params, responseType: 'blob' })
      .pipe(catchError((err) => this.handleBlobError(err)));
  }

  getMyOrderDetail(
    orderId: string,
    customerEmail: string
  ): Observable<OnlineShopOrderSuccessDetail> {
    const path =
      environment.urls?.OnlineShopSaleOrder_GetMyOrderDetail ||
      'OnlineShopSaleOrder/GetMyOnlineShopSaleOrderDetailForCustomer';
    const params = new HttpParams()
      .set('OnlineShopSaleOrderId', orderId)
      .set('StoreId', this.auth.storeId)
      .set('CustomerEmail', customerEmail.trim());
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.get<any>(url, { params }).pipe(
      map((body) => this.normalizeSuccessDetail(body?.result ?? body))
    );
  }

  getMyOrderStatusTimeline(
    orderId: string,
    customerEmail: string,
  ): Observable<OnlineShopOrderStatusTimeline> {
    const path = environment.urls?.OnlineShopSaleOrder_GetMyOrderStatusTimeline
      || 'OnlineShopSaleOrder/GetMyOnlineShopOrderStatusTimelineForCustomer';
    let params = new HttpParams()
      .set('OnlineShopSaleOrderId', orderId)
      .set('StoreId', this.auth.storeId)
      .set('CustomerEmail', customerEmail.trim());
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.get<any>(url, { params }).pipe(
      map((body) => this.normalizeOrderStatusTimeline(body?.result ?? body))
    );
  }

  trackOrder(orderId: string, customerEmail: string): Observable<TrackOnlineShopOrderResult> {
    const path = environment.urls?.OnlineShopShipment_TrackOrder || 'OnlineShopShipment/TrackOrder';
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.post<any>(url, {
      onlineShopSaleOrderId: orderId,
      customerEmail: customerEmail.trim(),
      storeId: this.auth.storeId
    }).pipe(
      map((body) => this.normalizeTrackResult(body?.result ?? body))
    );
  }

  syncOrderTracking(orderId: string, customerEmail: string): Observable<TrackOnlineShopOrderResult> {
    const path =
      environment.urls?.OnlineShopShipment_ResyncOrderTracking
      || environment.urls?.OnlineShopShipment_SyncOrderTracking
      || 'OnlineShopShipment/ResyncOrderTracking';
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.post<any>(url, {
      onlineShopSaleOrderId: orderId,
      customerEmail: customerEmail.trim(),
      storeId: this.auth.storeId
    }).pipe(
      map((body) => this.normalizeTrackResult(body?.result ?? body))
    );
  }

  getMyOrders(
    customerEmail: string,
    skipCount: number,
    maxResultCount = 20,
    keyword?: string,
  ): Observable<PagedOnlineShopOrders> {
    const path = environment.urls?.OnlineShopSaleOrder_GetMyOrders
      || 'OnlineShopSaleOrder/GetMyOnlineShopSaleOrdersForCustomer';
    let params = new HttpParams()
      .set('StoreId', this.auth.storeId)
      .set('CustomerEmail', customerEmail.trim())
      .set('SkipCount', String(skipCount))
      .set('MaxResultCount', String(maxResultCount));
    const kw = (keyword || '').trim();
    if (kw) {
      params = params.set('Keyword', kw);
    }
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.get<any>(url, { params }).pipe(
      map((resp) => this.normalizePagedOrders(resp?.result ?? resp))
    );
  }

  buildCreateOrderRequest(

    form: CheckoutFormValues,

    cartProducts: Product[],

    paymentMethod: OnlineShopPaymentMethod,

    appliedCoupon?: AppliedShopCouponState | null,

    checkoutAmounts?: CheckoutOrderAmounts

  ): CreateOnlineShopSaleOrderRequest {

    const billing = this.mapAddressFormToDto(form.billing);

    const shipping = form.shipToDifferentAddress && form.shipping

      ? this.mapAddressFormToDto(form.shipping)

      : billing;



    const products = cartProducts.map((p) => {
      const inventoryId = String(p.id ?? '').trim();
      const catalogProductId = String(p.productId ?? '').trim();

      if (!catalogProductId || !inventoryId) {
        throw new Error('Invalid cart item. Please remove this product and add it again.');
      }

      if (catalogProductId === inventoryId) {
        console.warn('Invalid cart mapping: productId equals inventoryId', {
          productId: catalogProductId,
          productInventoryId: inventoryId,
          title: p.title,
        });
        throw new Error('Invalid cart item. Please remove this product and add it again.');
      }

      return {
        externalProductId: catalogProductId,
        externalProductInventoryId: inventoryId,
        quantity: Number(p.quantity) > 0 ? Number(p.quantity) : 1,
      };
    });



    const userEmail = this.auth.getCustomerEmail();
    if (!userEmail) {
      throw new Error('Please sign in to place an order.');
    }

    const couponCode =
      appliedCoupon?.result?.isValid && appliedCoupon.couponCode
        ? appliedCoupon.couponCode.trim()
        : null;

    const couponDiscountAmount = checkoutAmounts?.couponDiscountAmount ?? 0;
    const shippingCharges = checkoutAmounts?.shippingCharges ?? 0;

    return {

      storeId: this.auth.storeId,

      userEmail,

      billingAddress: billing,

      shippingAddress: shipping,

      description: form.description?.trim() ?? '',

      shippingMethod: form.shippingMethod,

      paymentMethod,

      products,

      couponCode,

      couponDiscountAmount,

      shippingCharges,

      cartWeight: this.calculateCartWeightKg(cartProducts),

      selectedCourierCompany: checkoutAmounts?.selectedCourierCompany ?? null,

      selectedCourierServiceType: checkoutAmounts?.selectedCourierServiceType ?? null

    };

  }



  rememberPendingOrder(order: CreateOnlineShopSaleOrderResponse): void {

    try {

      sessionStorage.setItem(OnlineShopOrderService.PENDING_ORDER_KEY, order.onlineShopSaleOrderId);

      sessionStorage.setItem(OnlineShopOrderService.PENDING_ORDER_NO_KEY, order.onlineOrderNumber ?? '');

    } catch {

      /* ignore */

    }

  }



  /** Default 0.5 kg per item when product weight is unavailable. */
  calculateCartWeightKg(cartProducts: Product[]): number {
    const totalPieces = cartProducts.reduce(
      (sum, p) => sum + (Number(p.quantity) > 0 ? Number(p.quantity) : 1),
      0
    );
    return Math.max(0.5, Math.round(totalPieces * 0.5 * 100) / 100);
  }

  private mapAddressFormToDto(form: CheckoutAddressFormValues): OnlineShopSaleOrderAddress {

    return {

      customerName: form.customerName?.trim() ?? '',

      phone: form.customerMobileNo?.trim() ?? '',

      emailAddress: form.customerEmail?.trim() ?? '',

      address: form.address?.trim() ?? '',

      townCity: form.town?.trim() ?? '',

      stateCounty: form.state?.trim() ?? '',

      postalCode: form.postalcode?.trim() ?? ''

    };

  }



  private readOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  private normalizeOrderResponse(raw: any): CreateOnlineShopSaleOrderResponse {

    return {

      onlineShopSaleOrderId: String(raw?.onlineShopSaleOrderId ?? raw?.OnlineShopSaleOrderId ?? ''),

      onlineOrderNumber: String(raw?.onlineOrderNumber ?? raw?.OnlineOrderNumber ?? ''),

      totalAmount: Number(raw?.totalAmount ?? raw?.TotalAmount ?? 0),

      amountDueNow: this.readOptionalNumber(raw?.amountDueNow ?? raw?.AmountDueNow),

      requiresOnlineShippingPayment: !!(
        raw?.requiresOnlineShippingPayment ?? raw?.RequiresOnlineShippingPayment
      ),

      paymentMethod: Number(raw?.paymentMethod ?? raw?.PaymentMethod ?? 0),

      paymentStatus: Number(raw?.paymentStatus ?? raw?.PaymentStatus ?? 0),

      orderStatusId: String(raw?.orderStatusId ?? raw?.OrderStatusId ?? ''),

      orderStatusName: raw?.orderStatusName ?? raw?.OrderStatusName,

      orderStatusDisplayName: raw?.orderStatusDisplayName ?? raw?.OrderStatusDisplayName,

      orderStatusColorCode: raw?.orderStatusColorCode ?? raw?.OrderStatusColorCode,

      redirectUrl: raw?.redirectUrl ?? raw?.RedirectUrl,

      transactionReference: raw?.transactionReference ?? raw?.TransactionReference,

      message: raw?.message ?? raw?.Message

    };

  }

  private normalizePagedOrders(raw: any): PagedOnlineShopOrders {
    const items = (raw?.items ?? raw?.Items ?? []).map((o: any) => ({
      id: String(o?.id ?? o?.Id ?? ''),
      onlineOrderNumber: String(o?.onlineOrderNumber ?? o?.OnlineOrderNumber ?? ''),
      orderDate: String(o?.orderDate ?? o?.OrderDate ?? ''),
      totalAmount: Number(o?.totalAmount ?? o?.TotalAmount ?? 0),
      paidAmount: Number(o?.paidAmount ?? o?.PaidAmount ?? 0),
      paymentStatus: Number(o?.paymentStatus ?? o?.PaymentStatus ?? 0),
      deliveryStatus: this.normalizeDeliveryStatus(o?.deliveryStatus ?? o?.DeliveryStatus),
      paymentMethod: Number(o?.paymentMethod ?? o?.PaymentMethod ?? 0),
      customerName: o?.customerName ?? o?.CustomerName,
      phone: o?.phone ?? o?.Phone,
      orderStatusId: String(o?.orderStatusId ?? o?.OrderStatusId ?? ''),
      orderStatusName: o?.orderStatusName ?? o?.OrderStatusName,
      orderStatusDisplayName: o?.orderStatusDisplayName ?? o?.OrderStatusDisplayName,
      orderStatusColorCode: o?.orderStatusColorCode ?? o?.OrderStatusColorCode,
      shippingMethod: Number(o?.shippingMethod ?? o?.ShippingMethod ?? 0) as OnlineShopShippingMethod,
      hasShipment: !!(o?.hasShipment ?? o?.HasShipment),
      trackingNumber: o?.trackingNumber ?? o?.TrackingNumber,
      courierName: o?.courierName ?? o?.CourierName,
      trackShipment: !!(o?.trackShipment ?? o?.TrackShipment),
      lastTrackingStatus: o?.lastTrackingStatus ?? o?.LastTrackingStatus,
      lastTrackingSyncAt: o?.lastTrackingSyncAt ?? o?.LastTrackingSyncAt
    }));
    return {
      totalCount: Number(raw?.totalCount ?? raw?.TotalCount ?? items.length),
      items
    };
  }

  private normalizeTrackResult(raw: any): TrackOnlineShopOrderResult {
    const history = (raw?.history ?? raw?.History ?? []).map((item: any) => ({
      status: item?.status ?? item?.Status,
      location: item?.location ?? item?.Location,
      remarks: item?.remarks ?? item?.Remarks,
      creationTime: item?.creationTime ?? item?.CreationTime
    }));
    return {
      success: !!(raw?.success ?? raw?.Success),
      trackingNumber: raw?.trackingNumber ?? raw?.TrackingNumber,
      courierProvider: raw?.courierProvider ?? raw?.CourierProvider,
      courierName: raw?.courierName ?? raw?.CourierName,
      currentStatus: raw?.currentStatus ?? raw?.CurrentStatus,
      deliveryStatus: this.normalizeDeliveryStatus(raw?.deliveryStatus ?? raw?.DeliveryStatus),
      lastSyncAt: raw?.lastSyncAt ?? raw?.LastSyncAt,
      trackShipment: !!(raw?.trackShipment ?? raw?.TrackShipment),
      canResync: !!(raw?.canResync ?? raw?.CanResync),
      history
    };
  }

  private normalizeFailureDetail(raw: any): OnlineShopPaymentFailureDetail {
    const base = this.normalizeSuccessDetail(raw);
    return {
      ...base,
      gatewayResponseCode: raw?.gatewayResponseCode ?? raw?.GatewayResponseCode,
      gatewayResponseMessage: raw?.gatewayResponseMessage ?? raw?.GatewayResponseMessage,
      paymentFailedAt: raw?.paymentFailedAt ?? raw?.PaymentFailedAt,
      amountDueNow: Number(raw?.amountDueNow ?? raw?.AmountDueNow ?? 0),
      canRetryPayment: !!(raw?.canRetryPayment ?? raw?.CanRetryPayment)
    };
  }

  private normalizeOrderReceipt(raw: any): OnlineShopOrderReceipt {
    const orderNumber = String(raw?.orderNumber ?? raw?.OrderNumber ?? '').trim();
    const fileName = String(raw?.fileName ?? raw?.FileName ?? '').trim();
    return {
      orderId: String(raw?.orderId ?? raw?.OrderId ?? ''),
      orderNumber,
      fileName: fileName || `${orderNumber || 'order'}-receipt.html`,
      htmlContent: String(raw?.htmlContent ?? raw?.HtmlContent ?? ''),
    };
  }

  private handleBlobError(err: any): Observable<never> {
    const blob = err?.error;
    if (!(blob instanceof Blob) || blob.type?.includes('json') !== true) {
      return throwError(() => err);
    }

    return new Observable<never>((observer) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result ?? '{}'));
          observer.error({
            ...err,
            error: parsed,
            message:
              parsed?.error?.message ||
              parsed?.message ||
              err?.message ||
              'Request failed.',
          });
        } catch {
          observer.error(err);
        }
      };
      reader.onerror = () => observer.error(err);
      reader.readAsText(blob);
    });
  }

  private normalizeShipmentSummary(raw: any): OnlineShopSaleOrderShipmentSummary | undefined {
    if (!raw) {
      return undefined;
    }

    return {
      hasShipment: !!(raw?.hasShipment ?? raw?.HasShipment),
      trackingNumber: raw?.trackingNumber ?? raw?.TrackingNumber,
      courierName: raw?.courierName ?? raw?.CourierName,
      courierProvider: raw?.courierProvider ?? raw?.CourierProvider,
      deliveryStatus: this.normalizeDeliveryStatus(raw?.deliveryStatus ?? raw?.DeliveryStatus) ?? undefined,
      lastTrackingStatus: raw?.lastTrackingStatus ?? raw?.LastTrackingStatus,
      lastTrackingSyncAt: raw?.lastTrackingSyncAt ?? raw?.LastTrackingSyncAt,
      trackShipment: !!(raw?.trackShipment ?? raw?.TrackShipment),
      canResync: !!(raw?.canResync ?? raw?.CanResync),
    };
  }

  private normalizeOrderStatusTimeline(raw: any): OnlineShopOrderStatusTimeline {
    const items = (raw?.items ?? raw?.Items ?? []).map((item: any) => ({
      changedAt: String(item?.changedAt ?? item?.ChangedAt ?? ''),
      orderStatusDisplayName: item?.orderStatusDisplayName ?? item?.OrderStatusDisplayName,
      orderStatusColorCode: item?.orderStatusColorCode ?? item?.OrderStatusColorCode,
      paymentStatusName: item?.paymentStatusName ?? item?.PaymentStatusName,
      oldPaymentStatusName: item?.oldPaymentStatusName ?? item?.OldPaymentStatusName,
      deliveryStatus: this.normalizeDeliveryStatus(item?.deliveryStatus ?? item?.DeliveryStatus) ?? undefined,
      oldDeliveryStatus: this.normalizeDeliveryStatus(item?.oldDeliveryStatus ?? item?.OldDeliveryStatus) ?? undefined,
      remarks: item?.remarks ?? item?.Remarks,
    }));

    return {
      onlineOrderNumber: String(raw?.onlineOrderNumber ?? raw?.OnlineOrderNumber ?? ''),
      currentOrderStatusDisplayName: raw?.currentOrderStatusDisplayName ?? raw?.CurrentOrderStatusDisplayName,
      currentOrderStatusColorCode: raw?.currentOrderStatusColorCode ?? raw?.CurrentOrderStatusColorCode,
      currentPaymentStatusName: raw?.currentPaymentStatusName ?? raw?.CurrentPaymentStatusName,
      currentDeliveryStatus: this.normalizeDeliveryStatus(raw?.currentDeliveryStatus ?? raw?.CurrentDeliveryStatus) ?? undefined,
      items,
    };
  }

  private normalizeDeliveryStatus(value: unknown): string | null {
    if (value == null || value === '') {
      return null;
    }

    if (typeof value === 'string') {
      return value.trim() || null;
    }

    const numericLabels: Record<number, string> = {
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

    const num = Number(value);
    return Number.isFinite(num) ? (numericLabels[num] ?? String(value)) : String(value);
  }

  private normalizeSuccessDetail(raw: any): OnlineShopOrderSuccessDetail {
    const products = (raw?.products ?? raw?.Products ?? []).map((p: any) => ({
      productName: String(p?.productName ?? p?.ProductName ?? ''),
      productImageUrl: p?.productImageUrl ?? p?.ProductImageUrl,
      quantity: Number(p?.quantity ?? p?.Quantity ?? 0),
      unitPrice: Number(p?.unitPrice ?? p?.UnitPrice ?? 0),
      lineTotal: Number(p?.lineTotal ?? p?.LineTotal ?? 0)
    }));

    const mapAddr = (a: any): OnlineShopSaleOrderAddress | undefined => {
      if (!a) {
        return undefined;
      }
      return {
        customerName: String(a?.customerName ?? a?.CustomerName ?? ''),
        phone: String(a?.phone ?? a?.Phone ?? ''),
        emailAddress: String(a?.emailAddress ?? a?.EmailAddress ?? ''),
        address: String(a?.address ?? a?.Address ?? ''),
        townCity: String(a?.townCity ?? a?.TownCity ?? ''),
        stateCounty: String(a?.stateCounty ?? a?.StateCounty ?? ''),
        postalCode: String(a?.postalCode ?? a?.PostalCode ?? '')
      };
    };

    return {
      onlineShopSaleOrderId: String(raw?.onlineShopSaleOrderId ?? raw?.OnlineShopSaleOrderId ?? ''),
      onlineOrderNumber: String(raw?.onlineOrderNumber ?? raw?.OnlineOrderNumber ?? ''),
      orderDate: String(raw?.orderDate ?? raw?.OrderDate ?? ''),
      expectedDeliveryDate: String(raw?.expectedDeliveryDate ?? raw?.ExpectedDeliveryDate ?? ''),
      subTotalAmount: Number(raw?.subTotalAmount ?? raw?.SubTotalAmount ?? 0),
      shippingCharges: Number(raw?.shippingCharges ?? raw?.ShippingCharges ?? 0),
      taxAmount: Number(raw?.taxAmount ?? raw?.TaxAmount ?? 0),
      discountAmount: Number(raw?.discountAmount ?? raw?.DiscountAmount ?? 0),
      totalAmount: Number(raw?.totalAmount ?? raw?.TotalAmount ?? 0),
      shippingMethod: Number(raw?.shippingMethod ?? raw?.ShippingMethod ?? 0) as OnlineShopShippingMethod,
      shippingMethodName: String(raw?.shippingMethodName ?? raw?.ShippingMethodName ?? ''),
      paymentMethod: Number(raw?.paymentMethod ?? raw?.PaymentMethod ?? 0) as OnlineShopPaymentMethod,
      paymentMethodName: String(raw?.paymentMethodName ?? raw?.PaymentMethodName ?? ''),
      orderStatusId: String(raw?.orderStatusId ?? raw?.OrderStatusId ?? ''),
      orderStatusDisplayName: raw?.orderStatusDisplayName ?? raw?.OrderStatusDisplayName,
      orderStatusColorCode: raw?.orderStatusColorCode ?? raw?.OrderStatusColorCode,
      paymentStatus: Number(raw?.paymentStatus ?? raw?.PaymentStatus ?? 0) as OnlineShopPaymentStatus,
      paymentStatusName: String(raw?.paymentStatusName ?? raw?.PaymentStatusName ?? ''),
      deliveryStatus: this.normalizeDeliveryStatus(raw?.deliveryStatus ?? raw?.DeliveryStatus) ?? undefined,
      paidAmount: Number(raw?.paidAmount ?? raw?.PaidAmount ?? 0),
      remainingAmount: Number(raw?.remainingAmount ?? raw?.RemainingAmount ?? 0),
      shipment: this.normalizeShipmentSummary(raw?.shipment ?? raw?.Shipment),
      products,
      billingAddress: mapAddr(raw?.billingAddress ?? raw?.BillingAddress),
      shippingAddress: mapAddr(raw?.shippingAddress ?? raw?.ShippingAddress)
    };
  }

}


