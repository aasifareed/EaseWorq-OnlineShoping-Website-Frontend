import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ShippingRuleType } from '../models/online-shop-discount.enum';
import { TenantService } from './tenant.service';
import { asBackgroundRequest } from '../interceptors/background-request';

export type ShippingDealChargeType = 'free' | 'percentage' | 'fixed';

/** What a deal's limits are measured in: the cart's value, or the parcel's weight. */
export type ShippingDealRuleType = ShippingRuleType;

export interface ShippingDeal {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  ruleType: ShippingDealRuleType;
  /** Where the deal starts applying: a cart subtotal, or a weight in kg per `ruleType`. */
  min: number;
  /** Where it stops applying, in the same unit as `min`; null means no upper limit. */
  max: number | null;
  chargeType: ShippingDealChargeType;
  /** Percentage for 'percentage', currency amount for 'fixed', unused for 'free'. */
  amount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ShippingDealsService {
  private dealsRequest$: Observable<ShippingDeal[]> | null = null;

  constructor(
    private http: HttpClient,
    private tenantService: TenantService
  ) {}

  getActiveDeals(force = false): Observable<ShippingDeal[]> {
    if (force) {
      this.dealsRequest$ = null;
    }
    if (this.dealsRequest$) {
      return this.dealsRequest$;
    }

    this.dealsRequest$ = this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const path = environment.urls.OnlineShopShipping_GetShippingDeals
          ?? 'OnlineShopShipping/GetShippingDealsForStorefront';
        const url = `${this.apiRoot()}api/services/app/${path}?TenantId=${ctx.tenantId}`;
        return this.http.get(url, asBackgroundRequest()).pipe(
          map((resp: { result?: unknown[] }) => this.mapDeals(resp?.result)),
          catchError(() => of([] as ShippingDeal[]))
        );
      }),
      shareReplay(1)
    );

    return this.dealsRequest$;
  }

  private mapDeals(rows: unknown): ShippingDeal[] {
    if (!Array.isArray(rows)) {
      return [];
    }

    return (rows as Record<string, unknown>[])
      .map((row) => {
        const chargeType = String(row.shippingType ?? row.ShippingType ?? '')
          .trim()
          .toLowerCase() as ShippingDealChargeType;

        const rawMax = row.max ?? row.Max;
        const max = rawMax === null || rawMax === undefined ? null : Number(rawMax);

        const ruleType = String(row.ruleType ?? row.RuleType ?? '')
          .trim()
          .toLowerCase() === ShippingRuleType.BaseOnWeight
          ? ShippingRuleType.BaseOnWeight
          : ShippingRuleType.BaseOnPrice;

        return {
          id: String(row.id ?? row.Id ?? ''),
          ruleType,
          name: String(row.name ?? row.Name ?? '').trim(),
          countryCode: String(row.countryCode ?? row.CountryCode ?? '').trim(),
          countryName: String(row.countryName ?? row.CountryName ?? '').trim(),
          min: Number(row.min ?? row.Min ?? 0) || 0,
          max: max !== null && Number.isFinite(max) ? max : null,
          chargeType,
          amount: Number(row.amount ?? row.Amount ?? 0) || 0
        } as ShippingDeal;
      })
      .filter((deal) => deal.chargeType === 'free' || deal.amount > 0)
      .sort((a, b) => a.min - b.min);
  }

  private apiRoot(): string {
    const base = (environment.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}/` : '/';
  }
}
