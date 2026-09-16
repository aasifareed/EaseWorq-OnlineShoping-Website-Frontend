import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { asBackgroundRequest } from '../interceptors/background-request';

export interface WorkingAreaMatchResult {
  /** False when the store has not drawn a working area / zone polygon yet. */
  hasWorkingArea: boolean;
  isInside: boolean;
  zoneId?: string | null;
  zoneName?: string | null;
  mainZoneId?: string | null;
  mainZoneName?: string | null;
  /** .NET DayOfWeek values (0=Sunday … 6=Saturday). */
  deliveryDays: number[];
  deliveryDayNames: string[];
}

@Injectable({ providedIn: 'root' })
export class OnlineShopWorkingAreaService {
  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  /** Store working area is optional: on any failure we report "no area" so checkout keeps working. */
  isPointInsideWorkingArea(latitude: number, longitude: number): Observable<WorkingAreaMatchResult> {
    const path =
      environment.urls?.WorkingArea_IsPointInside ||
      'OnlineShopStoreWorkingLocation/IsPointInsideWorkingArea';
    const url = `${this.apiRoot()}api/services/app/${path}`;
    const body = {
      tenantId: this.auth.tenantId,
      latitude,
      longitude,
    };

    // A quiet check behind address entry; the customer is still typing, not waiting.
    return this.http.post<any>(url, body, asBackgroundRequest()).pipe(
      map((response) => {
        const result = response?.result ?? response ?? {};
        const deliveryDays = Array.isArray(result.deliveryDays ?? result.DeliveryDays)
          ? (result.deliveryDays ?? result.DeliveryDays).map((d: unknown) => Number(d)).filter((d: number) => Number.isFinite(d))
          : [];
        const deliveryDayNames = Array.isArray(result.deliveryDayNames ?? result.DeliveryDayNames)
          ? (result.deliveryDayNames ?? result.DeliveryDayNames).map((n: unknown) => String(n))
          : [];
        return {
          hasWorkingArea: !!(result.hasWorkingArea ?? result.HasWorkingArea),
          isInside: !!(result.isInside ?? result.IsInside),
          zoneId: (result.zoneId ?? result.ZoneId ?? null) as string | null,
          zoneName: (result.zoneName ?? result.ZoneName ?? null) as string | null,
          mainZoneId: (result.mainZoneId ?? result.MainZoneId ?? null) as string | null,
          mainZoneName: (result.mainZoneName ?? result.MainZoneName ?? null) as string | null,
          deliveryDays,
          deliveryDayNames,
        } as WorkingAreaMatchResult;
      }),
      catchError(() =>
        of({
          hasWorkingArea: false,
          isInside: false,
          deliveryDays: [],
          deliveryDayNames: [],
        }),
      ),
    );
  }

  private apiRoot(): string {
    const base = environment.baseUrl || '';
    return base.endsWith('/') ? base : `${base}/`;
  }
}
