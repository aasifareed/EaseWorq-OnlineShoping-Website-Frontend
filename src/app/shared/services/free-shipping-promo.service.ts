import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { TenantService } from './tenant.service';
import { asBackgroundRequest } from '../interceptors/background-request';

export interface FreeShippingPromo {
  id: string;
  title: string;
  description?: string;
  code?: string;
  isFirstOrder?: boolean;
  minSpend?: number;
}

export interface ProductCouponOffer {
  id: string;
  title: string;
  code: string;
  type: string;
  amount: number | null;
  minSpend: number;
  isFirstOrder: boolean;
  benefitLabel: string;
}

@Injectable({
  providedIn: 'root'
})
export class FreeShippingPromoService {
  private promoRequest$: Observable<FreeShippingPromo | null> | null = null;

  constructor(
    private http: HttpClient,
    private tenantService: TenantService
  ) {}

  getActivePromo(force = false): Observable<FreeShippingPromo | null> {
    if (force) {
      this.promoRequest$ = null;
    }
    if (this.promoRequest$) {
      return this.promoRequest$;
    }

    this.promoRequest$ = this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const path = environment.urls.OnlineShopCoupon_GetActiveFreeShippingPromo
          ?? 'OnlineShopCoupon/GetActiveFreeShippingPromoForStorefront';
        const url = `${this.apiRoot()}api/services/app/${path}?TenantId=${ctx.tenantId}`;
        return this.http.get(url, asBackgroundRequest()).pipe(
          map((resp: { result?: Record<string, unknown> | null }) => {
            const row = resp?.result ?? null;
            if (!row) {
              return null;
            }

            const title = String(row.title ?? row.Title ?? '').trim();
            if (!title) {
              return null;
            }

            return {
              id: String(row.id ?? row.Id ?? ''),
              title,
              description: String(row.description ?? row.Description ?? '').trim() || undefined,
              code: String(row.code ?? row.Code ?? '').trim() || undefined,
              isFirstOrder: !!(row.isFirstOrder ?? row.IsFirstOrder),
              minSpend: Number(row.minSpend ?? row.MinSpend ?? 0) || 0
            } as FreeShippingPromo;
          }),
          catchError(() => of(null))
        );
      }),
      shareReplay(1)
    );

    return this.promoRequest$;
  }

  getProductCoupons(productId: string): Observable<ProductCouponOffer[]> {
    const catalogId = String(productId ?? '').trim();
    if (!catalogId) {
      return of([]);
    }

    return this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const urls = environment.urls as Record<string, string>;
        const path = urls.OnlineShopCoupon_GetProductCoupons
          || 'OnlineShopCoupon/GetProductCouponsForStorefront';
        const url =
          `${this.apiRoot()}api/services/app/${path}` +
          `?TenantId=${ctx.tenantId}&ProductId=${encodeURIComponent(catalogId)}`;
        return this.http.get(url, asBackgroundRequest()).pipe(
          map((resp: { result?: Array<Record<string, unknown>> | null }) => {
            const rows = Array.isArray(resp?.result) ? resp.result : [];
            return rows
              .map((row) => this.mapProductCouponOffer(row))
              .filter((offer): offer is ProductCouponOffer => !!offer);
          }),
          catchError(() => of([]))
        );
      })
    );
  }

  private mapProductCouponOffer(row: Record<string, unknown>): ProductCouponOffer | null {
    const code = String(row.code ?? row.Code ?? '').trim().toUpperCase();
    if (!code) {
      return null;
    }

    const type = String(row.type ?? row.Type ?? '').trim().toLowerCase();
    const amountRaw = row.amount ?? row.Amount;
    const amount = amountRaw == null || amountRaw === '' ? null : Number(amountRaw);

    return {
      id: String(row.id ?? row.Id ?? code),
      title: String(row.title ?? row.Title ?? '').trim(),
      code,
      type,
      amount: Number.isFinite(amount) ? amount : null,
      minSpend: Number(row.minSpend ?? row.MinSpend ?? 0) || 0,
      isFirstOrder: !!(row.isFirstOrder ?? row.IsFirstOrder),
      benefitLabel: this.productCouponBenefitLabel(type, Number.isFinite(amount) ? amount : null)
    };
  }

  private productCouponBenefitLabel(type: string, amount: number | null): string {
    if (type === 'percentage' && amount != null) {
      return `${amount}% off`;
    }
    if (type === 'fixed' && amount != null) {
      return `Rs. ${amount} off`;
    }
    return 'Discount';
  }

  private apiRoot(): string {
    const base = (environment.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}/` : '/';
  }
}
