import {
  AfterViewChecked,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ChatApiService } from '../../services/chat-api.service';
import { ChatConnectionState, ChatHubService, ChatPrivateMessage } from '../../services/chat-hub.service';
import { AuthService } from '../../services/auth.service';
import { TenantService } from '../../services/tenant.service';
import { PriceChallengeApiService } from '../../services/price-challenge-api.service';
import { ChatWidgetService } from '../../services/chat-widget.service';
import {
  ChatHistoryItem,
  CHAT_MESSAGE_TYPES,
  CHAT_HISTORY_CHANNELS,
  PRICE_CHALLENGE_ACTION_TYPES,
  PRICE_CHALLENGE_DECISIONS,
  PRICE_CHALLENGE_STATUSES,
  PriceChallengeChatAction,
  PriceChallengeResultMetadata,
  chatImageUrl,
  encodeChatImage,
  isChatImageMessage,
  isPriceChallengeChatMessage,
  isStructuredPriceChallengeMessage,
  isPriceChallengeResultMessage,
  isAcceptedPriceChallengeOfferMessage,
  parsePriceChallengeNeedsManualPriceMetadata,
  parsePriceChallengeProcessingMetadata,
  parsePriceChallengeResultMetadata,
  resolvePriceChallengeResultActions,
} from '../../models/chat.model';
import { rewriteMediaUrl } from '../../services/media-url';
import { PriceChallengeCheckoutService } from '../../services/price-challenge-checkout.service';
import { extractAbpErrorMessage } from '../../utils/abp-http.util';
import { ChatWidgetOpenRequest, PriceChallengeChatProductContext } from '../../services/chat-widget.service';

const PRICE_CHALLENGE_WELCOME =
  'Send a competitor screenshot or product link in this chat and we will try to beat that price for this item.';

