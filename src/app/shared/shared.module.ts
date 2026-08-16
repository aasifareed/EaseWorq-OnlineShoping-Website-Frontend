import { NgModule } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CarouselModule } from 'ngx-owl-carousel-o';
import { BarRatingModule } from "ngx-bar-rating";
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { TranslateModule } from '@ngx-translate/core';

import { HeaderOneComponent } from './header/header-one/header-one.component';
import { FooterOneComponent } from './footer/footer-one/footer-one.component';

import { LeftMenuComponent } from './components/left-menu/left-menu.component';
import { MenuComponent } from './components/menu/menu.component';
import { SettingsComponent } from './components/settings/settings.component';
import { CategoriesComponent } from './components/categories/categories.component';
import { BreadcrumbComponent } from './components/breadcrumb/breadcrumb.component';
import { ProductBoxOneComponent } from './components/product/product-box-one/product-box-one.component';
import { ProductBoxVerticalComponent } from './components/product/product-box-vertical/product-box-vertical.component';
import { ProductBoxVerticalSliderComponent } from './components/product/product-box-vertical-slider/product-box-vertical-slider.component';

import { NewsletterComponent } from './components/modal/newsletter/newsletter.component';
import { QuickViewComponent } from './components/modal/quick-view/quick-view.component';
import { CartModalComponent } from './components/modal/cart-modal/cart-modal.component';
import { CartVariationComponent } from './components/modal/cart-variation/cart-variation.component';
import { SizeModalComponent } from './components/modal/size-modal/size-modal.component';

import { SkeletonProductBoxComponent } from './components/skeleton/skeleton-product-box/skeleton-product-box.component';
import { TapToTopComponent } from './components/tap-to-top/tap-to-top.component';
import { BusyOverlayComponent } from './components/busy-overlay/busy-overlay.component';

import { DiscountPipe } from './pipes/discount.pipe';
import { ShopCurrencyPipe } from './pipes/shop-currency.pipe';
import { ContrastTextPipe } from './pipes/contrast-text.pipe';
import { RelativeTimePipe } from './pipes/relative-time.pipe';
import { ExcerptPipe } from './pipes/excerpt.pipe';
import { RemoteSrcPipe } from './pipes/remote-src.pipe';
import { TopCategoriesSliderComponent } from './components/top-categories-slider/top-categories-slider.component';
import { DeliveryDealsBannerComponent } from './components/delivery-deals-banner/delivery-deals-banner.component';
import { GoogleSignInButtonComponent } from './components/google-sign-in-button/google-sign-in-button.component';

@NgModule({
  declarations: [
    HeaderOneComponent,
    FooterOneComponent,
    LeftMenuComponent,
    MenuComponent,
    SettingsComponent,
    BreadcrumbComponent,
    CategoriesComponent,
    ProductBoxOneComponent,
    ProductBoxVerticalComponent,
    ProductBoxVerticalSliderComponent,
    NewsletterComponent,
    QuickViewComponent,
    CartModalComponent,
    CartVariationComponent,
    SizeModalComponent,
    SkeletonProductBoxComponent,
    TapToTopComponent,
    BusyOverlayComponent,
    DiscountPipe,
    ShopCurrencyPipe,
    ContrastTextPipe,
    RelativeTimePipe,
    ExcerptPipe,
    RemoteSrcPipe,
    TopCategoriesSliderComponent,
    DeliveryDealsBannerComponent,
    GoogleSignInButtonComponent,
  ],
  imports: [
    CommonModule,
    NgOptimizedImage,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    CarouselModule,
    BarRatingModule,
    LazyLoadImageModule,
    NgxSkeletonLoaderModule,
    TranslateModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    CarouselModule,
    BarRatingModule,
    LazyLoadImageModule,
    NgxSkeletonLoaderModule,
    TranslateModule,
    HeaderOneComponent,
    FooterOneComponent,
    BreadcrumbComponent,
    CategoriesComponent,
    ProductBoxOneComponent,
    ProductBoxVerticalComponent,
    ProductBoxVerticalSliderComponent,
    NewsletterComponent,
    QuickViewComponent,
    CartModalComponent,
    CartVariationComponent,
    SizeModalComponent,
    SkeletonProductBoxComponent,
    TapToTopComponent,
    BusyOverlayComponent,
    DiscountPipe,
    ShopCurrencyPipe,
    ContrastTextPipe,
    RelativeTimePipe,
    ExcerptPipe,
    RemoteSrcPipe,
    TopCategoriesSliderComponent,
    DeliveryDealsBannerComponent,
    GoogleSignInButtonComponent,
  ]
})
export class SharedModule { }
