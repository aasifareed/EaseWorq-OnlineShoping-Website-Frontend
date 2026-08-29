import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
export interface PriceChallengeChatProductContext {
  productTitle: string;
  productPrice?: number;
  productImageUrl?: string;
  currencySymbol?: string;
}

const SESSION_KEY = 'shop_price_challenge_chat_session';

export interface PriceChallengeChatSession {
  product: PriceChallengeChatProductContext;
  startedAt: string;
  /** Quantity the customer chose on the product page before starting the challenge. */
  requestedQuantity?: number;
}

export function readPriceChallengeChatSession(): PriceChallengeChatSession | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PriceChallengeChatSession;
    if (!parsed?.product?.productTitle) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePriceChallengeChatSession(session: PriceChallengeChatSession | null): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  if (!session) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearPriceChallengeChatSession(): void {
  writePriceChallengeChatSession(null);
}
