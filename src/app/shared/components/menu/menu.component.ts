import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { NavService, Menu } from '../../services/nav.service';
import { OnlineShopHeaderMenuService } from '../../services/online-shop-header-menu.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})
export class MenuComponent implements OnInit, OnDestroy {
  public menuItems: Menu[] = [];
  public activeMegaMenu: Menu | null = null;
  public selectedSubcategoryId: string | null = null;
  public popularProductsLoading = false;

  private readonly destroy$ = new Subject<void>();
  private readonly subcategorySelect$ = new Subject<{ categoryId: string; megaMenu: Menu }>();
  private megaCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly defaultPopularByMega = new Map<Menu, Menu[]>();
  constructor(
    private router: Router,
    public navServices: NavService,
    private elementRef: ElementRef<HTMLElement>,
    private headerMenuService: OnlineShopHeaderMenuService,
  ) {
    this.navServices.items.pipe(takeUntil(this.destroy$)).subscribe((menuItems) => {
      this.menuItems = menuItems;
    });

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.navServices.mainMenuToggle = false;
        this.closeMegaMenu();
      });
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.syncMegaPanelTop);
      window.addEventListener('scroll', this.syncMegaPanelTop, true);
    }

    this.subcategorySelect$
      .pipe(
        switchMap(({ categoryId, megaMenu }) =>
          this.headerMenuService.getPopularProductLinks(categoryId).pipe(
            map((children) => ({ megaMenu, children, categoryId })),
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(({ megaMenu, children, categoryId }) => {
        this.popularProductsLoading = false;
        if (this.activeMegaMenu !== megaMenu) {
          return;
        }
        const popular = this.getPopularColumn(megaMenu);
        if (popular) {
          popular.children = children.length
            ? children
            : [
                {
                  title: 'View category',
                  type: 'link',
                  path: '/shop/collection/left/sidebar',
                  queryParams: { category: categoryId },
                  skipTranslate: true,
                },
              ];
        }
      });
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.syncMegaPanelTop);
      window.removeEventListener('scroll', this.syncMegaPanelTop, true);
    }
    this.clearMegaCloseTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private readonly syncMegaPanelTop = (): void => {
    if (!this.activeMegaMenu || typeof window === 'undefined' || window.innerWidth < 992) {
      return;
    }
    const navBar = document.querySelector('.microless-header .navigation-bar');
    if (navBar) {
      const bottom = navBar.getBoundingClientRect().bottom;
      document.documentElement.style.setProperty('--store-mega-top', `${bottom}px`);
    }
  };

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeMegaMenu();
    }
  }

  mainMenuToggle(): void {
    this.navServices.mainMenuToggle = !this.navServices.mainMenuToggle;
    if (!this.navServices.mainMenuToggle) {
      this.closeMegaMenu();
    }
  }

  menuLabel(item: Menu): string {
    return item?.title || '';
  }

  useTranslate(item: Menu | null | undefined): boolean {
    return !item?.skipTranslate;
  }

  isMegaOpen(item: Menu): boolean {
    return this.activeMegaMenu === item;
  }

  getPopularColumn(megaMenu: Menu): Menu | undefined {
    return megaMenu.children?.find((c) => c.megaColumnType === 'popular');
  }

  isSubcategorySelected(link: Menu): boolean {
    const id = link.queryParams?.['category'];
    return !!id && this.selectedSubcategoryId === String(id);
  }

  onSubcategoryClick(link: Menu, megaMenu: Menu): void {
    const categoryId = link.queryParams?.['category'];
    if (!categoryId || !megaMenu.megaMenu) {
      return;
    }
    this.selectedSubcategoryId = String(categoryId);
    this.popularProductsLoading = true;
    this.subcategorySelect$.next({ categoryId: String(categoryId), megaMenu });
  }

  onMegaPanelLinkClick(event: MouseEvent, link: Menu, megaMenu: Menu, column: Menu): void {
    if (column.megaColumnType === 'categories') {
      event.preventDefault();
      event.stopPropagation();
      this.onSubcategoryClick(link, megaMenu);
      return;
    }
    this.onMegaLinkClick();
  }

  onShopAllHover(megaMenu: Menu): void {
    this.resetPopularToDefault(megaMenu);
  }

  private resetPopularToDefault(megaMenu: Menu): void {
    this.selectedSubcategoryId = null;
    this.popularProductsLoading = false;
    this.restoreDefaultPopularProducts(megaMenu);
  }

  private restoreDefaultPopularProducts(megaMenu: Menu): void {
    const defaults = this.defaultPopularByMega.get(megaMenu);
    const popular = this.getPopularColumn(megaMenu);
    if (popular && defaults) {
      popular.children = defaults.map((item) => ({ ...item }));
    }
  }

  private cacheDefaultPopularProducts(megaMenu: Menu): void {
    const popular = this.getPopularColumn(megaMenu);
    if (popular?.children?.length) {
      this.defaultPopularByMega.set(
        megaMenu,
        popular.children.map((item) => ({ ...item })),
      );
    }
  }

  openMegaMenu(item: Menu): void {
    if (!item.megaMenu) {
      return;
    }
    this.clearMegaCloseTimer();
    this.activeMegaMenu = item;
    this.selectedSubcategoryId = null;
    this.cacheDefaultPopularProducts(item);
    this.syncMegaPanelTop();
  }

  scheduleCloseMegaMenu(): void {
    this.clearMegaCloseTimer();
    this.megaCloseTimer = setTimeout(() => {
      this.activeMegaMenu = null;
      this.selectedSubcategoryId = null;
      this.popularProductsLoading = false;
    }, 320);
  }

  onMegaHoverZoneLeave(event: MouseEvent): void {
    const zone = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (!related) {
      this.scheduleCloseMegaMenu();
      return;
    }
    if (zone.contains(related)) {
      return;
    }
    const megaPanel = zone.querySelector('.store-mega-panel');
    if (megaPanel?.contains(related)) {
      return;
    }
    if (related instanceof Element && related.closest('.store-mega-panel')) {
      return;
    }
    this.scheduleCloseMegaMenu();
  }

  closeMegaMenu(): void {
    this.clearMegaCloseTimer();
    this.activeMegaMenu = null;
    this.selectedSubcategoryId = null;
    this.popularProductsLoading = false;
  }

  toggletNavActive(item: Menu): void {
    item.active = !item.active;
  }

  onMegaLinkClick(): void {
    this.closeMegaMenu();
    this.navServices.mainMenuToggle = false;
  }

  private clearMegaCloseTimer(): void {
    if (this.megaCloseTimer) {
      clearTimeout(this.megaCloseTimer);
      this.megaCloseTimer = null;
    }
  }
}
