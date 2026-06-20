import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';

export interface GetOnlineShopShippingRateRequest {
  tenantId?: number | null;
  countryCode: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  cartSubtotal: number;
  cartWeight?: number | null;
  selectedCourierCompany?: string | null;
  selectedCourierServiceType?: string | null;
}

export interface CartCouponItemDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ApplyOnlineShopCouponRequest {
  couponCode: string;
  storeId: string;
  customerId?: string | null;
  cartSubtotal: number;
  cartItems: CartCouponItemDto[];
}

export interface ApplyOnlineShopCouponResult {
  isValid: boolean;
  message?: string | null;
  couponId?: string | null;
  couponCode?: string | null;
  couponTitle?: string | null;
  couponType?: string | null;
  eligibleSubtotal: number;
  discountAmount: number;
  payableAmountAfterDiscount: number;
}

export interface AppliedShopCouponState {
  couponCode: string;
  result: ApplyOnlineShopCouponResult;
}

export interface CourierShippingOptionResult {
  courierCompany: string;
  courierServiceType: string;
  cargoOriginalAmount: number;
  shippingDiscountAmount: number;
  finalShippingAmount: number;
  pickupLocationId?: string | null;
  isRecommended?: boolean;
}

export interface OnlineShopShippingRateResult {
  cargoOriginalAmount: number;
  shippingDiscountAmount: number;
  finalShippingAmount: number;
  appliedRuleId?: string | null;
  appliedRuleName?: string | null;
  ruleType?: string | null;
  shippingType?: string | null;
  message?: string | null;
  courierProvider?: string | null;
  courierCompany?: string | null;
  courierServiceType?: string | null;
  pickupLocationId?: string | null;
  isMockRate?: boolean;
  ratesUnavailable?: boolean;
  availableOptions?: CourierShippingOptionResult[];
}

@Injectable({ providedIn: 'root' })
export class OnlineShopCheckoutService {
  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  applyCoupon(request: ApplyOnlineShopCouponRequest): Observable<ApplyOnlineShopCouponResult> {
    const path =
      environment.urls?.OnlineShopCheckout_ApplyCoupon ||
      'OnlineShopCheckout/ApplyCoupon';
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.post<any>(url, request).pipe(
      map((body) => this.normalizeCoupon(body?.result ?? body))
    );
  }

  getShippingRate(request: GetOnlineShopShippingRateRequest): Observable<OnlineShopShippingRateResult> {
    const path =
      environment.urls?.OnlineShopCheckout_GetShippingRate ||
      'OnlineShopCheckout/GetShippingRate';
    const url = `${this.apiRoot()}api/services/app/${path}`;
    const tenantId = request.tenantId ?? this.resolveTenantId();
    const body = { ...request, tenantId };
    return this.http.post<any>(url, body, this.tenantRequestOptions(tenantId)).pipe(
      map((body) => this.normalizeRate(body?.result ?? body))
    );
  }

  private resolveTenantId(): number {
    return this.auth.tenantId;
  }

  private tenantRequestOptions(tenantId: number): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({
        'Abp.TenantId': String(tenantId),
      }),
    };
  }

  private apiRoot(): string {
    const b = environment.baseUrl || '';
    return b.endsWith('/') ? b : `${b}/`;
  }

  private normalizeCoupon(raw: any): ApplyOnlineShopCouponResult {
    return {
      isValid: !!(raw?.isValid ?? raw?.IsValid),
      message: raw?.message ?? raw?.Message ?? null,
      couponId: raw?.couponId ?? raw?.CouponId ?? null,
      couponCode: raw?.couponCode ?? raw?.CouponCode ?? null,
      couponTitle: raw?.couponTitle ?? raw?.CouponTitle ?? null,
      couponType: raw?.couponType ?? raw?.CouponType ?? null,
      eligibleSubtotal: Number(raw?.eligibleSubtotal ?? raw?.EligibleSubtotal ?? 0),
      discountAmount: Number(raw?.discountAmount ?? raw?.DiscountAmount ?? 0),
      payableAmountAfterDiscount: Number(
        raw?.payableAmountAfterDiscount ?? raw?.PayableAmountAfterDiscount ?? 0
      )
    };
  }

  private normalizeRate(raw: any): OnlineShopShippingRateResult {
    return {
      cargoOriginalAmount: Number(raw?.cargoOriginalAmount ?? raw?.CargoOriginalAmount ?? 0),
      shippingDiscountAmount: Number(raw?.shippingDiscountAmount ?? raw?.ShippingDiscountAmount ?? 0),
      finalShippingAmount: Number(raw?.finalShippingAmount ?? raw?.FinalShippingAmount ?? 0),
      appliedRuleId: raw?.appliedRuleId ?? raw?.AppliedRuleId ?? null,
      appliedRuleName: raw?.appliedRuleName ?? raw?.AppliedRuleName ?? null,
      ruleType: raw?.ruleType ?? raw?.RuleType ?? null,
      shippingType: raw?.shippingType ?? raw?.ShippingType ?? null,
      message: raw?.message ?? raw?.Message ?? null,
      courierProvider: raw?.courierProvider ?? raw?.CourierProvider ?? null,
      courierCompany: raw?.courierCompany ?? raw?.CourierCompany ?? null,
      courierServiceType: raw?.courierServiceType ?? raw?.CourierServiceType ?? null,
      pickupLocationId: raw?.pickupLocationId ?? raw?.PickupLocationId ?? null,
      isMockRate: !!(raw?.isMockRate ?? raw?.IsMockRate),
      ratesUnavailable: !!(raw?.ratesUnavailable ?? raw?.RatesUnavailable),
      availableOptions: this.normalizeShippingOptions(raw?.availableOptions ?? raw?.AvailableOptions)
    };
  }

  private normalizeShippingOptions(raw: any): CourierShippingOptionResult[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.map((item) => ({
      courierCompany: String(item?.courierCompany ?? item?.CourierCompany ?? ''),
      courierServiceType: String(item?.courierServiceType ?? item?.CourierServiceType ?? ''),
      cargoOriginalAmount: Number(item?.cargoOriginalAmount ?? item?.CargoOriginalAmount ?? 0),
      shippingDiscountAmount: Number(item?.shippingDiscountAmount ?? item?.ShippingDiscountAmount ?? 0),
      finalShippingAmount: Number(item?.finalShippingAmount ?? item?.FinalShippingAmount ?? 0),
      pickupLocationId: item?.pickupLocationId ?? item?.PickupLocationId ?? null,
      isRecommended: !!(item?.isRecommended ?? item?.IsRecommended)
    }));
  }
}
