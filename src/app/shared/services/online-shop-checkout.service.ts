import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { asBackgroundRequest } from '../interceptors/background-request';
import { OnlineShopShippingMethod } from './online-shop-order.service';

export { OnlineShopShippingMethod };

/** A requested cart line. Identity and quantity only — prices are the server's to decide. */
export interface OnlineShopCartLineInput {
  productId: string;
  productInventoryId?: string | null;
  quantity: number;
}

export interface CalculateOnlineShopPricingRequest {
  storeId: string;
  tenantId?: number | null;
  customerId?: string | null;
  items: OnlineShopCartLineInput[];
  /** Every code the shopper has applied. The server allows one effective coupon per scope. */
  couponCodes?: string[] | null;
  shippingMethod: OnlineShopShippingMethod;
  /** False on the cart page and for local pickup, where no delivery charge applies yet. */
  includeShipping: boolean;
  countryCode?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  selectedCourierCompany?: string | null;
  selectedCourierServiceType?: string | null;
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

/** One discount that applied, with the label the server wants shown for it. */
export interface OnlineShopAppliedDiscount {
  scope: string;
  discountType?: string | null;
  source?: string | null;
  isAutomatic: boolean;
  couponCode?: string | null;
  description?: string | null;
  configuredValue?: number | null;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  sortOrder: number;
}

export interface OnlineShopCouponStatus {
  hasCoupon: boolean;
  /** The code is usable here and earned a discount. */
  isValid: boolean;
  /** The code is genuine; false means it was refused outright rather than beaten by a better offer. */
  isAdmitted: boolean;
  message?: string | null;
  couponId?: string | null;
  couponCode?: string | null;
  couponTitle?: string | null;
  couponType?: string | null;
  scope?: string | null;
  eligibleSubtotal: number;
  discountAmount: number;
}

/**
 * The server's complete pricing breakdown. Every amount shown at cart and checkout comes from
 * here; the storefront performs no monetary arithmetic of its own.
 */
export interface OnlineShopPricingResult {
  originalProductSubtotal: number;
  catalogueDiscountTotal: number;
  promotionalProductDiscountTotal: number;
  productDiscountTotal: number;
  subtotalAfterProductDiscounts: number;
  orderDiscountTotal: number;
  netMerchandiseAmount: number;
  taxAmount: number;
  originalShippingAmount: number;
  shippingDiscountTotal: number;
  finalShippingAmount: number;
  totalDiscount: number;
  finalTotal: number;

  /** What the cart's goods weigh. 0 when no product in the cart carries a recorded weight. */
  totalWeightKg: number;

  /** The weight the courier quote was computed on: the above, floored at the minimum billable weight. */
  billableWeightKg: number;

