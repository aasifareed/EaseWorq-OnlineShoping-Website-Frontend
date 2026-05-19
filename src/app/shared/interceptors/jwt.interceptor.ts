import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private readonly skipAuthUrls = [
    '/api/TokenAuth/AuthenticateForOnlineShop',
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
    const abp = error?.error;
    const message =
      abp?.error?.message
      || abp?.error?.details
      || abp?.message
      || error.message
      || 'Something went wrong. Please try again.';

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
      const validation = abp?.error?.validationErrors;
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

    if (error.status >= 400) {
      this.toastr.error(message);
    }
  }
}
