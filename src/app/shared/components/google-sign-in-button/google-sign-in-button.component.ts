import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { environment } from 'src/environments/environment';

const WEB_CLIENT_ID =
  (environment as { googleClientId?: string }).googleClientId?.trim()
  || '845543032039-b34k6kg6h54i25vdrjjb3vco49uln8a2.apps.googleusercontent.com';

@Component({
  selector: 'app-google-sign-in-button',
  templateUrl: './google-sign-in-button.component.html',
  styleUrls: ['./google-sign-in-button.component.scss']
})
export class GoogleSignInButtonComponent implements AfterViewInit, OnDestroy {
  @Input() disabled = false;
  @Output() credential = new EventEmitter<string>();
  @Output() failed = new EventEmitter<string>();
  @ViewChild('gisButtonHost') gisButtonHost?: ElementRef<HTMLDivElement>;

  /** Native app keeps Capacitor Google Auth; website must use GIS (new clients block legacy gapi). */
  readonly isNative = Capacitor.isNativePlatform();

  busy = false;
  private nativeInitialized = false;
  private destroyed = false;

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    if (!this.isNative) {
      void this.renderWebGisButton();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    try {
      window.google?.accounts?.id?.cancel();
    } catch {
      // ignore
    }
  }

  async onNativeClick(): Promise<void> {
    if (!this.isNative || this.disabled || this.busy) {
      return;
    }

    this.busy = true;
    try {
      await this.ensureNativeInitialized();
      const user = await GoogleAuth.signIn();
      const idToken =
        user?.authentication?.idToken?.trim()
        || (user as { idToken?: string })?.idToken?.trim()
        || '';

      if (!idToken) {
        throw new Error('Google did not return an ID token.');
      }

      this.credential.emit(idToken);
    } catch (err: any) {
      if (!this.isUserCancel(err)) {
        this.failed.emit(this.resolveErrorMessage(err));
      }
    } finally {
      this.busy = false;
    }
  }

  private async renderWebGisButton(): Promise<void> {
    try {
      const gis = await this.waitForGis();
      if (this.destroyed || !this.gisButtonHost?.nativeElement) {
        return;
      }

      gis.initialize({
        client_id: WEB_CLIENT_ID,
        callback: (response) => this.onGisCredential(response?.credential),
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
        context: 'signin',
        use_fedcm_for_prompt: true
      });

      const host = this.gisButtonHost.nativeElement;
      host.innerHTML = '';
      const width = Math.min(320, Math.max(240, host.clientWidth || host.parentElement?.clientWidth || 320));

      gis.renderButton(host, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width
      });
    } catch (err: any) {
      if (!this.destroyed) {
        this.failed.emit(this.resolveErrorMessage(err));
      }
    }
  }

  private onGisCredential(credential: string | undefined): void {
    this.ngZone.run(() => {
      const idToken = credential?.trim() || '';
      if (!idToken) {
        this.failed.emit('Google did not return an ID token.');
        return;
      }
      this.credential.emit(idToken);
    });
  }

  private waitForGis(timeoutMs = 12000): Promise<typeof google.accounts.id> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const gis = window.google?.accounts?.id;
        if (gis?.initialize && gis?.renderButton) {
          resolve(gis);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          reject(new Error('Google Sign-In failed to load. Please refresh and try again.'));
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }

  private async ensureNativeInitialized(): Promise<void> {
    if (this.nativeInitialized) {
      return;
    }

    try {
      await GoogleAuth.initialize({
        clientId: WEB_CLIENT_ID,
        scopes: ['profile', 'email'],
        grantOfflineAccess: false
      });
      this.nativeInitialized = true;
    } catch {
      try {
        await GoogleAuth.initialize();
        this.nativeInitialized = true;
      } catch {
        // Leave uninitialized; sign-in will surface the error.
      }
    }
  }

  private isUserCancel(err: any): boolean {
    const text = String(err?.message || err?.error || err || '').toLowerCase();
    return text.includes('cancel')
      || text.includes('popup_closed')
      || text.includes('closed by user')
      || err?.code === '10'
      || err?.error === 'popup_closed_by_user';
  }

  private resolveErrorMessage(err: any): string {
    const raw = String(err?.message || err?.error || err?.error_description || err || '').trim();
    if (!raw) {
      return 'Google sign-in failed. Please try again.';
    }
    if (/deprecated|migration guide|new libraries/i.test(raw)) {
      return 'Google Sign-In needs an update on this site. Please refresh and try again.';
    }
    if (this.isNative && /12501|developer_error|10\b/i.test(raw)) {
      return 'Google sign-in is not configured for this app build. Check SHA-1 and Android client ID.';
    }
    return raw;
  }
}
