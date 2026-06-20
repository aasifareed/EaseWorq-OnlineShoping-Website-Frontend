import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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

  private readonly destroy$ = new Subject<void>();

  constructor(private storefrontSettings: OnlineShopSettingsService) {}

  ngOnInit(): void {
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
}
