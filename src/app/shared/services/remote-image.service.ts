import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { BACKGROUND_REQUEST } from '../interceptors/background-request';
import { rewriteMediaUrl } from './media-url';

/**
 * APK: &lt;img src&gt; cannot load Host/dev-tunnel files (wrong port + tunnel interstitial).
 * Fetch via CapacitorHttp and use a blob URL instead.
 */
@Injectable({ providedIn: 'root' })
export class RemoteImageService {
  private readonly cache = new Map<string, Observable<string>>();

  constructor(private http: HttpClient) {}

  resolve(url: string | null | undefined): Observable<string> {
    const rewritten = rewriteMediaUrl(url);
    if (!rewritten) {
      return of('');
    }
    if (
      !environment.isMobileApp
      || rewritten.startsWith('assets/')
      || rewritten.startsWith('/assets/')
      || rewritten.startsWith('data:')
      || rewritten.startsWith('blob:')
    ) {
      return of(rewritten);
    }

    const cached = this.cache.get(rewritten);
    if (cached) {
      return cached;
    }

    const request$ = this.http.get(rewritten, {
      responseType: 'blob',
      context: new HttpContext().set(BACKGROUND_REQUEST, true),
    }).pipe(
      map((blob) => {
        if (!blob || blob.size === 0 || (blob.type && blob.type.includes('text/html'))) {
          return rewritten;
        }
        return URL.createObjectURL(blob);
      }),
      catchError(() => of(rewritten)),
      shareReplay(1),
    );

    this.cache.set(rewritten, request$);
    return request$;
  }
}
