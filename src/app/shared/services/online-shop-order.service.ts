import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

export interface CreateOnlineShopSaleOrderProductLine {
  externalProductId: string;
  externalProductInventoryId: string;
  quantity: number;
}

export interface CreateOnlineShopSaleOrderRequest {
  storeId: string;
  customerId?: string | null;
  customerName: string;
  phone: string;
  emailAddress: string;
  address: string;
  townCity: string;
  stateCounty: string;
  postalCode: string;
  description?: string;
  shippingMethod: OnlineShopShippingMethod;
  paymentMethod: OnlineShopPaymentMethod;
  products: CreateOnlineShopSaleOrderProductLine[];
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

export interface CheckoutFormValues {
  customerName: string;
  customerMobileNo: string;
  customerEmail: string;
  description?: string;
  address: string;
  town: string;
  state: string;
  postalcode: string;
  shippingMethod?: string;
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

  buildCreateOrderRequest(
    form: CheckoutFormValues,
    cartProducts: Product[],
    paymentMethod: OnlineShopPaymentMethod
  ): CreateOnlineShopSaleOrderRequest {
    const shipping = form.shippingMethod === 'pickup'
      ? OnlineShopShippingMethod.LocalPickup
      : OnlineShopShippingMethod.Shipping;

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
      customerName: form.customerName?.trim() ?? '',
      phone: form.customerMobileNo?.trim() ?? '',
      emailAddress: form.customerEmail?.trim() ?? '',
      address: form.address?.trim() ?? '',
      townCity: form.town?.trim() ?? '',
      stateCounty: form.state?.trim() ?? '',
      postalCode: form.postalcode?.trim() ?? '',
      description: form.description?.trim() ?? '',
      shippingMethod: shipping,
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
}
