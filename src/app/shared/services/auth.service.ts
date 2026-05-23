import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface ShopAuthSession {
  accessToken: string;
  encryptedAccessToken?: string;
  expireInSeconds?: number;
  userId?: number;
  onlineStoreId?: string;
}

export interface SignupPayload {
  userName: string;
  name: string;
  surname: string;
  emailAddress: string;
  phoneNumber?: string;
  password: string;
  storeId: string;
  tenantId: number;
}

/** Checkout billing fields persisted after login / signup / previous orders. */
export interface ShopCustomerProfile {
  customerName?: string;
  customerMobileNo?: string;
  customerEmail?: string;
  address?: string;
  town?: string;
  state?: string;
  postalcode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private static readonly TOKEN_KEY = 'shop_auth_token';
  private static readonly USER_ID_KEY = 'shop_auth_user_id';
  private static readonly EMAIL_KEY = 'shop_customer_email';
  private static readonly PROFILE_KEY = 'shop_customer_profile';
  private static readonly STORE_KEY = 'shop_store_id';
  private static readonly TENANT_KEY = 'shop_tenant_id';
  private static readonly TENANCY_NAME_KEY = 'shop_tenancy_name';

  constructor(private http: HttpClient, private router: Router) {}

  private apiRoot(): string {
    const b = environment.baseUrl || '';
    return b.endsWith('/') ? b : `${b}/`;
  }

  get tenantId(): number {
    const fromStorage = localStorage.getItem(AuthService.TENANT_KEY);
    if (fromStorage) {
      return +fromStorage;
    }
    return +(environment.shop?.tenantId ?? 1);
  }

  get storeId(): string {
    return localStorage.getItem(AuthService.STORE_KEY)
      || environment.shop?.storeId
      || 'd4d292f5-de72-4742-b728-ea34a1706191';
  }

  get tenancyName(): string {
    return localStorage.getItem(AuthService.TENANCY_NAME_KEY)
      || environment.shop?.tenancyName
      || 'AK Mobile Shop';
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(AuthService.TOKEN_KEY);
  }

  getUserId(): number | null {
    const raw = localStorage.getItem(AuthService.USER_ID_KEY);
    return raw ? +raw : null;
  }

  getCustomerEmail(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const email = localStorage.getItem(AuthService.EMAIL_KEY);
    return email?.trim() || null;
  }

