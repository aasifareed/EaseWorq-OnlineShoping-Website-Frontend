import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { extractAbpErrorMessage, isAbpFailure } from '../utils/abp-http.util';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private readonly skipAuthUrls = [
    '/api/TokenAuth/AuthenticateForOnlineShop',
    '/api/TokenAuth/AuthenticateWithGoogleForOnlineShop',
    '/api/TokenAuth/Authenticate'
  ];

  constructor(
    private auth: AuthService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let request = req;

    if (!this.shouldSkipAuth(req.url) && this.auth.getToken()) {
      request = req.clone({
        setHeaders: {
          Authorization: `Bearer ${this.auth.getToken()}`
        }
      });
    }

    return next.handle(request).pipe(
      mergeMap((event) => {
        // ABP UserFriendlyException is often HTTP 200 with { success: false, error.message }.
        if (event instanceof HttpResponse && isAbpFailure(event.body)) {
          return throwError(
            () =>
              new HttpErrorResponse({
                error: event.body,
                headers: event.headers,
                status: event.status >= 400 ? event.status : 400,
                statusText: event.statusText || 'AbpError',
                url: event.url || req.url
              })
          );
        }
        return of(event);
      }),
      catchError((error: HttpErrorResponse) => {
        this.handleHttpError(error, req.url);
        return throwError(() => error);
      })
    );
  }

  private shouldSkipAuth(url: string): boolean {
    return this.skipAuthUrls.some((u) => url.includes(u));
  }

  private handleHttpError(error: HttpErrorResponse, url: string): void {
    const message = extractAbpErrorMessage(error);

    if (error.status === 401) {
      const hadToken = !!this.auth.getToken();
      if (hadToken && !this.shouldSkipAuth(url)) {
        this.auth.logout(false);
        this.toastr.error('Your session has expired. Please sign in again.');
        this.router.navigate(['/pages/login'], {
          queryParams: { returnUrl: this.router.url }
        });
      } else if (!this.shouldSkipAuth(url)) {
        this.toastr.error(message);
      }
      return;
    }

    if (error.status === 400) {
      const validation = error?.error?.error?.validationErrors;
      if (validation?.length) {
        validation.forEach((v: { message?: string }) => {
          if (v?.message) {
            this.toastr.error(v.message);
          }
        });
      } else {
        this.toastr.error(message);
      }
      return;
    }

    if (error.status === 0) {
      this.toastr.error('Unable to reach the server. Check your connection.');
      return;
    }

    if (error.status >= 500) {
      this.toastr.error(message);
      return;
    }

    this.toastr.error(message);
  }
}
