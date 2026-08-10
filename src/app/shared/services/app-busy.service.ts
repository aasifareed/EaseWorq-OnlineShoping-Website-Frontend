import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, concat, of, timer } from 'rxjs';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';

/** How long an action must run before the screen is covered, so quick calls do not flash. */
const OVERLAY_DELAY_MS = 200;

/** A request that never answers must not lock the customer out of the site for good. */
const MAX_OVERLAY_MS = 45000;

/**
 * Tracks work the customer is waiting on, so one screen-wide overlay can stand in front of the page
 * while it runs. Counted rather than a flag: two actions overlapping must not let the first one to
 * finish uncover the page while the second is still going.
 */
@Injectable({ providedIn: 'root' })
export class AppBusyService {
  private readonly pendingCount = new BehaviorSubject<number>(0);
  private readonly message = new BehaviorSubject<string | null>(null);

  readonly isBusy$: Observable<boolean> = this.pendingCount.pipe(
    map((count) => count > 0),
    distinctUntilChanged(),
    switchMap((busy) =>
      busy
        ? concat(
            timer(OVERLAY_DELAY_MS).pipe(map(() => true)),
            timer(MAX_OVERLAY_MS).pipe(map(() => false))
          )
        : of(false)
    ),
    distinctUntilChanged()
  );

  readonly message$: Observable<string | null> = this.message.asObservable();

  begin(message?: string): void {
    if (message) {
      this.message.next(message);
    }
    this.pendingCount.next(this.pendingCount.value + 1);
  }

  end(): void {
    const next = Math.max(0, this.pendingCount.value - 1);
    this.pendingCount.next(next);
    if (next === 0) {
      this.message.next(null);
    }
  }
}
