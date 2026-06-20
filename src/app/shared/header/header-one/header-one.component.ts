import {
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  Input,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { OnlineShopSettingsService } from '../../services/online-shop-settings.service';
import { OnlineShopStorefront } from '../../models/online-shop-storefront.model';
import { AuthService } from '../../services/auth.service';
import { SignalRService } from '../../services/signal-r.service';
import { NotificationService } from '../../services/notification.service';
import { ShopNotificationItem } from '../../models/notification.model';
import { ThemeService } from '../../services/theme.service';
import {
  OnlineShopSearchService,
  SearchCategorySuggestion,
  SearchProductSuggestion,
  SearchSuggestionsResult,
} from '../../services/online-shop-search.service';

@Component({
  selector: 'app-header-one',
  templateUrl: './header-one.component.html',
  styleUrls: ['./header-one.component.scss']
})
export class HeaderOneComponent implements OnInit, OnDestroy {
  @Input() class: string = '';
  @Input() themeLogo: string = 'assets/images/icon/logo.png';
  @Input() topbar: boolean = true;
  @Input() sticky: boolean = false;

  public storefront: OnlineShopStorefront | null = null;
  readonly cartCount$: Observable<number>;
  isDarkMode = true;

  searchText = '';
  searchDropdownOpen = false;
  searchLoading = false;
  searchSuggestions: SearchSuggestionsResult = { products: [], categories: [] };
  justAddedSuggestionId: string | null = null;
  cartRevision = 0;

  private readonly destroy$ = new Subject<void>();
  private addedSuggestionTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly searchInput$ = new Subject<string>();
  private readonly isBrowser: boolean;

  constructor(
    public productService: ProductService,
    public auth: AuthService,
    public signalRService: SignalRService,
    private notificationService: NotificationService,
    private router: Router,
    private storefrontSettings: OnlineShopSettingsService,
    private themeService: ThemeService,
    private searchService: OnlineShopSearchService,
    private elementRef: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.cartCount$ = this.productService.cartCount;
    this.isBrowser = isPlatformBrowser(platformId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isBrowser) {
      return;
    }

    const target = event.target as Node;
    const catWrapper = this.elementRef.nativeElement.querySelector('.all-cat-wrapper');
    if (this.isOpen && catWrapper && !catWrapper.contains(target)) {
      this.closeMenu();
    }

    const searchWrapper = this.elementRef.nativeElement.querySelector('.header-search');
    if (this.searchDropdownOpen && searchWrapper && !searchWrapper.contains(target)) {
      this.closeSearchDropdown();
    }
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get userInitials(): string {
    return this.auth.getInitials();
  }

  logout(): void {
    this.signalRService.closeConnection();
    this.auth.logout(true);
  }

  readNotification(item: ShopNotificationItem): void {
    if (!item?.id) {
      return;
    }

    if (!item.isRead) {
      this.notificationService.markAsRead(item.id).subscribe({
        next: () => {
          this.signalRService.removeNotification(item.id);
        }
      });
    }

    const orderId = item.sourceId?.trim();
    const isOrderNotification = this.isOrderNotification(item);

    if (item.link) {
      let path = item.link.startsWith('/') ? item.link : `/${item.link}`;
      if (isOrderNotification && orderId) {
        path = this.appendOrderIdQuery(path, orderId);
      }
      void this.router.navigateByUrl(path);
      return;
    }

    if (isOrderNotification) {
      void this.router.navigate(
        ['/pages/my-orders'],
        orderId ? { queryParams: { orderId } } : undefined
      );
    }
  }

  private isOrderNotification(item: ShopNotificationItem): boolean {
    const sourceType = item.sourceType?.toLowerCase() ?? '';
    return sourceType.includes('onlineshopsaleorder') || sourceType.includes('order');
  }

  private appendOrderIdQuery(path: string, orderId: string): string {
    const [basePath, existingQuery = ''] = path.split('?');
    const params = new URLSearchParams(existingQuery);
    params.set('orderId', orderId);
    return `${basePath}?${params.toString()}`;
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
    }

    this.productService.cartItems
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cartRevision++;
      });

    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          const q = term.trim();
          if (q.length < 2) {
            this.searchLoading = false;
            this.searchSuggestions = { products: [], categories: [] };
            this.searchDropdownOpen = false;
            return of({ products: [], categories: [] });
          }
          this.searchLoading = true;
          this.searchDropdownOpen = true;
          return this.searchService.getSuggestions(q);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (result) => {
          if (!result) {
            return;
          }
          this.searchLoading = false;
          this.searchSuggestions = result;
          this.searchDropdownOpen = true;
        },
        error: () => {
          this.searchLoading = false;
          this.searchSuggestions = { products: [], categories: [] };
        },
      });
  }

  ngOnDestroy(): void {
    if (this.addedSuggestionTimer) {
      clearTimeout(this.addedSuggestionTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  get storeName(): string {
    return this.storefront?.storeName?.trim() || 'EaseWorq';
  }

  categories!: Category[];
  private categoryTree: Category[] = [];
  activeCat: Category | null = null;
  isOpen = false;

  openMenu(): void {
    this.isOpen = true;
  }

  filterbyCategory(): void {
    this.productService.getCategories().subscribe({
      next: (resp) => {
        this.categories = resp.result;
        this.categoryTree = Array.isArray(resp.result) ? resp.result : [];
      }
    });
  }

  closeMenu(): void {
    this.isOpen = false;
    this.activeCat = null;
  }

  setActive(cat: Category): void {
    this.activeCat = cat;
  }

  onSearchInput(): void {
    this.searchInput$.next(this.searchText);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submitSearch();
    } else if (event.key === 'Escape') {
      this.closeSearchDropdown();
    }
  }

  submitSearch(): void {
    const q = this.searchText.trim();
    if (!q) {
      return;
    }
    this.closeSearchDropdown();
    void this.router.navigate(['/shop/collection/left/sidebar'], {
      queryParams: { search: q, page: 1 },
    });
  }

  selectProductSuggestion(item: SearchProductSuggestion): void {
    this.closeSearchDropdown();
    const slug = item.slug || item.productInventoryId || item.id;
    if (slug) {
      void this.router.navigate(['/shop/product/left/sidebar', slug]);
      return;
    }
    void this.router.navigate(['/shop/collection/left/sidebar'], {
      queryParams: { search: item.name, page: 1 },
    });
  }

  private suggestionInventoryId(item: SearchProductSuggestion): string {
    return item.productInventoryId || item.id;
  }

  private suggestionStock(item: SearchProductSuggestion): number {
    return Number(item.productUnitStock ?? item.stock);
  }

  isSuggestionOutOfStock(item: SearchProductSuggestion): boolean {
    void this.cartRevision;
    if (item.isAvailable === false) {
      return true;
    }
    const stock = this.suggestionStock(item);
    return !Number.isFinite(stock) || stock <= 0;
  }

  hasSuggestionReachedStockLimit(item: SearchProductSuggestion): boolean {
    void this.cartRevision;
    const inventoryId = this.suggestionInventoryId(item);
    return this.productService.getRemainingStock(inventoryId, this.suggestionStock(item)) <= 0
      && !this.isSuggestionOutOfStock(item);
  }

  canAddSuggestionToCart(item: SearchProductSuggestion): boolean {
    return !this.isSuggestionOutOfStock(item);
  }

  getSuggestionCartBtnLabel(item: SearchProductSuggestion): string {
    if (this.isSuggestionJustAdded(item)) {
      return 'Added';
    }
    if (this.isSuggestionOutOfStock(item)) {
      return 'Out';
    }
    if (this.hasSuggestionReachedStockLimit(item)) {
      return 'In cart';
    }
    return 'Add';
  }

  openRelatedProducts(item: SearchProductSuggestion, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeSearchDropdown();

    const queryParams: Record<string, string | number> = { page: 1 };
    const categoryId = item.categoryId?.trim();
    const brandId = item.brandId?.trim();

    if (categoryId) {
      queryParams.category = categoryId;
    } else if (brandId) {
      queryParams.brand = brandId;
    } else if (item.categoryName?.trim()) {
      queryParams.search = item.categoryName.trim();
    } else {
      queryParams.search = item.name?.trim() || this.searchText.trim();
    }

    void this.router.navigate(['/shop/collection/left/sidebar'], { queryParams });
  }

  addSuggestionToCart(item: SearchProductSuggestion, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const inventoryId = this.suggestionInventoryId(item);
    this.productService
      .addSearchSuggestionToCart(item, { openCart: false })
      .subscribe((added) => {
        if (added) {
          this.flashSuggestionAdded(inventoryId);
          return;
        }

        if (this.justAddedSuggestionId === inventoryId) {
          this.justAddedSuggestionId = null;
        }
      });
  }

  isSuggestionJustAdded(item: SearchProductSuggestion): boolean {
    const inventoryId = this.suggestionInventoryId(item);
    return this.justAddedSuggestionId === inventoryId && !this.hasSuggestionReachedStockLimit(item);
  }

  private flashSuggestionAdded(id: string): void {
    this.justAddedSuggestionId = id;
    if (this.addedSuggestionTimer) {
      clearTimeout(this.addedSuggestionTimer);
    }
    this.addedSuggestionTimer = setTimeout(() => {
      this.justAddedSuggestionId = null;
      this.addedSuggestionTimer = null;
    }, 1800);
  }

  selectCategorySuggestion(item: SearchCategorySuggestion): void {
    this.closeSearchDropdown();
    void this.router.navigate(['/shop/collection/left/sidebar'], {
      queryParams: { category: item.id, page: 1 },
    });
  }

  closeSearchDropdown(): void {
    this.searchDropdownOpen = false;
  }

  get hasSearchResults(): boolean {
    return (
      this.searchSuggestions.products.length > 0 || this.searchSuggestions.categories.length > 0
    );
  }

  resolveSuggestionImage(url?: string): string {
    const normalized = this.productService.normalizeImageUrl(url);
    return normalized || this.productService.defaultProductImage;
  }

  formatSuggestionPrice(price?: number): string {
    if (price == null || Number.isNaN(price)) {
      return '';
    }
    const sym = this.productService.Currency?.currency || 'RS';
    return `${sym} ${price.toFixed(2)}`;
  }

  resolveCategoryDisplayName(item: SearchCategorySuggestion): string {
    const apiName = (item.name || '').trim();
    if (apiName) {
      return apiName;
    }

    const fromTree = this.findCategoryTitleById(item.id);
    if (fromTree) {
      return fromTree;
    }

    const parentName = (item.parentName || '').trim();
    return parentName || 'Category';
  }

  resolveCategoryMeta(item: SearchCategorySuggestion): string {
    const title = this.resolveCategoryDisplayName(item);
    const parentName = (item.parentName || '').trim();
    if (parentName && parentName.toLowerCase() !== title.toLowerCase()) {
      return `in ${parentName}`;
    }
    return '';
  }

  private findCategoryTitleById(categoryId: string): string {
    const target = String(categoryId || '').trim().toLowerCase();
    if (!target || !this.categoryTree.length) {
      return '';
    }

    const walk = (nodes: Category[]): string => {
      for (const node of nodes) {
        const id = String((node as { id?: string | number }).id ?? '').trim().toLowerCase();
        const title = String(node.title ?? '').trim();
        if (id && id === target && title) {
          return title;
        }
        if (node.children?.length) {
          const nested = walk(node.children);
          if (nested) {
            return nested;
          }
        }
      }
      return '';
    };

    return walk(this.categoryTree);
  }
}

export interface Category {
  id: number;
  title: string;
  slug: string;
  image?: string;
  children?: Category[];
}
