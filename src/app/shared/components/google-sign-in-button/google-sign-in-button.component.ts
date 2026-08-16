import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output
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
export class GoogleSignInButtonComponent implements OnInit, OnDestroy {
  @Input() disabled = false;
  @Output() credential = new EventEmitter<string>();
  @Output() failed = new EventEmitter<string>();

  busy = false;
  private initialized = false;

  ngOnInit(): void {
    void this.ensureInitialized();
  }

  ngOnDestroy(): void {
    // no timers
  }

  async onClick(): Promise<void> {
    if (this.disabled || this.busy) {
      return;
    }

    this.busy = true;
    try {
      await this.ensureInitialized();
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
      const message = this.resolveErrorMessage(err);
      // User cancelled — stay quiet.
      if (!this.isUserCancel(err)) {
        this.failed.emit(message);
      }
    } finally {
      this.busy = false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await GoogleAuth.initialize({
        clientId: WEB_CLIENT_ID,
        scopes: ['profile', 'email'],
        grantOfflineAccess: true
      });
      this.initialized = true;
    } catch {
      // Native plugin may already be configured via capacitor.config / strings.xml.
      try {
        await GoogleAuth.initialize();
        this.initialized = true;
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
    const raw = String(err?.message || err?.error || err || '').trim();
    if (!raw) {
      return 'Google sign-in failed. Please try again.';
    }
    if (Capacitor.isNativePlatform() && /12501|developer_error|10\b/i.test(raw)) {
      return 'Google sign-in is not configured for this app build. Check SHA-1 and Android client ID.';
    }
    return raw;
  }
}
