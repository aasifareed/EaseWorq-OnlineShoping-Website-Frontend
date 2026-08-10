import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AppBusyService } from '../services/app-busy.service';
import { BACKGROUND_REQUEST } from './background-request';

/** Wording for the actions worth naming; anything else falls back to a generic wait message. */
const ACTION_MESSAGES: ReadonlyArray<[string, string]> = [
  ['CreateOnlineShopSaleOrder', 'Placing your order…'],
  ['OnlineShopPayment/CreateCheckout', 'Taking you to secure payment…'],
  ['OnlineShopPayment/RetryCheckout', 'Taking you to secure payment…'],
  ['AuthenticateForOnlineShop', 'Signing you in…'],
  ['SignupForOnlineShop', 'Creating your account…'],
  ['ResetPasswordRequestForOnlineShop', 'Sending your reset link…'],
];

/**
 * Covers the screen while the site is waiting on the server, so nothing else can be clicked mid-action
 * — no second order, no coupon redeemed twice, no navigating away half way through.
 *
 * Reads count too: a slow list or detail load leaves the page just as unusable as a slow write. What
 * does not count is anything marked BACKGROUND_REQUEST — store chrome loading behind the boot screen,
 * typeahead, polling, and refreshes a page already reports on itself.
 */
@Injectable()
export class BusyInterceptor implements HttpInterceptor {
  constructor(private busy: AppBusyService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (request.context.get(BACKGROUND_REQUEST)) {
      return next.handle(request);
    }

    this.busy.begin(this.describe(request.url));
    return next.handle(request).pipe(finalize(() => this.busy.end()));
  }

  private describe(url: string): string | undefined {
    return ACTION_MESSAGES.find(([fragment]) => url.includes(fragment))?.[1];
  }
}
