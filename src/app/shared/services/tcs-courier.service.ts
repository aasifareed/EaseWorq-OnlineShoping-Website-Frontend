import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface TcsCreateBookingResponse {
  consignmentNo?: string;
  consignmentNoAlt?: string;
  message?: string;
  traceId?: string;
  traceIdAlt?: string;
  onlineShopShipmentId?: string;
  onlineShopSaleOrderId?: string;
  resolvedConsignmentNo?: string;
  resolvedTraceId?: string;
}

interface AbpAjaxResponse<T> {
  result?: T;
  success?: boolean;
  error?: { message?: string };
}

@Injectable({ providedIn: 'root' })
export class TcsCourierService {
  constructor(private http: HttpClient) {}

  private apiRoot(): string {
    const b = environment.baseUrl || '';
    return b.endsWith('/') ? b : `${b}/`;
  }

  createBookingFromOrder(orderId: string): Observable<TcsCreateBookingResponse> {
    const path =
      environment.urls?.TcsCourier_CreateBookingFromOrder ||
      'TcsCourier/CreateBookingFromOrder';
    const params = new HttpParams().set('orderId', orderId.trim());
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.post<AbpAjaxResponse<TcsCreateBookingResponse>>(url, null, { params }).pipe(
      map((body) =>
        this.normalizeBookingResponse(
          body?.result ?? (body as unknown as TcsCreateBookingResponse)
        )
      )
    );
  }

  private normalizeBookingResponse(data: TcsCreateBookingResponse | null | undefined): TcsCreateBookingResponse {
    if (!data) {
      return {};
    }
    const consignmentNo = data.consignmentNo ?? data.consignmentNoAlt;
    const traceId = data.traceId ?? data.traceIdAlt;
    return {
      ...data,
      resolvedConsignmentNo: consignmentNo,
      resolvedTraceId: traceId
    };
  }
}
