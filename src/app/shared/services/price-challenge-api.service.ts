import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { asBackgroundRequest } from '../interceptors/background-request';
import { OnlineShopCartLineInput } from './online-shop-checkout.service';
import { StorefrontTenantService } from './storefront-tenant.service';

export interface SubmitManualCompetitorPriceInput {
  challengeId: string;
  competitorPrice: number;
}

export interface StartPriceChallengeContextInput {
  chatUserId: string;
  productId: string;
  productInventoryId?: string;
  variantId?: string;
  productSlug?: string;
  sourceChannel?: string;
}

export interface StartPriceChallengeContextResult {
  contextId: string;
  priceChallengeId?: string;
  replacedPreviousContext?: boolean;
}

export interface PriceChallengeDto {
  id: string;
  status?: string;
  decision?: string;
  approvedOfferPrice?: number;
  offerExpiresAt?: string;
  offerToken?: string;
  productSlug?: string;
  productId?: string;
  productInventoryId?: string;
  quantityLimit?: number;
}

export interface GetPriceChallengeCheckoutOfferInput {
  priceChallengeId: string;
  chatUserId: string;
}

export interface PriceChallengeCheckoutOffer {
  priceChallengeId: string;
  offerToken: string;
  productId: string;
  productInventoryId?: string;
  productSlug?: string;
  approvedOfferPrice?: number;
  quantityLimit: number;
  offerExpiresAt?: string;
}

export interface ValidatePriceChallengeOfferInput {
  priceChallengeId: string;
  offerToken: string;
  items?: OnlineShopCartLineInput[];
}

export interface PriceChallengeOfferValidationResult {
  isValid: boolean;
  message?: string;
  productId?: string;
  productInventoryId?: string;
  approvedOfferPrice?: number;
  quantityLimit?: number;
  offerExpiresAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PriceChallengeApiService {
  constructor(
    private http: HttpClient,
    private storefrontTenant: StorefrontTenantService,
  ) {}

  submitManualCompetitorPrice(input: SubmitManualCompetitorPriceInput): Observable<PriceChallengeDto> {
    const path = environment.urls?.PriceChallenge_SubmitManualCompetitorPrice || 'PriceChallenge/SubmitManualCompetitorPrice';
    const url = this.storefrontTenant.buildAppServiceUrl(this.apiRoot(), path);
    return this.http.post<any>(url, input, this.requestOptions()).pipe(
      map((resp) => this.mapChallenge(resp?.result)),
    );
  }

  startContext(input: StartPriceChallengeContextInput): Observable<StartPriceChallengeContextResult> {
    const path = environment.urls?.PriceChallenge_StartContext || 'PriceChallenge/StartContext';
    const url = this.storefrontTenant.buildAppServiceUrl(this.apiRoot(), path);
    return this.http.post<any>(url, input, this.requestOptions()).pipe(
      map((resp) => this.mapStartContext(resp?.result)),
    );
  }

  endContext(contextId: string): Observable<void> {
    const path = environment.urls?.PriceChallenge_EndContext || 'PriceChallenge/EndContext';
    const url = this.storefrontTenant.buildAppServiceUrl(this.apiRoot(), path);
    const params = new HttpParams().set('contextId', contextId);
    return this.http.post<any>(url, null, { ...this.requestOptions(), params }).pipe(
      map(() => undefined),
    );
  }

  getCheckoutOffer(input: GetPriceChallengeCheckoutOfferInput): Observable<PriceChallengeCheckoutOffer> {
    const path = environment.urls?.PriceChallenge_GetCheckoutOffer || 'PriceChallenge/GetCheckoutOffer';
    const url = this.storefrontTenant.buildAppServiceUrl(this.apiRoot(), path);
    const params = new HttpParams()
      .set('PriceChallengeId', input.priceChallengeId)
      .set('ChatUserId', input.chatUserId);
    return this.http.get<any>(url, { ...this.requestOptions(), params }).pipe(
      map((resp) => this.mapCheckoutOffer(resp?.result)),
    );
  }

  validateOffer(input: ValidatePriceChallengeOfferInput): Observable<PriceChallengeOfferValidationResult> {
    const path = environment.urls?.PriceChallenge_ValidateOffer || 'PriceChallenge/ValidateOffer';
    const url = this.storefrontTenant.buildAppServiceUrl(this.apiRoot(), path);
    return this.http.post<any>(url, input, this.requestOptions()).pipe(
      map((resp) => this.mapValidation(resp?.result)),
    );
  }

  private mapCheckoutOffer(raw: any): PriceChallengeCheckoutOffer {
    return {
      priceChallengeId: String(raw?.priceChallengeId || raw?.PriceChallengeId || ''),
      offerToken: String(raw?.offerToken || raw?.OfferToken || ''),
      productId: String(raw?.productId || raw?.ProductId || ''),
      productInventoryId: raw?.productInventoryId || raw?.ProductInventoryId
        ? String(raw.productInventoryId || raw.ProductInventoryId)
        : undefined,
      productSlug: raw?.productSlug || raw?.ProductSlug,
      approvedOfferPrice: raw?.approvedOfferPrice ?? raw?.ApprovedOfferPrice,
      quantityLimit: Number(raw?.quantityLimit ?? raw?.QuantityLimit ?? 1),
      offerExpiresAt: raw?.offerExpiresAt || raw?.OfferExpiresAt,
    };
  }

  private mapValidation(raw: any): PriceChallengeOfferValidationResult {
    return {
      isValid: !!(raw?.isValid ?? raw?.IsValid),
      message: raw?.message || raw?.Message,
      productId: raw?.productId || raw?.ProductId ? String(raw.productId || raw.ProductId) : undefined,
      productInventoryId: raw?.productInventoryId || raw?.ProductInventoryId
        ? String(raw.productInventoryId || raw.ProductInventoryId)
        : undefined,
      approvedOfferPrice: raw?.approvedOfferPrice ?? raw?.ApprovedOfferPrice,
      quantityLimit: raw?.quantityLimit ?? raw?.QuantityLimit,
      offerExpiresAt: raw?.offerExpiresAt || raw?.OfferExpiresAt,
    };
  }

  private mapStartContext(raw: any): StartPriceChallengeContextResult {
    if (!raw) {
      return { contextId: '' };
    }
    return {
      contextId: String(raw.contextId || raw.ContextId || ''),
      priceChallengeId: raw.priceChallengeId || raw.PriceChallengeId
        ? String(raw.priceChallengeId || raw.PriceChallengeId)
        : undefined,
      replacedPreviousContext: !!(raw.replacedPreviousContext ?? raw.ReplacedPreviousContext),
    };
  }

  private mapChallenge(raw: any): PriceChallengeDto {
    if (!raw) {
      return { id: '' };
    }
    return {
      id: String(raw.id || raw.Id || ''),
      status: raw.status || raw.Status,
      decision: raw.decision || raw.Decision,
      approvedOfferPrice: raw.approvedOfferPrice ?? raw.ApprovedOfferPrice,
      offerExpiresAt: raw.offerExpiresAt || raw.OfferExpiresAt,
      offerToken: raw.offerToken || raw.OfferToken,
      productSlug: raw.productSlug || raw.ProductSlug,
    };
  }

  private apiRoot(): string {
    const base = environment.baseUrl || '';
    return base.endsWith('/') ? base : `${base}/`;
  }

  private requestOptions() {
    return asBackgroundRequest({ headers: this.storefrontTenant.requestHeaders() });
  }
}
