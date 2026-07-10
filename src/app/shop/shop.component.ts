import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { OnlineShopSettingsService } from '../shared/services/online-shop-settings.service';
import { OnlineShopStorefront } from '../shared/models/online-shop-storefront.model';

@Component({
  selector: 'app-shop',
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.scss'],
})
export class ShopComponent implements OnInit, OnDestroy {
  storefront: OnlineShopStorefront | null = null;
  storefrontLoading = true;
  themeLogo = 'assets/images/icon/logo.png';
  hideNavigationBar = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private storefrontSettings: OnlineShopSettingsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.syncNavigationBarVisibility(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe((event) => this.syncNavigationBarVisibility(event.urlAfterRedirects));

    this.storefrontSettings.storefront$
      .pipe(takeUntil(this.destroy$))
      .subscribe((storefront) => {
        this.storefront = storefront;
        this.storefrontLoading = false;
        if (storefront?.logoUrl) {
          this.themeLogo = storefront.logoUrl;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncNavigationBarVisibility(url: string): void {
    const path = (url || '').split('?')[0].split('#').pop() || '';
    this.hideNavigationBar = /^\/shop\/checkout\/?$/.test(path);
  }
}
