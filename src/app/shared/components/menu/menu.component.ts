import { Component, HostListener, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { NavService, Menu } from '../../services/nav.service';
import { OnlineShopHeaderMenuService } from '../../services/online-shop-header-menu.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})
export class MenuComponent implements OnDestroy {
  public menuItems: Menu[] = [];
  public activeMegaMenu: Menu | null = null;
  public popularProductsLoading = false;

  private readonly destroy$ = new Subject<void>();
  private megaCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverOpenTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly defaultPopularByMega = new Map<Menu, Menu[]>();
  private ignoreMegaOpenUntil = 0;

  /** Hover-intent: open only if pointer rests on the trigger/panel zone. */
  private readonly HOVER_OPEN_MS = 175;
  /** Hover-intent: delay before close when leaving the unified zone. */
  private readonly HOVER_CLOSE_MS = 300;
  /** Subcategory count below this → compact single-column dropdown. */
  private readonly COMPACT_SUBCATEGORY_LIMIT = 6;

  constructor(
    private router: Router,
    public navServices: NavService,
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

  ngOnDestroy(): void {
    this.clearMegaCloseTimer();
    this.clearHoverOpenTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  isDesktop(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= 992;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.activeMegaMenu) {
      return;
    }

    const target = event.target as HTMLElement;
    if (
      target.closest('.mega-menu-hover-zone')
      || target.closest('.mega-menu-backdrop')
    ) {
      return;
    }

    this.closeMegaMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.activeMegaMenu) {
      this.closeMegaMenu();
    }
  }

  onMegaBackdropClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeMegaMenu();
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

  /** Compact dropdown when the category has few subcategories. */
  isCompactDropdown(megaMenu: Menu): boolean {
    return this.getSubcategoryCount(megaMenu) < this.COMPACT_SUBCATEGORY_LIMIT;
  }

  getSubcategoryCount(megaMenu: Menu): number {
    const cats = megaMenu.children?.find((c) => c.megaColumnType === 'categories');
    return cats?.children?.length ?? 0;
  }

  /** Flattened links for compact menus: Shop All + subcategories (no empty popular). */
  getCompactLinks(megaMenu: Menu): Menu[] {
    const links: Menu[] = [];
    for (const col of megaMenu.children || []) {
      if (col.megaColumnType === 'popular') {
        continue;
      }
      for (const link of col.children || []) {
        if (link?.title) {
          links.push(link);
        }
      }
    }
    return links;
  }

  /** Mega columns excluding empty / placeholder popular. */
  getVisibleColumns(megaMenu: Menu): Menu[] {
    return (megaMenu.children || []).filter((col) => this.shouldShowColumn(col));
  }

  private shouldShowColumn(column: Menu): boolean {
    if (column.megaColumnType !== 'popular') {
      return !!(column.children?.length);
    }
    const kids = column.children || [];
    if (!kids.length) {
      return false;
    }
    if (kids.length === 1 && /view category/i.test(String(kids[0].title || ''))) {
      return false;
    }
    return true;
  }

  getPopularColumn(megaMenu: Menu): Menu | undefined {
    return megaMenu.children?.find((c) => c.megaColumnType === 'popular');
  }

  panelId(item: Menu): string {
    const key = (item.mainCategoryId || item.title || 'menu')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    return `store-mega-${key}`;
  }

  onTriggerClick(item: Menu, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.clearHoverOpenTimer();

    if (!this.isDesktop()) {
      this.toggletNavActive(item);
      return;
    }

    if (this.isMegaOpen(item)) {
      this.closeMegaMenu();
    } else {
      this.openMegaMenu(item);
    }
  }

  onTriggerKeydown(item: Menu, event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onTriggerClick(item, event);
    }
  }

  /**
   * Unified hover zone = trigger + dropdown (single enter/leave).
   * Moving between trigger and panel must not close/reopen.
   */
  onHoverZoneEnter(item: Menu): void {
    if (!this.isDesktop() || !item.megaMenu || Date.now() < this.ignoreMegaOpenUntil) {
      return;
    }
    this.clearMegaCloseTimer();
    this.clearHoverOpenTimer();

    if (this.isMegaOpen(item)) {
      return;
    }

    this.hoverOpenTimer = setTimeout(() => {
      this.hoverOpenTimer = null;
      this.openMegaMenu(item);
    }, this.HOVER_OPEN_MS);
  }

  onHoverZoneLeave(item: Menu, event: MouseEvent): void {
    if (!this.isDesktop() || !item.megaMenu) {
      return;
    }

    this.clearHoverOpenTimer();

    const zone = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (related && zone.contains(related)) {
      return;
    }

    this.scheduleCloseMegaMenu();
  }

  onCompactLinkClick(): void {
    this.onMegaLinkClick();
  }

  openMegaMenu(item: Menu): void {
    if (!item.megaMenu || Date.now() < this.ignoreMegaOpenUntil) {
      return;
    }
    this.clearMegaCloseTimer();
    this.clearHoverOpenTimer();
    this.activeMegaMenu = item;

    if (!this.isCompactDropdown(item)) {
      this.cacheDefaultPopularProducts(item);
      this.ensureDefaultPopularProducts(item);
    }
  }

  private ensureDefaultPopularProducts(megaMenu: Menu): void {
    if (this.defaultPopularByMega.has(megaMenu)) {
      this.restoreDefaultPopularProducts(megaMenu);
      return;
    }

    const categoryId = megaMenu.mainCategoryId;
    const popular = this.getPopularColumn(megaMenu);
    if (!categoryId || !popular) {
      return;
    }

    this.popularProductsLoading = true;
    this.headerMenuService.getPopularProductLinks(categoryId).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: (children) => {
        this.popularProductsLoading = false;
        if (this.activeMegaMenu !== megaMenu) {
          return;
        }
        popular.children = children.length ? children : [];
        this.cacheDefaultPopularProducts(megaMenu);
      },
      error: () => {
        this.popularProductsLoading = false;
      },
    });
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

  scheduleCloseMegaMenu(): void {
    this.clearMegaCloseTimer();
    this.megaCloseTimer = setTimeout(() => {
      this.activeMegaMenu = null;
      this.popularProductsLoading = false;
      this.megaCloseTimer = null;
    }, this.HOVER_CLOSE_MS);
  }

  closeMegaMenu(): void {
    this.clearMegaCloseTimer();
    this.clearHoverOpenTimer();
    this.activeMegaMenu = null;
    this.popularProductsLoading = false;
    this.ignoreMegaOpenUntil = Date.now() + 350;
  }

  toggletNavActive(item: Menu): void {
    item.active = !item.active;
  }

  onMegaLinkClick(): void {
    this.closeMegaMenu();
    this.navServices.mainMenuToggle = false;
  }

  /** Mobile accordion: only show groups that have links (skip empty popular). */
  getMobileColumns(megaMenu: Menu): Menu[] {
    return this.getVisibleColumns(megaMenu);
  }

  private clearMegaCloseTimer(): void {
    if (this.megaCloseTimer) {
      clearTimeout(this.megaCloseTimer);
      this.megaCloseTimer = null;
    }
  }

  private clearHoverOpenTimer(): void {
    if (this.hoverOpenTimer) {
      clearTimeout(this.hoverOpenTimer);
      this.hoverOpenTimer = null;
    }
  }
}
