import { Injectable } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';

import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

import { Product } from '../classes/product';

import { AuthService } from './auth.service';



/** Matches backend OnlineShopPaymentMethodEnum */

export enum OnlineShopPaymentMethod {

  CashOnDelivery = 1,

  GoPayFast = 2

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

  customerId?: string | null;

  billingAddress: OnlineShopSaleOrderAddress;

  shippingAddress: OnlineShopSaleOrderAddress;

  description?: string;

  shippingMethod: OnlineShopShippingMethod;

  paymentMethod: OnlineShopPaymentMethod;

  products: CreateOnlineShopSaleOrderProductLine[];

}



export interface OnlineShopOrderSuccessProduct {
  productName: string;
  productImageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OnlineShopOrderListItem {
  id: string;
  onlineOrderNumber: string;
  orderDate: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: number;
  deliveryStatus: number;
  paymentMethod: number;
  customerName?: string;
  phone?: string;
  orderStatusId: string;
  orderStatusName?: string;
  orderStatusDisplayName?: string;
  orderStatusColorCode?: string;
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
  products: OnlineShopOrderSuccessProduct[];
  billingAddress?: OnlineShopSaleOrderAddress;
  shippingAddress?: OnlineShopSaleOrderAddress;
}

export interface CreateOnlineShopSaleOrderResponse {

  onlineShopSaleOrderId: string;

  onlineOrderNumber: string;

  totalAmount: number;

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

  getMyOrders(customerEmail: string, skipCount: number, maxResultCount = 20): Observable<PagedOnlineShopOrders> {
    const path = environment.urls?.OnlineShopSaleOrder_GetMyOrders
      || 'OnlineShopSaleOrder/GetMyOnlineShopSaleOrdersForCustomer';
    const params = new HttpParams()
      .set('StoreId', this.auth.storeId)
      .set('CustomerEmail', customerEmail.trim())
      .set('SkipCount', String(skipCount))
      .set('MaxResultCount', String(maxResultCount));
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.get<any>(url, { params }).pipe(
      map((resp) => this.normalizePagedOrders(resp?.result ?? resp))
    );
  }

  buildCreateOrderRequest(

    form: CheckoutFormValues,

    cartProducts: Product[],

    paymentMethod: OnlineShopPaymentMethod

  ): CreateOnlineShopSaleOrderRequest {

    const billing = this.mapAddressFormToDto(form.billing);

    const shipping = form.shipToDifferentAddress && form.shipping

      ? this.mapAddressFormToDto(form.shipping)

      : billing;



    const products = cartProducts.map((p) => {

      const inventoryId = String(p.id ?? '');

      const catalogProductId = p.productId ? String(p.productId) : inventoryId;

      return {

        externalProductId: catalogProductId,

        externalProductInventoryId: inventoryId,

        quantity: Number(p.quantity) > 0 ? Number(p.quantity) : 1

      };

    });



    return {

      storeId: this.auth.storeId,

      customerId: null,

      billingAddress: billing,

      shippingAddress: shipping,

      description: form.description?.trim() ?? '',

      shippingMethod: form.shippingMethod,

      paymentMethod,

      products

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



  private normalizeOrderResponse(raw: any): CreateOnlineShopSaleOrderResponse {

    return {

      onlineShopSaleOrderId: String(raw?.onlineShopSaleOrderId ?? raw?.OnlineShopSaleOrderId ?? ''),

      onlineOrderNumber: String(raw?.onlineOrderNumber ?? raw?.OnlineOrderNumber ?? ''),

      totalAmount: Number(raw?.totalAmount ?? raw?.TotalAmount ?? 0),

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
      deliveryStatus: Number(o?.deliveryStatus ?? o?.DeliveryStatus ?? 0),
      paymentMethod: Number(o?.paymentMethod ?? o?.PaymentMethod ?? 0),
      customerName: o?.customerName ?? o?.CustomerName,
      phone: o?.phone ?? o?.Phone,
      orderStatusId: String(o?.orderStatusId ?? o?.OrderStatusId ?? ''),
      orderStatusName: o?.orderStatusName ?? o?.OrderStatusName,
      orderStatusDisplayName: o?.orderStatusDisplayName ?? o?.OrderStatusDisplayName,
      orderStatusColorCode: o?.orderStatusColorCode ?? o?.OrderStatusColorCode
    }));
    return {
      totalCount: Number(raw?.totalCount ?? raw?.TotalCount ?? items.length),
      items
    };
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
      products,
      billingAddress: mapAddr(raw?.billingAddress ?? raw?.BillingAddress),
      shippingAddress: mapAddr(raw?.shippingAddress ?? raw?.ShippingAddress)
    };
  }

}


