import { Component, ElementRef, HostListener, OnInit, OnDestroy, Input } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { OnlineShopSettingsService } from '../../services/online-shop-settings.service';
import { OnlineShopStorefront } from '../../models/online-shop-storefront.model';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header-one',
  templateUrl: './header-one.component.html',
  styleUrls: ['./header-one.component.scss']
})
export class HeaderOneComponent implements OnInit, OnDestroy {
  
  @Input() class: string='';
  // @Input() class: string;
  @Input() themeLogo: string = 'assets/images/icon/logo.png'; // Default Logo
  @Input() topbar: boolean = true; // Default True
  /** When true, header is fixed at the top for the entire page (no scroll delay). */
  @Input() sticky: boolean = false;

  public storefront: OnlineShopStorefront | null = null;
  readonly cartCount$: Observable<number>;
  isDarkMode = true;

  private readonly destroy$ = new Subject<void>();

  constructor(
    public productService: ProductService,
    public auth: AuthService,
    private storefrontSettings: OnlineShopSettingsService,
    private themeService: ThemeService,
    private elementRef: ElementRef<HTMLElement>,
  ) {
    this.cartCount$ = this.productService.cartCount;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) {
      return;
    }
    const wrapper = this.elementRef.nativeElement.querySelector('.all-cat-wrapper');
    if (wrapper && !wrapper.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get userInitials(): string {
    return this.auth.getInitials();
  }

  logout(): void {
    this.auth.logout(true);
  }

  onThemeToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.themeService.setTheme(checked ? 'dark' : 'light');
  }

  get currencyLabel(): string {
    const name = this.storefront?.currencyName?.trim();
    if (name) {
      return name;
    }
    return this.productService.Currency?.name || '';
  }

  ngOnInit(): void {
    this.filterbyCategory();
    this.isDarkMode = this.themeService.isDark();
    this.themeService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe((theme) => {
        this.isDarkMode = theme === 'dark';
      });

    this.storefrontSettings.storefront$
      .pipe(takeUntil(this.destroy$))
      .subscribe((storefront) => {
        this.storefront = storefront;
        if (storefront) {
          this.productService.applyStoreCurrency(storefront);
        }
      });

    if (this.storefrontSettings.snapshot) {
      this.storefront = this.storefrontSettings.snapshot;
      this.productService.applyStoreCurrency(this.storefrontSettings.snapshot);
    } else {
      this.storefrontSettings.loadStorefront().subscribe();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get storeName(): string {
    return this.storefront?.storeName?.trim() || 'EaseWorq';
  }


  categories!: Category[];
  // categories: Category[] = this.CATEGORIES;
  activeCat: Category | null = null;
  isOpen = false;
 
  openMenu() {
    this.isOpen = true;
    // default highlight first item

  }
  filterbyCategory() {
  // get filterbyCategory() {
    // const category = CATEGORIES;
    this.productService.getCategories().subscribe({
      next:(resp) =>{
        this.categories = resp.result;
      }
    });
    // return category
  }
 
  closeMenu() {
    this.isOpen = false;
    this.activeCat = null;
  }
 
  setActive(cat: Category) {
    this.activeCat = cat;
  }


}
  // categories pannel 
  // src/app/shared/data/categories.data.ts

export interface Category {
  id: number;
  title: string;
  slug: string;
  image?: string;
  children?: Category[];
}