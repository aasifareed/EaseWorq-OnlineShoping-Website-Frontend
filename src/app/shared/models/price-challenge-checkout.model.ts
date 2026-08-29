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

export interface PendingPriceChallengeCheckout {
  priceChallengeId: string;
  offerToken: string;
  productId: string;
  productInventoryId?: string;
  productSlug?: string;
  approvedOfferPrice?: number;
  quantityLimit: number;
  requestedQuantity: number;
  offerExpiresAt?: string;
}

const STORAGE_KEY = 'shop_price_challenge_checkout';

export function readPendingPriceChallengeCheckout(): PendingPriceChallengeCheckout | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PendingPriceChallengeCheckout;
    if (!parsed?.priceChallengeId || !parsed?.offerToken || !parsed?.productId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingPriceChallengeCheckout(offer: PendingPriceChallengeCheckout | null): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  if (!offer) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(offer));
}

export function clearPendingPriceChallengeCheckout(): void {
  writePendingPriceChallengeCheckout(null);
}
