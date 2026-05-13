import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface PayFastCheckoutResponse {
  formUrl: string;
  fields: Record<string, string>;
}

export interface CreatePayFastCheckoutRequest {
  orderId?: string;
  basketId?: string;
  amount: number;
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
  constructor(private http: HttpClient) {}

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
