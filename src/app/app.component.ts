import { Component, PLATFORM_ID, Inject, OnInit } from '@angular/core';

import { isPlatformBrowser } from '@angular/common';

import { LoadingBarService } from '@ngx-loading-bar/core';

import { combineLatest, Observable } from 'rxjs';

import { map, delay, withLatestFrom, filter, take } from 'rxjs/operators';

import { TranslateService } from '@ngx-translate/core';

import { AuthService } from './shared/services/auth.service';

import { SignalRService } from './shared/services/signal-r.service';

import { ProductService } from './shared/services/product.service';

import { OnlineShopSettingsService } from './shared/services/online-shop-settings.service';

import { OnlineShopPageService } from './shared/services/online-shop-page.service';

import { ThemeService } from './shared/services/theme.service';

import { TenantService } from './shared/services/tenant.service';



@Component({

  selector: 'app-root',

  templateUrl: './app.component.html',

  styleUrls: ['./app.component.scss']

})

export class AppComponent implements OnInit {

  

  // For Progressbar

  loaders = this.loader.progress$.pipe(

    delay(1000),

    withLatestFrom(this.loader.progress$),

    map(v => v[1]),

  );



  readonly bootstrapping$: Observable<boolean> = combineLatest([

    this.tenantService.loading$,

    this.storefrontSettings.loading$,

  ]).pipe(map(([tenantLoading, settingsLoading]) => tenantLoading || settingsLoading));

  

  constructor(

    @Inject(PLATFORM_ID) private platformId: Object,

    private loader: LoadingBarService,

    translate: TranslateService,

    private tenantService: TenantService,

    private storefrontSettings: OnlineShopSettingsService,

    private pageService: OnlineShopPageService,

    private themeService: ThemeService,

    private productService: ProductService,

    private signalRService: SignalRService,

    private auth: AuthService

  ) {

    if (isPlatformBrowser(this.platformId)) {

      translate.setDefaultLang('en');

      translate.addLangs(['en', 'fr']);

      this.themeService.init();

      document.getElementById('storefront-bootstrap-loader')?.remove();

    }

  }



  ngOnInit(): void {

    if (isPlatformBrowser(this.platformId)) {

      this.tenantService.shopContext$

        .pipe(

          filter((ctx) => !!ctx?.resolved),

          take(1),

        )

        .subscribe((ctx) => {

          this.pageService.clearActivePagesCache();

          if (ctx?.storefront) {

            this.productService.applyStoreCurrency(ctx.storefront);

          }

        });



      if (this.auth.isLoggedIn()) {

        this.signalRService.startConnection();

      }

    }

  }

}