  getCustomerProfile(): ShopCustomerProfile | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(AuthService.PROFILE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as ShopCustomerProfile;
    } catch {
      return null;
    }
  }

  saveCustomerProfile(partial: ShopCustomerProfile): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const current = this.getCustomerProfile() ?? {};
    const merged: ShopCustomerProfile = { ...current };

    (Object.keys(partial) as (keyof ShopCustomerProfile)[]).forEach((key) => {
      const value = partial[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          merged[key] = trimmed;
        }
      }
    });

    if (Object.keys(merged).length === 0) {
      return;
    }

    localStorage.setItem(AuthService.PROFILE_KEY, JSON.stringify(merged));
  }

  /** Loads name/email from session API and merges into stored checkout profile. */
  refreshCustomerProfileFromSession(): Observable<ShopCustomerProfile | null> {
    if (!this.isLoggedIn()) {
      return of(this.getCustomerProfile());
    }

    return this.http
      .get<any>(`${this.apiRoot()}api/services/app/Session/GetCurrentLoginInformations`)
      .pipe(
        map((resp) => {
          const user = resp?.result?.user ?? resp?.user;
          const name = [user?.name ?? user?.Name, user?.surname ?? user?.Surname]
            .map((part) => (part ?? '').toString().trim())
            .filter(Boolean)
            .join(' ');

          const profilePatch: ShopCustomerProfile = {};
          if (name) {
            profilePatch.customerName = name;
          }
          const email = (user?.emailAddress ?? user?.EmailAddress ?? this.getCustomerEmail() ?? '').toString().trim();
          if (email) {
            profilePatch.customerEmail = email;
          }

          if (Object.keys(profilePatch).length) {
            this.saveCustomerProfile(profilePatch);
          }

          return this.getCustomerProfile();
        }),
        catchError(() => of(this.getCustomerProfile()))
      );
  }

  getInitials(): string {
    const email = this.getCustomerEmail();
    if (!email) {
      return '';
    }
    const local = email.split('@')[0] || email;
    const parts = local.replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    const compact = local.replace(/[^a-zA-Z0-9]/g, '');
    if (compact.length >= 2) {
      return compact.substring(0, 2).toUpperCase();
    }
    return (compact[0] || '?').toUpperCase();
  }

  login(email: string, password: string, rememberClient = false): Observable<ShopAuthSession> {
    const body = {
      userNameOrEmailAddress: email.trim(),
      password,
      tenancyName: this.tenancyName,
      rememberClient,
      tenantId: this.tenantId,
      storeId: this.storeId
    };

    return this.http.post<any>(`${this.apiRoot()}api/TokenAuth/AuthenticateForOnlineShop`, body).pipe(
      map((resp) => {
        const data = resp?.result ?? resp;
        if (!data?.accessToken) {
          throw { error: { message: data?.message || 'Login failed. Please check your credentials.' } };
        }
        return data as ShopAuthSession;
      }),
      tap((session) => this.persistSession(session, email.trim())),
      switchMap((session) =>
        this.refreshCustomerProfileFromSession().pipe(
          map(() => session),
          catchError(() => of(session))
        )
      ),
      catchError((err) => throwError(() => err))
    );
  }

  signup(payload: SignupPayload): Observable<string> {
    return this.http.post<any>(`${this.apiRoot()}api/services/app/${environment.urls.OnlinseShopUsers_SignupForOnlineShop}`, payload).pipe(
      map((resp) => {
        const data = resp?.result ?? resp;
        const code = data?.statusCode;
        const ok = code === 200 || code === 'OK' || code === 0;
        if (!ok) {
          throw { error: { message: data?.message || 'Registration failed.' } };
        }
        return data?.message || 'Your account has been created successfully.';
      })
    );
  }

  resetPasswordRequest(emailAddress: string): Observable<string> {
    const body = {
      emailAddress: emailAddress.trim(),
      phoneNumber: '',
      tenantId: this.tenantId
    };

    return this.http.post<any>(`${this.apiRoot()}api/services/app/${environment.urls.OnlinseShopUsers_ResetPasswordRequestForOnlineShop}`, body).pipe(
      map((resp) => {
        const code = resp?.result ?? resp;
        const ok = code === 200 || code === 'OK' || code === 0;
        if (!ok && typeof code !== 'number') {
          return 'If an account exists for this email, reset instructions have been sent.';
        }
        return 'Password reset instructions have been sent to your email.';
      })
    );
  }

  persistSession(session: ShopAuthSession, customerEmail?: string): void {
    localStorage.setItem(AuthService.TOKEN_KEY, session.accessToken);
    if (customerEmail) {
      localStorage.setItem(AuthService.EMAIL_KEY, customerEmail);
    }
    if (session.userId != null) {
      localStorage.setItem(AuthService.USER_ID_KEY, String(session.userId));
    }
    if (session.onlineStoreId) {
      localStorage.setItem(AuthService.STORE_KEY, String(session.onlineStoreId));
    }
    localStorage.setItem(AuthService.TENANT_KEY, String(this.tenantId));
    localStorage.setItem(AuthService.TENANCY_NAME_KEY, this.tenancyName);
    if (customerEmail) {
      this.saveCustomerProfile({ customerEmail });
    }
  }

  seedShopContextFromEnvironment(): void {
    localStorage.setItem(AuthService.STORE_KEY, environment.shop?.storeId || this.storeId);
    localStorage.setItem(AuthService.TENANT_KEY, String(environment.shop?.tenantId ?? 1));
    localStorage.setItem(AuthService.TENANCY_NAME_KEY, environment.shop?.tenancyName || 'AK Mobile Shop');
  }

  logout(navigateToLogin = false): void {
    localStorage.removeItem(AuthService.TOKEN_KEY);
    localStorage.removeItem(AuthService.USER_ID_KEY);
    localStorage.removeItem(AuthService.EMAIL_KEY);
    localStorage.removeItem(AuthService.PROFILE_KEY);
    if (navigateToLogin) {
      this.router.navigate(['/pages/login']);
    }
  }

  navigateToLogin(returnUrl?: string): void {
    this.router.navigate(['/pages/login'], {
      queryParams: returnUrl ? { returnUrl } : undefined
    });
  }

  navigateAfterLogin(returnUrl?: string | null): void {
    const target = returnUrl && returnUrl !== '/pages/login' ? returnUrl : '/shop/collection/left/sidebar';
    this.router.navigateByUrl(target);
  }
}
