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
import { ChatConnectionState, ChatHubService } from '../../services/chat-hub.service';
import { AuthService } from '../../services/auth.service';
import { TenantService } from '../../services/tenant.service';
import {
  ChatHistoryItem,
  chatImageUrl,
  encodeChatImage,
  isChatImageMessage,
} from '../../models/chat.model';
import { rewriteMediaUrl } from '../../services/media-url';

@Component({
  selector: 'app-chat-widget',
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.scss'],
})
export class ChatWidgetComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer: ElementRef<HTMLDivElement>;

  open = false;
  visible = false;
  draft = '';
  sending = false;
  unread = 0;
  private static readonly maxImageBytes = 5 * 1024 * 1024;
  private static readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  messages: ChatHistoryItem[] = [];
  connectionState: ChatConnectionState = 'disconnected';
  supportOnline = false;
  private shouldScroll = false;
  private readonly subs: Subscription[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private chatApi: ChatApiService,
    private chatHub: ChatHubService,
    private auth: AuthService,
    private tenantService: TenantService,
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
    this.subs.forEach((sub) => sub.unsubscribe());
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.unread = 0;
      this.shouldScroll = true;
      this.connect();
      this.loadHistory();
      void this.chatHub.requestSupportStatus();
    }
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
    this.sending = true;
    this.chatHub
      .sendMessage(text)
      .then(() => {
        this.messages = [
          ...this.messages,
          { message: text, fromAdmin: false, timestamp: new Date().toISOString() },
        ];
        if (clearDraft) {
          this.draft = '';
        }
        this.sending = false;
        this.shouldScroll = true;
      })
      .catch((err) => {
        this.sending = false;
        const message = err?.message || 'Could not send your message. Please try again.';
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

  private loadHistory(): void {
    this.chatApi.getChatHistory(this.chatHub.chatUserId).subscribe((history) => {
      this.messages = history || [];
      this.shouldScroll = true;
    });
  }

  private handleIncoming(payload: { message: string; fromAdmin: boolean }): void {
    const last = this.messages[this.messages.length - 1];
    if (last && last.message === payload.message && !!last.fromAdmin === !!payload.fromAdmin) {
      return;
    }

    this.messages = [
      ...this.messages,
      {
        message: payload.message,
        fromAdmin: payload.fromAdmin,
        timestamp: new Date().toISOString(),
      },
    ];
    this.shouldScroll = true;
    if (!this.open && payload.fromAdmin) {
      this.unread += 1;
    }
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
