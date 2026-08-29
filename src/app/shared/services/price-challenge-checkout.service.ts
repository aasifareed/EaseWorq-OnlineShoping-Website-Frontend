import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../classes/product';
import {
  PendingPriceChallengeCheckout,
  PriceChallengeCheckoutOffer,
  clearPendingPriceChallengeCheckout,
  readPendingPriceChallengeCheckout,
  writePendingPriceChallengeCheckout,
} from '../models/price-challenge-checkout.model';
import { readPriceChallengeChatSession } from '../models/price-challenge-chat-session.model';
import { ChatHubService } from './chat-hub.service';
import { PriceChallengeApiService } from './price-challenge-api.service';
import { ProductService } from './product.service';

@Injectable({
  providedIn: 'root',
})
export class PriceChallengeCheckoutService {
  constructor(
    private priceChallengeApi: PriceChallengeApiService,
    private chatHub: ChatHubService,
    private productService: ProductService,
  ) {}

  get pendingOffer(): PendingPriceChallengeCheckout | null {
    return readPendingPriceChallengeCheckout();
  }

  savePendingOffer(offer: PendingPriceChallengeCheckout | null): void {
    writePendingPriceChallengeCheckout(offer);
  }

  clearPendingOffer(): void {
    clearPendingPriceChallengeCheckout();
  }

  resolveCheckoutOffer(challengeId: string): Observable<PriceChallengeCheckoutOffer> {
    return this.priceChallengeApi.getCheckoutOffer({
      priceChallengeId: challengeId,
      chatUserId: this.chatHub.chatUserId,
    });
  }

  async prepareBuyNowCheckout(offer: PriceChallengeCheckoutOffer): Promise<boolean> {
    const product = await this.loadProductForOffer(offer);
    if (!product) {
      return false;
    }

    const quantity = this.resolveCheckoutQuantity(offer, product);
    product.quantity = quantity;

    const existingQty = this.productService.getCartLineQuantity(product.id);
    if (existingQty > 0) {
      this.productService.removeCartItem(product);
    }

    const added = await this.productService.addToCart({
      ...product,
      openCart: false,
    });
    if (!added) {
      return false;
    }

    this.savePendingOffer({
      priceChallengeId: offer.priceChallengeId,
      offerToken: offer.offerToken,
      productId: offer.productId,
      productInventoryId: offer.productInventoryId,
      productSlug: offer.productSlug,
      approvedOfferPrice: offer.approvedOfferPrice,
      quantityLimit: offer.quantityLimit,
      requestedQuantity: quantity,
      offerExpiresAt: offer.offerExpiresAt,
    });

    return true;
  }

  private resolveCheckoutQuantity(offer: PriceChallengeCheckoutOffer, product: Product): number {
    const maxAllowed = Math.max(
      1,
      Math.min(
        offer.quantityLimit > 0 ? offer.quantityLimit : Number.MAX_SAFE_INTEGER,
        Number(product.stock) > 0 ? Number(product.stock) : Number.MAX_SAFE_INTEGER,
      ),
    );
    const requested = this.readRequestedQuantity(offer);
    return Math.max(1, Math.min(requested, maxAllowed));
  }

  private readRequestedQuantity(offer: PriceChallengeCheckoutOffer): number {
    const pending = readPendingPriceChallengeCheckout();
    if (
      pending?.priceChallengeId === offer.priceChallengeId
      && Number(pending.requestedQuantity) > 0
    ) {
      return Math.floor(Number(pending.requestedQuantity));
    }

    const session = readPriceChallengeChatSession();
    if (Number(session?.requestedQuantity) > 0) {
      return Math.floor(Number(session.requestedQuantity));
    }

    return 1;
  }

  private async loadProductForOffer(offer: PriceChallengeCheckoutOffer): Promise<Product | null> {
    const routeKey = (offer.productSlug || offer.productInventoryId || '').trim();
    if (!routeKey) {
      return null;
    }

    return new Promise((resolve) => {
      this.productService.getProductDetailForOnlineShop(routeKey).subscribe({
        next: (resp) => {
          const item = resp?.result;
          if (!item) {
            resolve(null);
            return;
          }
          resolve(this.productService.mapInventoryItemToProduct(item));
        },
        error: () => resolve(null),
      });
    });
  }
}
