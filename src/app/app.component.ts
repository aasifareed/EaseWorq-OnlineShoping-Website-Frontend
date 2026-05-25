import { Component, PLATFORM_ID, Inject, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LoadingBarService } from '@ngx-loading-bar/core';
import { map, delay, withLatestFrom } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from './shared/services/auth.service';
import { ProductService } from './shared/services/product.service';
import { OnlineShopSettingsService } from './shared/services/online-shop-settings.service';
import { OnlineShopPageService } from './shared/services/online-shop-page.service';
import { ThemeService } from './shared/services/theme.service';

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
  
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private loader: LoadingBarService,
    translate: TranslateService,
    private storefrontSettings: OnlineShopSettingsService,
    private pageService: OnlineShopPageService,
    private themeService: ThemeService,
    private productService: ProductService,
    // @Inject(PLATFORM_ID) private platformId: Object,
    auth: AuthService
  ) {
  // constructor(@Inject(PLATFORM_ID) private platformId: Object,
  //   private loader: LoadingBarService,
  //   translate: TranslateService,
  //   auth: AuthService) {
    if (isPlatformBrowser(this.platformId)) {
      translate.setDefaultLang('en');
      translate.addLangs(['en', 'fr']);
      auth.seedShopContextFromEnvironment();
      this.themeService.init();
    }
  }

  ngOnInit(): void {
    
    if (isPlatformBrowser(this.platformId)) {
      this.storefrontSettings.loadStorefront().subscribe((storefront) => {
        this.pageService.clearActivePagesCache();
        if (storefront) {
          this.productService.applyStoreCurrency(storefront);
        }
      });
    }
  }
}