@Component({
  selector: 'app-chat-widget',
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.scss'],
  host: {
    '[class.shop-chat-host--open]': 'open',
    '[class.shop-chat-host--maximized]': 'open && maximized',
  },
})
export class ChatWidgetComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer: ElementRef<HTMLDivElement>;
  @ViewChild('imageInput') private imageInput: ElementRef<HTMLInputElement>;

  open = false;
  maximized = false;
  visible = false;
  draft = '';
  sending = false;
  unread = 0;
  manualPriceChallengeId = '';
  manualPriceDraft: string | number = '';
  buyNowLoadingChallengeId = '';
  priceChallengeContext: PriceChallengeChatProductContext | null = null;
  private static readonly maxImageBytes = 5 * 1024 * 1024;
  private static readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  messages: ChatHistoryItem[] = [];
  connectionState: ChatConnectionState = 'disconnected';
  supportOnline = false;
  private shouldScroll = false;
  private readonly subs: Subscription[] = [];
  private priceChallengePollTimer: ReturnType<typeof setInterval> | null = null;
  private priceChallengeExitTimer: ReturnType<typeof setTimeout> | null = null;
  private priceChallengePollAttempts = 0;
  private priceChallengeSessionStartedAt: string | null = null;
  private static readonly priceChallengePollIntervalMs = 3000;
  private static readonly priceChallengePollMaxAttempts = 40;
  private static readonly priceChallengeExitDelayMs = 2500;
  private static readonly scrollThresholdPx = 80;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private chatApi: ChatApiService,
    private chatHub: ChatHubService,
    private auth: AuthService,
    private tenantService: TenantService,
    private priceChallengeApi: PriceChallengeApiService,
    private chatWidgetService: ChatWidgetService,
    private priceChallengeCheckout: PriceChallengeCheckoutService,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.visible = !this.router.url.includes('site-not-available');
    this.subs.push(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => {
          this.visible = !event.urlAfterRedirects.includes('site-not-available');
          if (!this.isProductPageUrl(event.urlAfterRedirects)) {
            this.endActivePriceChallengeContext();
            this.chatWidgetService.clearPriceChallengeSession();
            this.priceChallengeContext = null;
            this.priceChallengeSessionStartedAt = null;
            this.stopPriceChallengePoll();
            if (this.open) {
              this.loadHistory();
            }
          }
        }),
      this.tenantService.shopContext$
        .pipe(filter((ctx) => !!ctx?.resolved && !!ctx.tenantId))
        .subscribe(() => this.connect()),
      this.auth.isLoggedIn$.subscribe(() => {
        if (this.chatHub.connected) {
          void this.chatHub.registerCustomer().catch(() => undefined);
        }
      }),
      this.chatHub.connectionState$.subscribe((state) => {
        this.connectionState = state;
      }),
      this.chatHub.supportOnline$.subscribe((online) => {
        this.supportOnline = online;
      }),
      this.chatHub.privateMessage$.subscribe((payload) => this.handleIncoming(payload)),
      this.chatWidgetService.openRequest$.subscribe((request) => this.handleOpenRequest(request)),
    );
    this.refreshSupportStatus();
    void this.chatHub.requestSupportStatus();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.stopPriceChallengePoll();
    this.clearPriceChallengeExitTimer();
    this.subs.forEach((sub) => sub.unsubscribe());
  }

  toggle(): void {
    if (this.open) {
      this.hideChatPanel();
      return;
    }

    this.open = true;
    this.unread = 0;
    this.queueScroll(true);
    this.connect();
    if (this.isPriceChallengeMode) {
      this.queueScroll(true);
      this.startPriceChallengePoll();
      this.refreshPriceChallengeMessages();
    } else {
      this.loadHistory();
    }
    void this.chatHub.requestSupportStatus();
  }

  hideChatPanel(): void {
    this.open = false;
    this.maximized = false;
  }

  closeChatPanel(): void {
    if (this.isPriceChallengeMode) {
      this.endPriceChallengePermanently();
      return;
    }

    this.hideChatPanel();
  }

  endPriceChallengePermanently(): void {
    this.exitPriceChallengeMode(false);
    this.hideChatPanel();
  }

  toggleMaximize(): void {
    if (!this.open) {
      return;
    }
    this.maximized = !this.maximized;
    this.queueScroll(true);
  }

  private isProductPageUrl(url: string): boolean {
    return /\/shop\/product(?:\/|$|\?)/i.test(url || '');
  }

  get isPriceChallengeMode(): boolean {
    return !!this.priceChallengeContext;
  }

  get chatHeaderTitle(): string {
    return this.isPriceChallengeMode ? 'Sasta Price Challenge' : 'Customer Support';
  }

  get composerPlaceholder(): string {
    return this.isPriceChallengeMode
      ? 'Send competitor screenshot or link…'
      : 'Write a message...';
  }

  formatProductPrice(): string {
    const ctx = this.priceChallengeContext;
    if (!ctx?.productPrice || !Number.isFinite(ctx.productPrice)) {
      return '';
    }
    const symbol = (ctx.currencySymbol || 'Rs').trim();
    return `${symbol} ${ctx.productPrice.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  private handleOpenRequest(request: ChatWidgetOpenRequest): void {
    if (!this.open) {
      this.open = true;
      this.unread = 0;
    }
    this.queueScroll(true);
    this.connect();
    void this.chatHub.requestSupportStatus();

    if (request.priceChallenge) {
      this.priceChallengeContext = request.priceChallenge;
      this.chatWidgetService.savePriceChallengeSession(request.priceChallenge);
      this.beginPriceChallengeSession(request.welcomeMessage);
      return;
    }

    this.switchToSupportChat({
      welcomeMessage: request.welcomeMessage,
      loadHistory: request.loadHistory,
    });
  }

  private switchToSupportChat(options?: { welcomeMessage?: string; loadHistory?: boolean }): void {
    this.exitPriceChallengeMode(false);
    this.stopPriceChallengePoll();
    const welcome = (options?.welcomeMessage || '').trim();
    const shouldLoadHistory = options?.loadHistory !== false;

    if (shouldLoadHistory) {
      this.loadHistory(welcome || undefined);
      return;
    }

    this.messages = [];
    if (welcome) {
      this.appendLocalHint(welcome);
    }
  }

  private beginPriceChallengeSession(welcomeMessage?: string): void {
    const savedSession = this.chatWidgetService.readSavedPriceChallengeSession();
    this.priceChallengeSessionStartedAt = savedSession?.startedAt ?? new Date().toISOString();
    this.stopPriceChallengePoll();
    this.manualPriceChallengeId = '';
    this.manualPriceDraft = '';

    const welcome = (welcomeMessage || PRICE_CHALLENGE_WELCOME).trim();
    this.messages = [
      {
        message: welcome,
        fromAdmin: true,
        timestamp: new Date().toISOString(),
        messageType: CHAT_MESSAGE_TYPES.system,
      },
    ];
    this.queueScroll(true);
    this.startPriceChallengePoll();
    this.refreshPriceChallengeMessages();
  }

  private queueScroll(force = false): void {
    if (force || this.isNearBottom()) {
      this.shouldScroll = true;
    }
  }

  private isNearBottom(): boolean {
    const el = this.messagesContainer?.nativeElement;
    if (!el) {
      return true;
    }

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= ChatWidgetComponent.scrollThresholdPx;
  }

  private isMessageInCurrentPriceChallengeSession(item: ChatHistoryItem): boolean {
    if (!this.priceChallengeSessionStartedAt) {
      return true;
    }

    const sessionStart = new Date(this.priceChallengeSessionStartedAt).getTime();
    if (!Number.isFinite(sessionStart)) {
      return true;
    }

    const messageTime = new Date(item.timestamp || 0).getTime();
    return Number.isFinite(messageTime) && messageTime >= sessionStart - 2000;
  }

  private appendLocalHint(message: string): void {
    const last = this.messages[this.messages.length - 1];
    if (last?.message === message && !!last.fromAdmin) {
      return;
    }
    this.messages = [
      ...this.messages,
      {
        message,
        fromAdmin: true,
        timestamp: new Date().toISOString(),
        messageType: CHAT_MESSAGE_TYPES.system,
      },
    ];
    this.queueScroll();
  }

  send(): void {
    const text = (this.draft || '').trim();
    if (!text || this.sending) {
      return;
    }
    this.deliver(text, true);
  }

  onPickImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.sendImage(file);
    }
  }

  onPaste(event: ClipboardEvent): void {
    const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith('image/'));
    if (!file) {
      return;
    }
    event.preventDefault();
    this.sendImage(file);
  }

  isImage(message?: string): boolean {
    return isChatImageMessage(message);
  }

  imageSrc(message?: string): string {
    return rewriteMediaUrl(chatImageUrl(message));
  }

  isStructuredMessage(message: ChatHistoryItem): boolean {
    return isStructuredPriceChallengeMessage(message.messageType)
      || isPriceChallengeResultMessage(message)
      || message.messageType === CHAT_MESSAGE_TYPES.system;
  }

  isProcessingMessage(message: ChatHistoryItem): boolean {
    return message.messageType === CHAT_MESSAGE_TYPES.priceChallengeProcessing;
  }

  isResultMessage(message: ChatHistoryItem): boolean {
    return isPriceChallengeResultMessage(this.enrichAcceptedOfferMessage(message));
  }

  resultMetadata(message: ChatHistoryItem): PriceChallengeResultMetadata | null {
    const metadata = parsePriceChallengeResultMetadata(message.metadataJson);
    if (metadata?.offerPrice != null) {
      return metadata;
    }

    const offerPrice = this.parseOfferPriceFromMessage(message.message);
    if (offerPrice == null) {
      return metadata;
    }

    return {
      ...metadata,
      challengeId: metadata?.challengeId || message.priceChallengeId,
      decision: metadata?.decision || PRICE_CHALLENGE_DECISIONS.challengeAccepted,
      offerPrice,
    };
  }

  resultActions(message: ChatHistoryItem): PriceChallengeChatAction[] {
    return resolvePriceChallengeResultActions(this.enrichAcceptedOfferMessage(message));
  }

  processingChallengeId(message: ChatHistoryItem): string | undefined {
    return message.priceChallengeId
      || parsePriceChallengeProcessingMetadata(message.metadataJson)?.challengeId;
  }

  formatOfferPrice(value?: number): string {
    if (value == null || !Number.isFinite(value)) {
      return '';
    }
    return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  isBuyNowLoading(action: PriceChallengeChatAction): boolean {
    if (action?.type !== PRICE_CHALLENGE_ACTION_TYPES.buyNow) {
      return false;
    }
    const challengeId = (action.challengeId || '').trim();
    return !!challengeId && this.buyNowLoadingChallengeId === challengeId;
  }

  runChallengeAction(action: PriceChallengeChatAction): void {
    if (!action?.type) {
      return;
    }

    switch (action.type) {
      case PRICE_CHALLENGE_ACTION_TYPES.enterCompetitorPrice:
        this.openManualPriceEntry(action.challengeId);
        break;
      case PRICE_CHALLENGE_ACTION_TYPES.sendAnotherScreenshot:
        this.promptAnotherScreenshot();
        break;
      case PRICE_CHALLENGE_ACTION_TYPES.buyNow:
        this.goToChallengeProduct(action);
        break;
      default:
        break;
    }
  }

  openManualPriceEntry(challengeId?: string): void {
    const id = (challengeId || '').trim();
    if (!id) {
      this.toastr.error('Could not start manual price entry.');
      return;
    }
    this.manualPriceChallengeId = id;
    this.manualPriceDraft = '';
  }

  cancelManualPriceEntry(): void {
    this.manualPriceChallengeId = '';
    this.manualPriceDraft = '';
  }

  get hasManualPriceDraft(): boolean {
    return this.normalizeManualPriceDraft().length > 0;
  }

  private normalizeManualPriceDraft(): string {
    if (this.manualPriceDraft == null) {
      return '';
    }

    return String(this.manualPriceDraft).trim().replace(/,/g, '');
  }

  submitManualPrice(): void {
    const challengeId = this.manualPriceChallengeId.trim();
    const raw = this.normalizeManualPriceDraft();
    const competitorPrice = Number(raw);
    if (!challengeId) {
      return;
    }
    if (!Number.isFinite(competitorPrice) || competitorPrice <= 0) {
      this.toastr.error('Enter a valid competitor price.');
      return;
    }
    if (this.sending) {
      return;
    }

    this.sending = true;
    this.priceChallengeApi.submitManualCompetitorPrice({ challengeId, competitorPrice }).subscribe({
      next: () => {
        this.sending = false;
        this.cancelManualPriceEntry();
        this.toastr.success('Price submitted. We are checking your offer.');
      },
      error: (err) => {
        this.sending = false;
        const message = err?.error?.error?.message || 'Could not submit the price. Please try again.';
        this.toastr.error(message);
      },
    });
  }

  onEnter(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  formatTime(value: string | Date): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  isSameDay(current: ChatHistoryItem, previous?: ChatHistoryItem): boolean {
    if (!previous?.timestamp || !current?.timestamp) {
      return false;
    }
    const a = new Date(current.timestamp);
    const b = new Date(previous.timestamp);
    return a.toDateString() === b.toDateString();
  }

  dayLabel(value: string | Date): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private promptAnotherScreenshot(): void {
    this.toastr.info('Send another screenshot using the photo button below.');
    this.imageInput?.nativeElement?.click();
  }

  private goToChallengeProduct(action: PriceChallengeChatAction): void {
    const challengeId = (action.challengeId || '').trim();
    if (!challengeId) {
      this.toastr.error('Offer link is not available yet.');
      return;
    }
    if (this.buyNowLoadingChallengeId) {
      return;
    }

    this.buyNowLoadingChallengeId = challengeId;

    this.priceChallengeCheckout.resolveCheckoutOffer(challengeId).subscribe({
      next: (offer) => {
        void this.priceChallengeCheckout.prepareBuyNowCheckout(offer).then((ready) => {
          this.buyNowLoadingChallengeId = '';
          if (!ready) {
            this.toastr.error('Could not prepare checkout for this offer.');
            return;
          }
          void this.router.navigate(['/shop/checkout']);
        }).catch(() => {
          this.buyNowLoadingChallengeId = '';
          this.toastr.error('Could not prepare checkout for this offer.');
        });
      },
      error: (err) => {
        this.buyNowLoadingChallengeId = '';
        this.toastr.error(extractAbpErrorMessage(err, 'This offer is no longer available.'));
      },
    });
  }

  private sendImage(file: File): void {
    if (this.sending) {
      return;
    }
    if (
      !ChatWidgetComponent.allowedImageTypes.includes(file.type) &&
      !/\.(jpe?g|png|gif|webp)$/i.test(file.name)
    ) {
      this.toastr.error('Please send a JPG, PNG, GIF, or WEBP image.');
      return;
    }
    if (file.size > ChatWidgetComponent.maxImageBytes) {
      this.toastr.error('Image must be 5 MB or smaller.');
      return;
    }

    this.sending = true;
    this.chatApi.uploadImage(file).subscribe({
      next: (url) => {
        if (!url) {
          this.sending = false;
          this.toastr.error('Could not upload the image. Please try again.');
          return;
        }
        this.deliver(encodeChatImage(url), false);
      },
      error: () => {
        this.sending = false;
      },
    });
  }

  private deliver(text: string, clearDraft: boolean): void {
    const sentAt = new Date().toISOString();
    const isEvidence = this.isPriceChallengeMode && this.isEvidenceMessage(text);
    const optimisticMessage: ChatHistoryItem = {
      message: text,
      fromAdmin: false,
      timestamp: sentAt,
      messageType: isEvidence ? CHAT_MESSAGE_TYPES.priceChallengeEvidence : 'Text',
    };

    if (isEvidence) {
      this.appendMessage(optimisticMessage);
    }

    this.sending = true;
    this.chatHub
      .sendMessage(text, { isPriceChallengeEvidence: isEvidence })
      .then(() => {
        if (!isEvidence) {
          this.appendMessage(optimisticMessage);
        }
        if (clearDraft) {
          this.draft = '';
        }
        this.sending = false;
        if (isEvidence) {
          this.startPriceChallengePoll();
        }
      })
      .catch((err) => {
        if (isEvidence) {
          this.removeEvidenceMessage(text);
        }
        this.sending = false;
        const message = this.extractSendErrorMessage(err);
        this.toastr.error(message);
      });
  }

  private connect(): void {
    this.chatHub.startConnection();
  }

  private refreshSupportStatus(): void {
    this.chatApi.getSupportStatus().subscribe((status) => {
      this.supportOnline = !!status?.isOnline;
    });
  }

  private loadHistory(welcomeAfter?: string): void {
    this.chatApi.getChatHistory(this.chatHub.chatUserId, CHAT_HISTORY_CHANNELS.support).subscribe((history) => {
      this.messages = history || [];
      if (welcomeAfter) {
        this.appendLocalHint(welcomeAfter);
      }
      this.queueScroll(true);
    });
  }

  private shouldDisplayIncomingMessage(payload: ChatPrivateMessage): boolean {
    const incoming: ChatHistoryItem = {
      message: payload.message,
      fromAdmin: payload.fromAdmin,
      timestamp: payload.timestamp || new Date().toISOString(),
      messageType: payload.messageType || 'Text',
      metadataJson: payload.metadataJson,
      priceChallengeId: payload.priceChallengeId,
    };

    if (this.isPriceChallengeMode) {
      return isPriceChallengeChatMessage(incoming)
        || isAcceptedPriceChallengeOfferMessage(incoming.message)
        || (!incoming.fromAdmin && this.isEvidenceMessage(incoming.message));
    }

    return !isPriceChallengeChatMessage(incoming);
  }

  private handleIncoming(payload: ChatPrivateMessage): void {
    if (this.shouldIgnoreLegacyIncoming(payload)) {
      return;
    }

    if (!this.shouldDisplayIncomingMessage(payload)) {
      return;
    }

    const incoming: ChatHistoryItem = this.enrichAcceptedOfferMessage({
      message: payload.message,
      fromAdmin: payload.fromAdmin,
      timestamp: payload.timestamp || new Date().toISOString(),
      messageType: payload.messageType || 'Text',
      metadataJson: payload.metadataJson,
      priceChallengeId: payload.priceChallengeId,
    });

    if (this.isDuplicateIncoming(payload, incoming)) {
      return;
    }

    this.messages = [...this.messages, incoming];
    this.messages = this.sortMessages(this.messages);
    this.finalizePriceChallengeUi(incoming);
    this.queueScroll();
    if (!this.open && payload.fromAdmin) {
      this.unread += 1;
    }
  }

  private shouldIgnoreLegacyIncoming(payload: ChatPrivateMessage): boolean {
    if (!this.isPriceChallengeMode || !payload.fromAdmin) {
      return false;
    }

    const incomingType = (payload.messageType || '').trim();
    const hasStructuredPayload = !!incomingType || !!payload.metadataJson;
    if (hasStructuredPayload) {
      return false;
    }

    const message = (payload.message || '').trim();
    if (!message) {
      return true;
    }

    return this.messages.some(
      (item) =>
        item.fromAdmin
        && item.message === message
        && (
          item.messageType === CHAT_MESSAGE_TYPES.priceChallengeResult
          || item.messageType === CHAT_MESSAGE_TYPES.priceChallengeProcessing
        ),
    );
  }

  private isDuplicateIncoming(payload: ChatPrivateMessage, incoming: ChatHistoryItem): boolean {
    const incomingType = (incoming.messageType || CHAT_MESSAGE_TYPES.text).trim();
    const last = this.messages[this.messages.length - 1];
    if (!last) {
      return false;
    }

    const sameBody = last.message === payload.message && !!last.fromAdmin === !!payload.fromAdmin;
    if (!sameBody) {
      return false;
    }

    const incomingHasStructuredData = !!(
      payload.messageType
      || payload.metadataJson
      || payload.priceChallengeId
    );

    if (
      incomingHasStructuredData
      && (
        last.messageType !== incoming.messageType
        || last.metadataJson !== payload.metadataJson
        || last.priceChallengeId !== payload.priceChallengeId
      )
    ) {
      const upgraded = this.enrichAcceptedOfferMessage({
        ...last,
        messageType: incoming.messageType,
        metadataJson: incoming.metadataJson,
        priceChallengeId: incoming.priceChallengeId || last.priceChallengeId,
        timestamp: incoming.timestamp || last.timestamp,
      });
      this.messages = [...this.messages.slice(0, -1), upgraded];
      this.finalizePriceChallengeUi(upgraded);
      return true;
    }

    if (
      incomingType === CHAT_MESSAGE_TYPES.priceChallengeResult
      && last.messageType !== CHAT_MESSAGE_TYPES.priceChallengeResult
    ) {
      const upgraded = this.enrichAcceptedOfferMessage({
        ...last,
        messageType: incoming.messageType,
        metadataJson: incoming.metadataJson,
        priceChallengeId: incoming.priceChallengeId || last.priceChallengeId,
        timestamp: incoming.timestamp || last.timestamp,
      });
      this.messages = [...this.messages.slice(0, -1), upgraded];
      this.finalizePriceChallengeUi(upgraded);
      return true;
    }

    if (payload.messageType && !last.messageType) {
      this.messages = [
        ...this.messages.slice(0, -1),
        this.enrichAcceptedOfferMessage({
          ...last,
          messageType: incoming.messageType,
          metadataJson: incoming.metadataJson,
          priceChallengeId: incoming.priceChallengeId || last.priceChallengeId,
          timestamp: incoming.timestamp || last.timestamp,
        }),
      ];
      return true;
    }

    if (
      !payload.messageType
      && last.messageType === CHAT_MESSAGE_TYPES.priceChallengeResult
    ) {
      return true;
    }

    return sameBody && incomingType === (last.messageType || CHAT_MESSAGE_TYPES.text);
  }

  private enrichAcceptedOfferMessage(message: ChatHistoryItem): ChatHistoryItem {
    if (parsePriceChallengeResultMetadata(message.metadataJson)?.decision) {
      return message.messageType === CHAT_MESSAGE_TYPES.priceChallengeResult
        ? message
        : {
          ...message,
          messageType: CHAT_MESSAGE_TYPES.priceChallengeResult,
        };
    }

    if (!message.fromAdmin || !isAcceptedPriceChallengeOfferMessage(message.message)) {
      return message;
    }

    const challengeId = (
      message.priceChallengeId
      || parsePriceChallengeResultMetadata(message.metadataJson)?.challengeId
      || this.findLatestProcessingChallengeId()
      || ''
    ).trim();

    if (!challengeId) {
      return message;
    }

    return {
      ...message,
      messageType: CHAT_MESSAGE_TYPES.priceChallengeResult,
      priceChallengeId: challengeId,
    };
  }

  private findLatestProcessingChallengeId(): string | undefined {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const challengeId = this.resolveChallengeId(this.messages[index]);
      if (challengeId) {
        return challengeId;
      }
    }
    return undefined;
  }

  private parseOfferPriceFromMessage(message?: string | null): number | undefined {
    const match = (message || '').match(/private offer price is\s*([\d,]+(?:\.\d+)?)/i);
    if (!match?.[1]) {
      return undefined;
    }
    const parsed = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  private extractSendErrorMessage(err: unknown): string {
    const raw = (err as { message?: string })?.message || '';
    const hubMatch = raw.match(/HubException:\s*(.+)$/i);
    if (hubMatch?.[1]) {
      return hubMatch[1].trim();
    }
    if (raw.trim()) {
      return raw.trim();
    }
    return 'Could not send your message. Please try again.';
  }

  private isEvidenceMessage(message: string): boolean {
    const text = (message || '').trim();
    return isChatImageMessage(text) || /^https?:\/\/\S+$/i.test(text);
  }

  private startPriceChallengePoll(): void {
    this.stopPriceChallengePoll();
    this.priceChallengePollAttempts = 0;
    void this.refreshPriceChallengeMessages();
    this.priceChallengePollTimer = setInterval(() => {
      this.priceChallengePollAttempts += 1;
      void this.refreshPriceChallengeMessages();
      if (this.priceChallengePollAttempts >= ChatWidgetComponent.priceChallengePollMaxAttempts) {
        if (this.isPriceChallengeMode && this.open) {
          this.priceChallengePollAttempts = 0;
        } else {
          this.stopPriceChallengePoll();
        }
      }
    }, ChatWidgetComponent.priceChallengePollIntervalMs);
  }

  private stopPriceChallengePoll(): void {
    if (this.priceChallengePollTimer) {
      clearInterval(this.priceChallengePollTimer);
      this.priceChallengePollTimer = null;
    }
    this.priceChallengePollAttempts = 0;
  }

  private refreshPriceChallengeMessages(): void {
    this.chatApi.getChatHistory(this.chatHub.chatUserId, CHAT_HISTORY_CHANNELS.priceChallenge).subscribe((history) => {
      const added = this.mergePriceChallengeHistory(history || []);
      if (!added && !this.hasPendingPriceChallengeProcessing() && !(this.isPriceChallengeMode && this.open)) {
        this.stopPriceChallengePoll();
      }
    });
  }

  private mergePriceChallengeHistory(history: ChatHistoryItem[]): boolean {
    if (!history.length) {
      return false;
    }

    const existing = new Set(this.messages.map((item) => this.messageKey(item)));
    const additions: ChatHistoryItem[] = [];

    for (const item of history) {
      if (!this.isMessageInCurrentPriceChallengeSession(item)) {
        continue;
      }

      const enriched = this.enrichAcceptedOfferMessage(item);
      const isStructured = isStructuredPriceChallengeMessage(enriched.messageType);
      const isEvidence = enriched.messageType === CHAT_MESSAGE_TYPES.priceChallengeEvidence;
      if (!enriched.fromAdmin && !isStructured && !isEvidence) {
        continue;
      }
      const key = this.messageKey(enriched);
      if (!existing.has(key)) {
        existing.add(key);
        additions.push(enriched);
      }
    }

    if (!additions.length) {
      return false;
    }

    for (const item of additions) {
      if (item.messageType === CHAT_MESSAGE_TYPES.priceChallengeEvidence && !item.fromAdmin) {
        this.removeEvidenceMessage(item.message);
      }
      if (isPriceChallengeResultMessage(item) && item.fromAdmin) {
        this.removePlainAdminTwin(item.message);
        this.upgradePlainAcceptedOfferTwin(item);
      }
    }

    this.messages = this.sortMessages([...this.messages, ...additions]);
    additions.forEach((item) => this.finalizePriceChallengeUi(item));
    this.pruneResolvedProcessingMessages();
    this.queueScroll();

    if (!this.hasPendingPriceChallengeProcessing()) {
      if (!(this.isPriceChallengeMode && this.open)) {
        this.stopPriceChallengePoll();
      }
    }

    this.checkExitPriceChallengeIfDeclined();

    return true;
  }

  private hasPendingPriceChallengeProcessing(): boolean {
    return this.messages.some(
      (message) => message.messageType === CHAT_MESSAGE_TYPES.priceChallengeProcessing,
    );
  }

  private finalizePriceChallengeUi(message: ChatHistoryItem): void {
    if (message.messageType === CHAT_MESSAGE_TYPES.priceChallengeResult) {
      this.pruneResolvedProcessingMessages();
      this.stopPriceChallengePoll();
      if (this.isDeclinedPriceChallengeResult(message)) {
        this.scheduleExitPriceChallengeMode(true);
      }
    }
  }

  private isDeclinedPriceChallengeResult(message: ChatHistoryItem): boolean {
    if (message.messageType !== CHAT_MESSAGE_TYPES.priceChallengeResult) {
      return false;
    }

    const metadata = parsePriceChallengeResultMetadata(message.metadataJson);
    if (!metadata) {
      return false;
    }

    const decision = (metadata.decision || '').trim();
    if (decision === PRICE_CHALLENGE_DECISIONS.challengeAccepted) {
      return false;
    }

    const status = (metadata.challengeStatus || '').trim();
    if (
      status === PRICE_CHALLENGE_STATUSES.completed
      || status === PRICE_CHALLENGE_STATUSES.manualReview
      || status === PRICE_CHALLENGE_STATUSES.needsMoreInformation
    ) {
      return false;
    }

    return status === PRICE_CHALLENGE_STATUSES.rejected;
  }

  private checkExitPriceChallengeIfDeclined(): void {
    if (!this.isPriceChallengeMode) {
      return;
    }

    if (this.messages.some((item) => this.isDeclinedPriceChallengeResult(item))) {
      this.scheduleExitPriceChallengeMode(true);
    }
  }

  private scheduleExitPriceChallengeMode(preserveMessages: boolean): void {
    if (!this.isPriceChallengeMode && !this.priceChallengeSessionStartedAt) {
      return;
    }

    if (this.priceChallengeExitTimer) {
      return;
    }

    this.priceChallengeExitTimer = setTimeout(() => {
      this.priceChallengeExitTimer = null;
      this.exitPriceChallengeMode(preserveMessages);
    }, ChatWidgetComponent.priceChallengeExitDelayMs);
  }

  private clearPriceChallengeExitTimer(): void {
    if (this.priceChallengeExitTimer) {
      clearTimeout(this.priceChallengeExitTimer);
      this.priceChallengeExitTimer = null;
    }
  }

  private exitPriceChallengeMode(preserveMessages: boolean): void {
    this.clearPriceChallengeExitTimer();
    if (!this.isPriceChallengeMode && !this.priceChallengeSessionStartedAt) {
      return;
    }

    const savedSession = this.chatWidgetService.readSavedPriceChallengeSession();
    const contextId = (savedSession?.contextId || '').trim();
    if (contextId) {
      this.priceChallengeApi.endContext(contextId).subscribe({ error: () => undefined });
    }

    this.chatWidgetService.clearPriceChallengeSession();
    this.priceChallengeContext = null;
    this.priceChallengeSessionStartedAt = null;
    this.manualPriceChallengeId = '';
    this.manualPriceDraft = '';
    this.stopPriceChallengePoll();

    if (!preserveMessages) {
      this.messages = [];
    }
  }

  private endActivePriceChallengeContext(): void {
    const savedSession = this.chatWidgetService.readSavedPriceChallengeSession();
    const contextId = (savedSession?.contextId || '').trim();
    if (!contextId) {
      return;
    }

    this.priceChallengeApi.endContext(contextId).subscribe({ error: () => undefined });
  }

  private pruneResolvedProcessingMessages(): void {
    const resolvedChallengeIds = new Set<string>();
    for (const message of this.messages) {
      if (message.messageType !== CHAT_MESSAGE_TYPES.priceChallengeResult) {
        continue;
      }
      const challengeId = this.resolveChallengeId(message);
      if (challengeId) {
        resolvedChallengeIds.add(challengeId);
      }
    }

    if (!resolvedChallengeIds.size) {
      return;
    }

    this.messages = this.messages.filter((message) => {
      if (message.messageType !== CHAT_MESSAGE_TYPES.priceChallengeProcessing) {
        return true;
      }
      const challengeId = this.resolveChallengeId(message);
      return !challengeId || !resolvedChallengeIds.has(challengeId);
    });
  }

  private resolveChallengeId(message: ChatHistoryItem): string | undefined {
    return message.priceChallengeId
      || parsePriceChallengeResultMetadata(message.metadataJson)?.challengeId
      || parsePriceChallengeProcessingMetadata(message.metadataJson)?.challengeId
      || parsePriceChallengeNeedsManualPriceMetadata(message.metadataJson)?.challengeId;
  }

  private appendMessage(message: ChatHistoryItem): void {
    this.messages = this.sortMessages([...this.messages, message]);
    this.queueScroll(true);
  }

  private removePlainAdminTwin(message: string): void {
    const normalized = (message || '').trim();
    if (!normalized) {
      return;
    }

    this.messages = this.messages.filter((item) =>
      !(
        item.fromAdmin
        && item.message === normalized
        && item.messageType !== CHAT_MESSAGE_TYPES.priceChallengeResult
      ));
  }

  private upgradePlainAcceptedOfferTwin(structured: ChatHistoryItem): void {
    const normalized = (structured.message || '').trim();
    if (!normalized) {
      return;
    }

    let upgraded = false;
    this.messages = this.messages.map((item) => {
      if (
        item.fromAdmin
        && item.message === normalized
        && item.messageType !== CHAT_MESSAGE_TYPES.priceChallengeResult
      ) {
        upgraded = true;
        return this.enrichAcceptedOfferMessage({
          ...structured,
          timestamp: structured.timestamp || item.timestamp,
        });
      }
      return item;
    });

    if (!upgraded && isPriceChallengeResultMessage(structured)) {
      this.messages = this.sortMessages([...this.messages, structured]);
    }
  }

  private removeEvidenceMessage(message: string): void {
    const normalized = (message || '').trim();
    if (!normalized) {
      return;
    }

    this.messages = this.messages.filter((item) =>
      item.messageType !== CHAT_MESSAGE_TYPES.priceChallengeEvidence
      || item.fromAdmin
      || item.message !== normalized);
  }

  private messageKey(item: ChatHistoryItem): string {
    if (!item.fromAdmin && item.messageType === CHAT_MESSAGE_TYPES.priceChallengeEvidence) {
      return `evidence|${(item.message || '').trim()}`;
    }

    return [
      item.fromAdmin ? '1' : '0',
      item.messageType || '',
      item.message || '',
      item.priceChallengeId || '',
    ].join('|');
  }

  private sortMessages(items: ChatHistoryItem[]): ChatHistoryItem[] {
    return [...items].sort((a, b) => {
      const aTime = new Date(a.timestamp || 0).getTime();
      const bTime = new Date(b.timestamp || 0).getTime();
      if (aTime !== bTime) {
        return aTime - bTime;
      }

      if (!!a.fromAdmin !== !!b.fromAdmin) {
        return a.fromAdmin ? 1 : -1;
      }

      const rank = (messageType?: string): number => {
        if (messageType === CHAT_MESSAGE_TYPES.priceChallengeProcessing) {
          return 0;
        }
        if (messageType === CHAT_MESSAGE_TYPES.priceChallengeResult) {
          return 1;
        }
        return 2;
      };

      return rank(a.messageType) - rank(b.messageType);
    });
  }
}
