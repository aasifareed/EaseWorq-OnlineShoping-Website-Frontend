import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { Product } from '../classes/product';
import { AuthService } from './auth.service';
import { ChatHubService } from './chat-hub.service';
import { ChatWidgetService, PriceChallengeChatProductContext } from './chat-widget.service';
import { OnlineShopSettingsService } from './online-shop-settings.service';
import { TenantService } from './tenant.service';
import { PriceChallengeApiService, StartPriceChallengeContextInput, StartPriceChallengeContextResult } from './price-challenge-api.service';
import { rewriteMediaUrl } from './media-url';
import { writePriceChallengeChatSession } from '../models/price-challenge-chat-session.model';

export const PRICE_CHALLENGE_WELCOME_MESSAGE =
  'Send a competitor screenshot or product link in this chat and we will try to beat that price for this item.';

@Injectable({
  providedIn: 'root',
})
export class PriceChallengeFlowService {
  constructor(
    private priceChallengeApi: PriceChallengeApiService,
    private chatHub: ChatHubService,
    private chatWidget: ChatWidgetService,
    private onlineShopSettings: OnlineShopSettingsService,
    private tenantService: TenantService,
    private auth: AuthService,
    private router: Router,
    private toastr: ToastrService,
  ) {}

  /** Returns false and sends the customer to sign in when a session is required. */
  requireLoggedIn(returnUrl?: string): boolean {
    if (this.auth.isLoggedIn()) {
      return true;
    }

    this.toastr.info('Please sign in to use Sasta Price Challenge.');
    this.auth.navigateToLogin(returnUrl || this.router.url);
    return false;
  }

  startFromProduct(
    product: Product,
    options?: { openChat?: boolean; welcomeMessage?: string; requestedQuantity?: number },
  ): Observable<StartPriceChallengeContextResult> {
    const openChat = options?.openChat !== false;
    const welcomeMessage = options?.welcomeMessage ?? PRICE_CHALLENGE_WELCOME_MESSAGE;
    const priceChallenge = this.buildProductContext(product);
    const requestedQuantity = this.normalizeRequestedQuantity(options?.requestedQuantity);

    return this.tenantService.whenReady().pipe(
      switchMap(() => this.priceChallengeApi.startContext(this.buildStartInput(product))),
      tap(() => {
        if (openChat) {
          writePriceChallengeChatSession({
            product: priceChallenge,
            startedAt: new Date().toISOString(),
            requestedQuantity,
          });
          this.chatWidget.open({
            welcomeMessage,
            loadHistory: false,
            priceChallenge,
          });
        }
      }),
    );
  }

  buildProductContext(product: Product): PriceChallengeChatProductContext {
    const image =
      product?.pictureUrl
      || product?.images?.[0]?.src
      || undefined;
    const storefront = this.onlineShopSettings.snapshot;

    return {
      productTitle: (product?.title || 'This product').trim(),
      productPrice: product?.price,
      productImageUrl: image ? rewriteMediaUrl(image) : undefined,
      currencySymbol: storefront?.currencySymbol?.trim() || 'Rs',
    };
  }

  buildStartInput(product: Product): StartPriceChallengeContextInput {
    const productId = String(product?.productId ?? '').trim();
    const productInventoryId = product?.id != null ? String(product.id).trim() : undefined;
    const productSlug = String(product?.slug ?? '').trim() || undefined;

    return {
      chatUserId: this.chatHub.chatUserId,
      productId,
      productInventoryId,
      productSlug,
      sourceChannel: 'OnlineShopProductPage',
    };
  }

  canStartForProduct(product: Product | null | undefined): boolean {
    if (!product) {
      return false;
    }
    const productId = String(product.productId ?? '').trim();
    return !!productId && productId !== '00000000-0000-0000-0000-000000000000';
  }

  private normalizeRequestedQuantity(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return Math.floor(parsed);
  }
}
