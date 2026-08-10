import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { AppBusyService } from '../../services/app-busy.service';

@Component({
  selector: 'app-busy-overlay',
  templateUrl: './busy-overlay.component.html',
  styleUrls: ['./busy-overlay.component.scss']
})
export class BusyOverlayComponent {
  readonly isBusy$: Observable<boolean>;
  readonly message$: Observable<string | null>;

  constructor(busy: AppBusyService, @Inject(PLATFORM_ID) platformId: Object) {
    // Nobody can click during a server render, and a pending timer there would hold up the response.
    const isBrowser = isPlatformBrowser(platformId);
    this.isBusy$ = isBrowser ? busy.isBusy$ : of(false);
    this.message$ = isBrowser ? busy.message$ : of(null);
  }
}
