import { HttpContext, HttpContextToken, HttpHeaders, HttpParams } from '@angular/common/http';

/**
 * Marks a request the customer is not sitting and waiting for, so it does not raise the screen-wide
 * busy overlay. Use it for repricing, polling, background refreshes and anything with its own
 * inline spinner on the page.
 */
export const BACKGROUND_REQUEST = new HttpContextToken<boolean>(() => false);

/** The subset of HttpClient options callers pass alongside the marker. */
export interface BackgroundRequestOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?: HttpParams | Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>;
  context?: HttpContext;
  reportProgress?: boolean;
  withCredentials?: boolean;
}

/**
 * Merges the background marker into an existing set of request options. `observe` and `responseType`
 * are pinned so callers keep the plain-body HttpClient overload.
 */
export function asBackgroundRequest(): {
  context: HttpContext;
  observe: 'body';
  responseType: 'json';
};
export function asBackgroundRequest<T extends BackgroundRequestOptions>(
  options: T
): T & { context: HttpContext; observe: 'body'; responseType: 'json' };
export function asBackgroundRequest<T extends BackgroundRequestOptions>(
  options?: T
): T & { context: HttpContext; observe: 'body'; responseType: 'json' } {
  const context = options?.context ?? new HttpContext();
  context.set(BACKGROUND_REQUEST, true);
  return {
    ...(options ?? ({} as T)),
    context,
    observe: 'body',
    responseType: 'json',
  };
}
