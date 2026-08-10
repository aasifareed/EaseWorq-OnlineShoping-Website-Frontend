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

  private apiRoot(): string {
    const base = (environment.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}/` : '/';
  }
}
