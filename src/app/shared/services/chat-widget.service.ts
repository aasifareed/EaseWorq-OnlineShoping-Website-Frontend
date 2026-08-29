import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import {
  clearPriceChallengeChatSession,
  PriceChallengeChatProductContext,
  PriceChallengeChatSession,
  readPriceChallengeChatSession,
  writePriceChallengeChatSession,
} from '../models/price-challenge-chat-session.model';

export type { PriceChallengeChatProductContext };

export interface ChatWidgetOpenRequest {
  welcomeMessage?: string;
  loadHistory?: boolean;
  priceChallenge?: PriceChallengeChatProductContext;
}

@Injectable({
  providedIn: 'root',
})
export class ChatWidgetService {
  private readonly openRequestSubject = new Subject<ChatWidgetOpenRequest>();
  readonly openRequest$ = this.openRequestSubject.asObservable();

  open(request: ChatWidgetOpenRequest = {}): void {
    this.openRequestSubject.next({
      loadHistory: request.priceChallenge ? false : true,
      ...request,
    });
  }

  readSavedPriceChallengeSession(): PriceChallengeChatSession | null {
    return readPriceChallengeChatSession();
  }

  savePriceChallengeSession(product: PriceChallengeChatProductContext): void {
    const existing = readPriceChallengeChatSession();
    writePriceChallengeChatSession({
      product,
      startedAt: existing?.startedAt || new Date().toISOString(),
      requestedQuantity: existing?.requestedQuantity,
    });
  }

  clearPriceChallengeSession(): void {
    clearPriceChallengeChatSession();
  }
}