  isMarginCapped: boolean;
  appliedDiscounts: OnlineShopAppliedDiscount[];
  /** One entry per applied code, in the order the shopper applied them. */
  coupons: OnlineShopCouponStatus[];
  courierOptions: CourierShippingOptionResult[];
  shippingQuoteUnavailable: boolean;
  shippingMessage?: string | null;
  courierProvider?: string | null;
  courierCompany?: string | null;
  courierServiceType?: string | null;
  pickupLocationId?: string | null;
  appliedShippingRuleName?: string | null;
  appliedShippingRuleType?: string | null;
  appliedShippingType?: string | null;
  isMockRate: boolean;
}

@Injectable({ providedIn: 'root' })
export class OnlineShopCheckoutService {
  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  calculatePricing(request: CalculateOnlineShopPricingRequest): Observable<OnlineShopPricingResult> {
    const path =
      environment.urls?.OnlineShopCheckout_CalculatePricing ||
      'OnlineShopCheckout/CalculatePricing';
    const url = `${this.apiRoot()}api/services/app/${path}`;
    const tenantId = request.tenantId ?? this.resolveTenantId();
    const body = { ...request, tenantId };
    // Quotes run on every cart, address and courier change; the pages showing them have their own
    // inline spinners, so this must not take the screen away from the customer.
    return this.http
      .post<any>(url, body, asBackgroundRequest(this.tenantRequestOptions(tenantId)))
      .pipe(map((response) => this.normalizePricing(response?.result ?? response)));
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

  private normalizePricing(raw: any): OnlineShopPricingResult {
    return {
      originalProductSubtotal: this.num(raw?.originalProductSubtotal ?? raw?.OriginalProductSubtotal),
      catalogueDiscountTotal: this.num(raw?.catalogueDiscountTotal ?? raw?.CatalogueDiscountTotal),
      promotionalProductDiscountTotal: this.num(
        raw?.promotionalProductDiscountTotal ?? raw?.PromotionalProductDiscountTotal
      ),
      productDiscountTotal: this.num(raw?.productDiscountTotal ?? raw?.ProductDiscountTotal),
      subtotalAfterProductDiscounts: this.num(
        raw?.subtotalAfterProductDiscounts ?? raw?.SubtotalAfterProductDiscounts
      ),
      orderDiscountTotal: this.num(raw?.orderDiscountTotal ?? raw?.OrderDiscountTotal),
      netMerchandiseAmount: this.num(raw?.netMerchandiseAmount ?? raw?.NetMerchandiseAmount),
      taxAmount: this.num(raw?.taxAmount ?? raw?.TaxAmount),
      originalShippingAmount: this.num(raw?.originalShippingAmount ?? raw?.OriginalShippingAmount),
      shippingDiscountTotal: this.num(raw?.shippingDiscountTotal ?? raw?.ShippingDiscountTotal),
      finalShippingAmount: this.num(raw?.finalShippingAmount ?? raw?.FinalShippingAmount),
      totalDiscount: this.num(raw?.totalDiscount ?? raw?.TotalDiscount),
      finalTotal: this.num(raw?.finalTotal ?? raw?.FinalTotal),
      totalWeightKg: this.num(raw?.totalWeightKg ?? raw?.TotalWeightKg),
      billableWeightKg: this.num(raw?.billableWeightKg ?? raw?.BillableWeightKg),
      isMarginCapped: !!(raw?.isMarginCapped ?? raw?.IsMarginCapped),
      appliedDiscounts: this.normalizeAppliedDiscounts(raw?.appliedDiscounts ?? raw?.AppliedDiscounts),
      coupons: this.normalizeCoupons(raw?.coupons ?? raw?.Coupons),
      courierOptions: this.normalizeCourierOptions(raw?.courierOptions ?? raw?.CourierOptions),
      shippingQuoteUnavailable: !!(raw?.shippingQuoteUnavailable ?? raw?.ShippingQuoteUnavailable),
      shippingMessage: raw?.shippingMessage ?? raw?.ShippingMessage ?? null,
      courierProvider: raw?.courierProvider ?? raw?.CourierProvider ?? null,
      courierCompany: raw?.courierCompany ?? raw?.CourierCompany ?? null,
      courierServiceType: raw?.courierServiceType ?? raw?.CourierServiceType ?? null,
      pickupLocationId: raw?.pickupLocationId ?? raw?.PickupLocationId ?? null,
      appliedShippingRuleName: raw?.appliedShippingRuleName ?? raw?.AppliedShippingRuleName ?? null,
      appliedShippingRuleType: raw?.appliedShippingRuleType ?? raw?.AppliedShippingRuleType ?? null,
      appliedShippingType: raw?.appliedShippingType ?? raw?.AppliedShippingType ?? null,
      isMockRate: !!(raw?.isMockRate ?? raw?.IsMockRate)
    };
  }

  private normalizeCoupons(raw: any): OnlineShopCouponStatus[] {
    return (Array.isArray(raw) ? raw : []).map((item) => this.normalizeCoupon(item));
  }

  private normalizeCoupon(raw: any): OnlineShopCouponStatus {
    return {
      hasCoupon: !!(raw?.hasCoupon ?? raw?.HasCoupon),
      isValid: !!(raw?.isValid ?? raw?.IsValid),
      isAdmitted: !!(raw?.isAdmitted ?? raw?.IsAdmitted),
      message: raw?.message ?? raw?.Message ?? null,
      couponId: raw?.couponId ?? raw?.CouponId ?? null,
      couponCode: raw?.couponCode ?? raw?.CouponCode ?? null,
      couponTitle: raw?.couponTitle ?? raw?.CouponTitle ?? null,
      couponType: raw?.couponType ?? raw?.CouponType ?? null,
      scope: raw?.scope ?? raw?.Scope ?? null,
      eligibleSubtotal: this.num(raw?.eligibleSubtotal ?? raw?.EligibleSubtotal),
      discountAmount: this.num(raw?.discountAmount ?? raw?.DiscountAmount)
    };
  }

  private normalizeAppliedDiscounts(raw: any): OnlineShopAppliedDiscount[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.map((item) => ({
      scope: String(item?.scope ?? item?.Scope ?? ''),
      discountType: item?.discountType ?? item?.DiscountType ?? null,
      source: item?.source ?? item?.Source ?? null,
      isAutomatic: !!(item?.isAutomatic ?? item?.IsAutomatic),
      couponCode: item?.couponCode ?? item?.CouponCode ?? null,
      description: item?.description ?? item?.Description ?? null,
      configuredValue: item?.configuredValue ?? item?.ConfiguredValue ?? null,
      originalAmount: this.num(item?.originalAmount ?? item?.OriginalAmount),
      discountAmount: this.num(item?.discountAmount ?? item?.DiscountAmount),
      finalAmount: this.num(item?.finalAmount ?? item?.FinalAmount),
      sortOrder: Number(item?.sortOrder ?? item?.SortOrder ?? 0)
    }));
  }

  private normalizeCourierOptions(raw: any): CourierShippingOptionResult[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.map((item) => ({
      courierCompany: String(item?.courierCompany ?? item?.CourierCompany ?? ''),
      courierServiceType: String(item?.courierServiceType ?? item?.CourierServiceType ?? ''),
      cargoOriginalAmount: this.num(item?.cargoOriginalAmount ?? item?.CargoOriginalAmount),
      shippingDiscountAmount: this.num(item?.shippingDiscountAmount ?? item?.ShippingDiscountAmount),
      finalShippingAmount: this.num(item?.finalShippingAmount ?? item?.FinalShippingAmount),
      pickupLocationId: item?.pickupLocationId ?? item?.PickupLocationId ?? null,
      isRecommended: !!(item?.isRecommended ?? item?.IsRecommended)
    }));
  }

  private num(value: any): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
