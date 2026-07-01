import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ShopContextService } from './shop-context.service';
import { TenantService } from './tenant.service';

export interface ShopAuthSession {
  accessToken: string;
  encryptedAccessToken?: string;
  expireInSeconds?: number;
  /** Stored as string — ABP user ids exceed JS Number.MAX_SAFE_INTEGER. */
  userId?: string;
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
  address?: string;
  townCity?: string;
  stateCounty?: string;
  postalCode?: string;
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
  private static readonly ENCRYPTED_TOKEN_KEY = 'shop_auth_encrypted_token';
  private static readonly USER_ID_KEY = 'shop_auth_user_id';
  private static readonly EMAIL_KEY = 'shop_customer_email';
  private static readonly PROFILE_KEY = 'shop_customer_profile';
  private static readonly STORE_KEY = 'shop_store_id';
  private static readonly TENANT_KEY = 'shop_tenant_id';
  private static readonly TENANCY_NAME_KEY = 'shop_tenancy_name';

  constructor(
    private http: HttpClient,
    private router: Router,
    private shopContext: ShopContextService,
    private tenantService: TenantService,
  ) {}

  private apiRoot(): string {
    const b = environment.baseUrl || '';
    return b.endsWith('/') ? b : `${b}/`;
  }

  get tenantId(): number {
    return this.tenantService.snapshot?.tenantId ?? this.shopContext.resolveTenantId();
  }

  get storeId(): string {
    return this.tenantService.snapshot?.storeId ?? this.shopContext.resolveStoreId();
  }

  get tenancyName(): string {
    return this.tenantService.snapshot?.tenancyName
      || this.shopContext.getTenancyName()
      || environment.shop?.tenancyName
      || '';
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

  getEncryptedToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(AuthService.ENCRYPTED_TOKEN_KEY);
  }

  getUserId(): string | null {
    const raw = localStorage.getItem(AuthService.USER_ID_KEY)?.trim();
    return raw || null;
  }

  getCustomerEmail(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const fromStorage = localStorage.getItem(AuthService.EMAIL_KEY)?.trim();
    if (fromStorage) {
      return fromStorage;
    }

    const fromProfile = this.getCustomerProfile()?.customerEmail?.trim();
    if (fromProfile) {
      localStorage.setItem(AuthService.EMAIL_KEY, fromProfile);
      return fromProfile;
    }

    const fromToken = this.getEmailFromAccessToken();
    if (fromToken) {
      localStorage.setItem(AuthService.EMAIL_KEY, fromToken);
      return fromToken;
    }

    return null;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) {
      return {};
    }
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  }

  /** JWT sub/nameidentifier is a string and preserves large ABP user ids. */
  getUserIdFromAccessToken(token?: string | null): string | null {
    const rawToken = token ?? this.getToken();
    if (!rawToken) {
      return null;
    }

    try {
      const payload = this.decodeJwtPayload(rawToken);
      const id =
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
        ?? payload.sub
        ?? payload.nameid
        ?? payload.userId
        ?? payload.UserId;

      const normalized = id != null ? String(id).trim() : '';
      return /^\d+$/.test(normalized) ? normalized : null;
    } catch {
      return null;
    }
  }

  /** Re-sync localStorage user id from JWT (fixes precision loss from API numeric userId). */
  syncUserIdFromToken(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const fromToken = this.getUserIdFromAccessToken();
    if (fromToken) {
      localStorage.setItem(AuthService.USER_ID_KEY, fromToken);
    }
  }

  private getEmailFromAccessToken(): string | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    try {
      const payload = this.decodeJwtPayload(token);
      const email =
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
        ?? payload.email
        ?? payload.Email
        ?? payload.unique_name
        ?? payload.preferred_username;

      return typeof email === 'string' && email.includes('@') ? email.trim() : null;
    } catch {
      return null;
    }
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
            localStorage.setItem(AuthService.EMAIL_KEY, email);
          }

          const phone = (user?.phoneNumber ?? user?.PhoneNumber ?? '').toString().trim();
          if (phone) {
            profilePatch.customerMobileNo = phone;
          }

          if (Object.keys(profilePatch).length) {
            this.saveCustomerProfile(profilePatch);
          }

          return this.getCustomerProfile();
        }),
        catchError(() => of(this.getCustomerProfile()))
      );
  }

  /** Session + POS customer + latest order billing for checkout prefill. */
  refreshCustomerProfileForCheckout(): Observable<ShopCustomerProfile | null> {
    if (!this.isLoggedIn()) {
      return of(this.getCustomerProfile());
    }

    return this.refreshCustomerProfileFromSession().pipe(
      switchMap(() => this.fetchCustomerProfileFromStore()),
      map(() => this.getCustomerProfile()),
      catchError(() => of(this.getCustomerProfile()))
    );
  }

  private fetchCustomerProfileFromStore(): Observable<void> {
    const email = this.getCustomerEmail();
    if (!email) {
      return of(undefined);
    }

    const url = `${this.apiRoot()}api/services/app/${environment.urls.OnlinseShopUsers_GetCustomerProfileForOnlineShop}`;
    const params = new HttpParams()
      .set('StoreId', this.storeId)
      .set('TenantId', String(this.tenantId))
      .set('CustomerEmail', email);

    return this.http.get<any>(url, { params }).pipe(
      tap((resp) => {
        const data = resp?.result ?? resp;
        if (!data) {
          return;
        }

        this.saveCustomerProfile({
          customerName: data.customerName ?? data.CustomerName,
          customerMobileNo: data.customerMobileNo ?? data.CustomerMobileNo,
          customerEmail: data.customerEmail ?? data.CustomerEmail ?? email,
          address: data.address ?? data.Address,
          town: data.town ?? data.Town,
          state: data.state ?? data.State,
          postalcode: data.postalcode ?? data.Postalcode ?? data.postalCode ?? data.PostalCode,
        });
      }),
      map(() => undefined),
      catchError(() => of(undefined))
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
        const accessToken = data?.accessToken ?? data?.AccessToken;
        const session: ShopAuthSession = {
          accessToken,
          encryptedAccessToken: data?.encryptedAccessToken ?? data?.EncryptedAccessToken,
          expireInSeconds: data?.expireInSeconds ?? data?.ExpireInSeconds,
          userId: this.getUserIdFromAccessToken(accessToken),
          onlineStoreId: data?.onlineStoreId ?? data?.OnlineStoreId
        };
        if (!session.accessToken) {
          throw { error: { message: data?.message || 'Login failed. Please check your credentials.' } };
        }
        return session;
      }),
      tap((session) => this.persistSession(session, email.trim())),
      switchMap((session) =>
        this.refreshCustomerProfileForCheckout().pipe(
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
    if (session.encryptedAccessToken) {
      localStorage.setItem(AuthService.ENCRYPTED_TOKEN_KEY, session.encryptedAccessToken);
    }
    if (customerEmail) {
      localStorage.setItem(AuthService.EMAIL_KEY, customerEmail);
    }
    const userId = session.userId ?? this.getUserIdFromAccessToken(session.accessToken);
    if (userId) {
      localStorage.setItem(AuthService.USER_ID_KEY, userId);
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
    if (this.tenantService.snapshot?.resolved) {
      if (this.isLoggedIn()) {
        this.syncUserIdFromToken();
      }
      return;
    }

    if (this.isLoggedIn()) {
      this.syncUserIdFromToken();
    }
  }

  logout(navigateToLogin = false): void {
    localStorage.removeItem(AuthService.TOKEN_KEY);
    localStorage.removeItem(AuthService.ENCRYPTED_TOKEN_KEY);
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
