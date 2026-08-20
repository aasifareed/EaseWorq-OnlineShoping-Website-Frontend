import { Component, PLATFORM_ID, Inject, NgZone, OnInit } from '@angular/core';

import { isPlatformBrowser } from '@angular/common';

import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';

import { combineLatest, Observable } from 'rxjs';

import { map, filter, take } from 'rxjs/operators';

import { AppBusyService } from './shared/services/app-busy.service';

import { TranslateService } from '@ngx-translate/core';

import { AuthService } from './shared/services/auth.service';

import { SignalRService } from './shared/services/signal-r.service';

import { ProductService } from './shared/services/product.service';

import { OnlineShopSettingsService } from './shared/services/online-shop-settings.service';

import { ThemeService } from './shared/services/theme.service';

import { TenantService } from './shared/services/tenant.service';

import { MetaTrackingService } from './shared/services/meta-tracking.service';

import { initNativeApp } from './shared/services/native-app';



@Component({

  selector: 'app-root',

  templateUrl: './app.component.html',

  styleUrls: ['./app.component.scss']

})

export class AppComponent implements OnInit {

  

  /** True while a route change is in flight, so the busy overlay is released exactly once. */
  private navigationPending = false;

  readonly bootstrapping$: Observable<boolean> = combineLatest([

    this.tenantService.loading$,

    this.storefrontSettings.loading$,

  ]).pipe(map(([tenantLoading, settingsLoading]) => tenantLoading || settingsLoading));

  

  constructor(

    @Inject(PLATFORM_ID) private platformId: Object,

    private router: Router,

    private busy: AppBusyService,

    translate: TranslateService,

    private tenantService: TenantService,

    private storefrontSettings: OnlineShopSettingsService,

    private themeService: ThemeService,

    private productService: ProductService,

    private signalRService: SignalRService,

    private auth: AuthService,

    private metaTracking: MetaTrackingService,

    private ngZone: NgZone

  ) {

    if (isPlatformBrowser(this.platformId)) {

      translate.setDefaultLang('en');

      translate.addLangs(['en', 'fr']);

      this.themeService.init();

      initNativeApp(this.router, this.ngZone);

      document.getElementById('storefront-bootstrap-loader')?.remove();

    }

  }



  ngOnInit(): void {

    if (isPlatformBrowser(this.platformId)) {

      this.trackNavigation();

      this.tenantService.shopContext$

        .pipe(

          filter((ctx) => !!ctx?.resolved),

          take(1),

        )

        .subscribe((ctx) => {

          if (ctx?.storefront) {

            this.productService.applyStoreCurrency(ctx.storefront);

            this.metaTracking.initFromStorefront();

          }

        });



      if (this.auth.isLoggedIn()) {

        this.signalRService.startConnection();

      }

    }

  }



  /** Covers the screen while a page is being fetched, so a second link cannot be clicked mid-route. */

  private trackNavigation(): void {

    this.router.events.subscribe((event) => {

      if (event instanceof NavigationStart) {

        if (!this.navigationPending) {

          this.navigationPending = true;

          this.busy.begin('Loading…');

        }

        return;

      }

      const settled =

        event instanceof NavigationEnd

        || event instanceof NavigationCancel

        || event instanceof NavigationError;

      if (settled && this.navigationPending) {

        this.navigationPending = false;

        this.busy.end();

      }

    });

  }

}


