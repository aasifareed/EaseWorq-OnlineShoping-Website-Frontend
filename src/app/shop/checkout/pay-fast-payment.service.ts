import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AppBusyService } from 'src/app/shared/services/app-busy.service';

/** Safety valve: how long the overlay stays up waiting for the PayFast redirect to take over. */
const REDIRECT_HOLD_MS = 15000;

export interface PayFastCheckoutResponse {
  formUrl: string;
  fields: Record<string, string>;
}

/**
 * Carries no amount: the server charges what the persisted order says is due, so a browser cannot
 * change what is paid.
 */
export interface CreatePayFastCheckoutRequest {
  /** Online shop sale order id (Guid string) from CreateOnlineShopSaleOrder. */
  orderId?: string;
  /** PayFast basket / transaction reference from order creation. */
  basketId?: string;
  customerName?: string;
  customerEmail?: string;
  customerMobileNo?: string;
  description?: string;
}

/** ABP wraps controller payloads as { result: T, success, __abp }. */
interface AbpAjaxResponse<T> {
  result?: T;
  success?: boolean;
  error?: unknown;
  __abp?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PayFastPaymentService {
  constructor(private http: HttpClient, private busy: AppBusyService) {}

  /** Uses host root (not services/app) — matches Mart PayFastController. */
  private apiRoot(): string {
    const b = environment.baseUrl || '';
    return b.endsWith('/') ? b : `${b}/`;
  }

  createCheckout(request: CreatePayFastCheckoutRequest): Observable<PayFastCheckoutResponse> {
    const url = `${this.apiRoot()}api/services/app/OnlineShopPayment/CreateCheckout`;
    // const url = `${this.apiRoot()}api/payfast/create-checkout`;
    return this.http.post<AbpAjaxResponse<PayFastCheckoutResponse> | PayFastCheckoutResponse>(url, request).pipe(
      map((body) => this.normalizeCheckoutResponse(body))
    );
  }

  retryCheckout(orderId: string): Observable<PayFastCheckoutResponse> {
    const url = `${this.apiRoot()}api/services/app/OnlineShopPayment/RetryCheckout`;
    return this.http.post<AbpAjaxResponse<PayFastCheckoutResponse> | PayFastCheckoutResponse>(url, { orderId }).pipe(
      map((body) => this.normalizeCheckoutResponse(body))
    );
  }

  /**
   * POST browser form to PayFast hosted page (formUrl) with hidden fields.
   * Accepts either flat `{ formUrl, fields }` or ABP `{ result: { formUrl, fields } }`.
   */
  redirectToPayFast(response: PayFastCheckoutResponse | AbpAjaxResponse<PayFastCheckoutResponse> | any): void {
    const { formUrl, fields } = this.normalizeCheckoutResponse(response);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = formUrl;
    Object.keys(fields).forEach((key) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = fields[key];
      form.appendChild(input);
    });
    // Hold the screen until the browser leaves for PayFast, so the customer cannot start something
    // else mid-redirect. Released on a timer in case the navigation never happens.
    this.busy.begin('Taking you to secure payment…');
    setTimeout(() => this.busy.end(), REDIRECT_HOLD_MS);

    document.body.appendChild(form);
    form.submit();
  }

  private normalizeCheckoutResponse(body: any): PayFastCheckoutResponse {
    const payload = body?.result ?? body;
    const formUrl = payload?.formUrl as string | undefined;
    const fields = payload?.fields as Record<string, string> | undefined;
    if (!formUrl || !fields || typeof fields !== 'object') {
      console.error('PayFast: unexpected API shape', body);
      throw new Error('PayFast checkout response missing formUrl or fields.');
    }
    return { formUrl, fields };
  }
}
