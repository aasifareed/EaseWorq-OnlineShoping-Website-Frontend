import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-google-sign-in-button',
  templateUrl: './google-sign-in-button.component.html',
  styleUrls: ['./google-sign-in-button.component.scss']
})
export class GoogleSignInButtonComponent implements AfterViewInit, OnDestroy {
  @Input() disabled = false;
  @Output() credential = new EventEmitter<string>();

  @ViewChild('googleButton', { static: true }) googleButton?: ElementRef<HTMLElement>;

  private initialized = false;
  private pollHandle: number | null = null;

  ngAfterViewInit(): void {
    this.waitForGoogleAndRender();
  }

  ngOnDestroy(): void {
    if (this.pollHandle != null) {
      window.clearInterval(this.pollHandle);
    }
  }

  private waitForGoogleAndRender(): void {
    if (this.renderIfReady()) {
      return;
    }

    let attempts = 0;
    this.pollHandle = window.setInterval(() => {
      attempts += 1;
      if (this.renderIfReady() || attempts > 40) {
        if (this.pollHandle != null) {
          window.clearInterval(this.pollHandle);
          this.pollHandle = null;
        }
      }
    }, 250);
  }

  private renderIfReady(): boolean {
    const clientId = environment.googleClientId?.trim();
    const host = this.googleButton?.nativeElement;
    const googleId = (window as any).google?.accounts?.id;
    if (!clientId || !host || !googleId || this.initialized) {
      return !!this.initialized;
    }

    googleId.initialize({
      client_id: clientId,
      callback: (response: { credential?: string }) => {
        const token = response?.credential?.trim();
        if (token && !this.disabled) {
          this.credential.emit(token);
        }
      }
    });

    // Keep width content-sized. Stretching to the form width forces Google's
    // GIS button to leave a large gap between the icon and label.
    googleId.renderButton(host, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 240
    });

    this.initialized = true;
    return true;
  }
}
