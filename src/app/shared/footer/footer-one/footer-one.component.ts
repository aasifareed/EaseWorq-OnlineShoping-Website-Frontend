import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { OnlineShopPageMenuItem } from '../../models/online-shop-page.model';
import { OnlineShopStorefront } from '../../models/online-shop-storefront.model';
import { OnlineShopPageService } from '../../services/online-shop-page.service';
import { OnlineShopSettingsService } from '../../services/online-shop-settings.service';
import { StoreLogoService } from '../../services/store-logo.service';

/** Fallback links when no published CMS pages are returned yet. */
export const DEFAULT_FOOTER_PAGE_LINKS: OnlineShopPageMenuItem[] = [
  { title: 'About Us', slug: 'about-us' },
  { title: 'Privacy Policy', slug: 'privacy-policy' },
  { title: 'Terms & Conditions', slug: 'terms-and-conditions' },
];

@Component({
  selector: 'app-footer-one',
  templateUrl: './footer-one.component.html',
  styleUrls: ['./footer-one.component.scss']
})
export class FooterOneComponent implements OnInit, OnDestroy {

  @Input() class: string = 'footer-light';
  @Input() themeLogo: string = 'assets/images/icon/logo.png';
  @Input() newsletter: boolean = true;

  public today: number = Date.now();
  public quickLinkPages: OnlineShopPageMenuItem[] = DEFAULT_FOOTER_PAGE_LINKS;
  public storefront: OnlineShopStorefront | null = null;
  /** Same brand logo source as the main header (StoreLogoService). */
  public storeLogoUrl: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private pageService: OnlineShopPageService,
    private storefrontSettings: OnlineShopSettingsService,
    private storeLogoService: StoreLogoService,
  ) { }

  ngOnInit(): void {
    this.storeLogoUrl = this.storeLogoService.getCachedLogo();
    this.storeLogoService.logoUrl$
      .pipe(takeUntil(this.destroy$))
      .subscribe((logoUrl) => {
        this.storeLogoUrl = logoUrl;
      });

    this.storefrontSettings.storefront$
      .pipe(
        takeUntil(this.destroy$),
        // One load per tenant; avoid snapshot + BehaviorSubject double-fetch.
        distinctUntilChanged((a, b) => (a?.tenantId ?? null) === (b?.tenantId ?? null)),
      )
      .subscribe((storefront) => {
        this.storefront = storefront;
        if (storefront?.tenantId) {
          this.loadFooterPages();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get storeName(): string {
    const raw = this.storefront?.storeName?.trim() || 'Sasta Khareedo';
    // Display capitalization only — does not change stored/API value
    if (/^sasta\s*khareedo$/i.test(raw.replace(/\s+/g, ' ').trim())) {
      return 'Sasta Khareedo';
    }
    return raw;
  }

  /**
   * Same source as header: StoreLogoService only.
   * Do not fall back to POS storefront.logoUrl / themeLogo (can be a different brand mark).
   */
  get logoSrc(): string {
    return (this.storeLogoUrl || '').trim();
  }

  get phoneDisplay(): string | null {
    const phone = this.storefront?.phoneNumber?.trim();
    return phone || null;
  }

  get emailDisplay(): string | null {
    const email = this.storefront?.email?.trim();
    return email || null;
  }

  get addressDisplay(): string | null {
    const address = this.storefront?.storeAddress?.trim();
    return address || null;
  }

  get whatsAppDisplay(): string | null {
    const whatsApp = this.storefront?.whatsAppNumber?.trim();
    return whatsApp || null;
  }

  get hasContactInfo(): boolean {
    return !!(this.phoneDisplay || this.emailDisplay || this.addressDisplay || this.whatsAppDisplay);
  }

  get whatsAppHref(): string {
    const raw = this.whatsAppDisplay || '';
    const digits = raw.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : '#';
  }

  get showCashOnDelivery(): boolean {
    return !!this.storefront?.isCashOnDeliveryEnabled;
  }

  get showGoPayFast(): boolean {
    return !!this.storefront?.isGoPayFastEnabled;
  }

  get hasPaymentMethods(): boolean {
    return this.showCashOnDelivery || this.showGoPayFast;
  }

  pageLink(slug: string): string[] {
    return this.pageService.pageLink(slug);
  }

  private loadFooterPages(): void {
    this.pageService.getActivePages().subscribe({
      next: (pages) => {
        if (pages?.length) {
          this.quickLinkPages = pages;
        }
      },
    });
  }
}
